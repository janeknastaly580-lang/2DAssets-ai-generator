import "server-only";
import JSZip from "jszip";
import sharp from "sharp";
import { env, integrations } from "@/lib/env";
import { asFalFile, asFalFiles, buildRodinInput, buildTrellisInput, falModelFor, type FalFile } from "@/lib/ai/falModels";
import { falEndpoint, uploadToFal } from "@/lib/ai/providers/fal";
import { workerAdapter } from "@/lib/ai/providers/worker";
import { fetchBuffer } from "@/lib/ai/providers/types";
import { storage, storageKeys } from "@/lib/storage";
import { boxMesh, buildGlb, buildObj, splitGlb } from "@/lib/postprocess/glb";
import { renderMockImage } from "@/lib/postprocess/mockImage";
import { thumbnail } from "@/lib/postprocess/image";
import { model3dMode, type Model3dInput } from "@/lib/validation/jobs";
import { resolveImageInput, presignedInputUrl } from "./inputs";
import { submitAndWait } from "./providerWait";
import { JobFailure, type OutputAsset, type OutputFile, type PipelineContext, type PipelineResult } from "./types";

const isImageFile = (f: FalFile) => /^image\//.test(f.content_type ?? "") || /\.(png|jpe?g|webp)$/i.test(f.file_name ?? f.url);

/** "texture_diffuse.png" → "albedo", "Normal Map.jpg" → "normal_map"; unique per model. */
function textureName(f: FalFile, index: number, taken: Set<string>): string {
  const base = (f.file_name ?? "").replace(/\.[a-z0-9]+$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  let name = /diffuse|base_?color|albedo/.test(base) ? "albedo" : base || `texture_${index + 1}`;
  while (taken.has(name)) name = `${name}_${index + 1}`;
  taken.add(name);
  return name;
}

async function asPng(buf: Buffer): Promise<Buffer> {
  return buf.subarray(0, 4).toString("latin1") === "\x89PNG" ? buf : sharp(buf).png().toBuffer();
}

export interface Fal3dResult {
  glb: Buffer;
  textures: { name: string; buf: Buffer }[];
  thumbPng: Buffer;
  costUsd: number;
  metadata: Record<string, unknown>;
}

/**
 * The fal.ai part of the 3D pipeline (SPEC §9.7): uploads the photos to fal storage (our presigned
 * URLs are unreachable for fal on local storage), runs Rodin or TRELLIS and collects mesh,
 * textures and a thumbnail.
 */
export async function generate3dOnFal(ctx: PipelineContext<Model3dInput>, photos: Buffer[]): Promise<Fal3dResult> {
  const { input } = ctx;
  const model = falModelFor("model_3d", input);
  const imageUrls: string[] = [];
  let hasTransparency = false;
  for (const photo of photos) {
    const meta = await sharp(photo).metadata();
    if (meta.hasAlpha && !(await sharp(photo).stats()).isOpaque) hasTransparency = true;
    imageUrls.push(await uploadToFal(photo, `image/${meta.format === "jpeg" ? "jpeg" : meta.format ?? "png"}`));
  }
  await ctx.setProgress(12);

  const falInput =
    input.engine === "trellis"
      ? buildTrellisInput(input, ctx.translated, imageUrls[0])
      : buildRodinInput(input, ctx.translated, { urls: imageUrls, hasTransparency });
  const adapter = falEndpoint(model.endpoint);
  const out = await submitAndWait(ctx, adapter, falInput, { model: model.endpoint, timeoutMs: 30 * 60_000, pollMs: 10_000, progressBase: 12, progressSpan: 60 });

  const mesh = asFalFile(out.data.model_mesh);
  if (!mesh) throw new JobFailure("provider_output", "fal.ai returned no 3D mesh");
  const taken = new Set<string>();
  const textureFiles = asFalFiles(out.data.textures);
  const textures: Fal3dResult["textures"] = [];
  for (let i = 0; i < textureFiles.length; i++) {
    textures.push({ name: textureName(textureFiles[i], i, taken), buf: await asPng(await fetchBuffer(textureFiles[i].url)) });
  }
  // Rodin image-to-3D returns a preview render among the extra files; otherwise use the photo.
  const render = asFalFiles(out.data.model_meshes).find(isImageFile);
  const thumbPng = render
    ? await fetchBuffer(render.url)
    : (photos[0] ?? (await renderMockImage({ prompt: input.prompt, width: 512, height: 512, transparent: false, label: "3D" })));

  const params = Object.fromEntries(Object.entries(falInput).filter(([k]) => k !== "image_url" && k !== "image_urls"));
  return {
    glb: await fetchBuffer(mesh.url),
    textures,
    thumbPng,
    costUsd: adapter.estimateCostUsd(falInput),
    metadata: {
      model: model.endpoint,
      provider_params: params, // UI-mapped + LLM-chosen values actually sent (SPEC §9.7)
      t_a_pose: params.TAPose === true,
      ...(typeof out.data.seed === "number" ? { seed: out.data.seed } : {}),
    },
  };
}

/**
 * SPEC §9.3 — 3D models & characters on fal.ai (§9.7): Rodin Gen-2.5 (text-to-3D, or image-to-3D
 * with 1–3 photos + optional prompt) or TRELLIS (exactly one photo). Conversions to FBX/OBJ run on
 * the Blender worker when configured.
 */
export async function runModel3dPipeline(ctx: PipelineContext<Model3dInput>): Promise<PipelineResult> {
  const { input } = ctx;
  const mode = model3dMode(input);
  let cost = 0;
  const files: OutputFile[] = [];
  const metadata: Record<string, unknown> = {
    mode,
    engine: input.engine,
    input_image_count: input.images.length,
    quality: input.quality,
    target_polycount: input.target_polycount,
    topology: input.topology,
    pbr: input.pbr,
    texture_resolution: input.texture_resolution,
    has_rig: false,
    animations: [] as string[],
    // The rigging/animation model on fal.ai is not connected yet: a rig request gets a T/A-pose
    // character (Rodin) without a skeleton, and the rig add-ons are not charged (SPEC §9.3).
    rig_status: input.rig ? "not_connected" : null,
    texture_maps: [] as string[],
    real_world_size_m: input.real_world_size_m ?? 1,
  };

  let glb: Buffer;
  const textures: { name: string; buf: Buffer }[] = [];
  let thumbPng: Buffer;
  const mock = integrations.mockProviders || !env.FAL_KEY;

  if (mock) {
    const size = (metadata.real_world_size_m as number) ?? 1;
    const mesh = boxMesh("veyraflow_mock", input.rig ? size * 0.4 : size, size, input.rig ? size * 0.25 : size, [0.49, 0.36, 1, 1]);
    glb = buildGlb(mesh);
    metadata.tri_count = mesh.indices.length / 3;
    metadata.model = "mock";
    thumbPng = await renderMockImage({ prompt: input.prompt || "image-to-3D", width: 512, height: 512, transparent: false, label: "MOCK 3D" });
  } else {
    const photos: Buffer[] = [];
    for (const ref of input.images) photos.push((await resolveImageInput(ref, ctx.workspace.id)).png);
    const r = await generate3dOnFal(ctx, photos);
    glb = r.glb;
    textures.push(...r.textures);
    thumbPng = r.thumbPng;
    cost += r.costUsd;
    Object.assign(metadata, r.metadata);
  }
  await ctx.setProgress(80);

  // --- conversions (Blender worker when available; otherwise GLB/GLTF/OBJ via built-in writer) ----
  files.push({ format: "glb", variant: "main", engine_preset: null, ext: "glb", body: glb });
  const split = splitGlb(glb, "model.bin");
  if (split) {
    files.push({ format: "gltf", variant: "main", engine_preset: null, ext: "gltf", body: Buffer.from(split.gltf) });
    files.push({ format: "bin", variant: "main", engine_preset: null, ext: "bin", body: split.bin });
  }
  if (mock) {
    const size = (metadata.real_world_size_m as number) ?? 1;
    const mesh = boxMesh("veyraflow_mock", size, size, size, [0.49, 0.36, 1, 1]);
    const { obj, mtl } = buildObj(mesh, "model.mtl");
    files.push({ format: "obj", variant: "main", engine_preset: null, ext: "obj", body: Buffer.from(obj) });
    files.push({ format: "mtl", variant: "main", engine_preset: null, ext: "mtl", body: Buffer.from(mtl) });
  }
  if (integrations.worker && !mock) {
    const st = storage();
    const glbKey = storageKeys.upload(ctx.workspace.id, `${ctx.job.id}-model`, "glb");
    await st.put(glbKey, glb, { contentType: "model/gltf-binary" });
    const targets = ["fbx_unity", "fbx_unreal", "obj"];
    const putUrls: Record<string, string> = {};
    const outKeys: Record<string, string> = {};
    for (const t of targets) {
      outKeys[t] = storageKeys.upload(ctx.workspace.id, `${ctx.job.id}-${t}`, t.startsWith("fbx") ? "fbx" : "zip");
      putUrls[t] = await st.presignPut(outKeys[t], "application/octet-stream", 500 * 1024 * 1024);
    }
    const task = {
      endpoint: "convert-3d" as const,
      model_url: await presignedInputUrl(glbKey),
      targets,
      scale_m: metadata.real_world_size_m as number,
      output_put_urls: putUrls,
    };
    await submitAndWait(ctx, workerAdapter, task, { model: "blender", timeoutMs: 15 * 60_000, pollMs: 8000, progressBase: 80, progressSpan: 10 });
    for (const t of targets) {
      const head = await st.head(outKeys[t]);
      if (!head) continue;
      const body = await st.get(outKeys[t]);
      if (t === "obj") files.push({ format: "zip", variant: "obj", engine_preset: null, ext: "zip", body });
      else files.push({ format: "fbx", variant: t.replace("fbx_", ""), engine_preset: t.replace("fbx_", ""), ext: "fbx", body });
      await st.delete(outKeys[t]);
    }
    await st.delete(glbKey);
  }
  for (const t of textures) files.push({ format: "texture_png", variant: t.name, engine_preset: null, ext: "png", body: t.buf });
  metadata.texture_maps = textures.map((t) => t.name);

  const zip = new JSZip();
  for (const f of files) zip.file(`${f.variant ?? "file"}.${f.ext}`, f.body);
  files.push({ format: "zip", variant: "all", engine_preset: null, ext: "zip", body: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) });

  const name = input.prompt.trim() ? `3D — ${input.prompt.slice(0, 40)}` : `3D from ${input.images.length} photo${input.images.length === 1 ? "" : "s"}`;
  const asset: OutputAsset = {
    type: "model_3d",
    name,
    prompt: input.prompt || "image-to-3D",
    metadata,
    files,
    preview: await thumbnail(thumbPng, 256),
    parentAssetId: input.parent_asset_id ?? null,
    providerCostUsd: cost,
  };
  return { assets: [asset], providerCostUsd: Number(cost.toFixed(4)) };
}
