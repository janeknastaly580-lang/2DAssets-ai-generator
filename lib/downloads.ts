import "server-only";
import JSZip from "jszip";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { storage, storageKeys } from "@/lib/storage";
import { fileMatchesPreset, readmeFor } from "@/lib/postprocess/enginePresets";
import { slugify } from "@/lib/utils";
import { reportError } from "@/lib/errorReporting";
import type { EnginePreset } from "@/lib/validation/misc";

export const MAX_ZIP_BYTES = 200 * 1024 * 1024;

/**
 * SPEC §10.6 — builds a ZIP for selected assets / a whole project with an engine preset,
 * stores it under downloads/ (24 h TTL) and marks the `downloads` row ready.
 */
export async function buildDownloadZip(downloadId: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: dl } = await db.from("downloads").select("*").eq("id", downloadId).single();
  if (!dl || dl.status === "ready") return;
  await db.from("downloads").update({ status: "building" }).eq("id", downloadId);
  try {
    const spec = dl.spec as { asset_ids?: string[]; project_id?: string; engine_preset: EnginePreset };
    let query = db.from("assets").select("*, asset_files(*), projects!assets_project_id_fkey(name, slug)").eq("workspace_id", dl.workspace_id).is("deleted_at", null);
    query = spec.project_id ? query.eq("project_id", spec.project_id) : query.in("id", spec.asset_ids ?? []);
    const { data: assets, error } = await query;
    if (error) throw error;

    const zip = new JSZip();
    const manifest: Record<string, unknown>[] = [];
    let total = 0;
    const st = storage();
    for (const a of assets ?? []) {
      const project = a.projects as { name: string; slug: string } | null;
      const dir = spec.project_id ? `${project?.slug ?? "project"}/${a.type}/${a.slug}` : `${a.type}/${a.slug}`;
      const files = (a.asset_files as { format: string; variant: string | null; engine_preset: string | null; r2_key: string; size_bytes: number }[]).filter((f) =>
        fileMatchesPreset(f, spec.engine_preset, a.type),
      );
      for (const f of files) {
        total += f.size_bytes;
        if (total > MAX_ZIP_BYTES) throw new Error("Selection exceeds the 200 MB ZIP limit — split it into smaller downloads");
        const ext = f.r2_key.split(".").pop();
        zip.file(`${dir}/${slugify(a.name, 40)}_${f.variant ?? f.format}.${ext}`, await st.get(f.r2_key));
      }
      const readme = readmeFor(spec.engine_preset, a.type, a.metadata as Record<string, unknown>);
      if (readme) zip.file(`${dir}/${readme.name}`, readme.content);
      manifest.push({ id: a.id, name: a.name, type: a.type, prompt: a.prompt, metadata: a.metadata, files: files.map((f) => `${f.variant ?? f.format}`) });
    }
    zip.file(
      "MANIFEST.json",
      JSON.stringify(
        { app: "Veyraflow", version: "0.1", generated_at: new Date().toISOString(), engine_preset: spec.engine_preset, license: "See Terms of Service (placeholder)", ai_generated: true, assets: manifest },
        null,
        2,
      ),
    );
    const body = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const key = storageKeys.download(dl.workspace_id, downloadId);
    await st.put(key, body, { contentType: "application/zip" });
    await db
      .from("downloads")
      .update({ status: "ready", r2_key: key, size_bytes: body.byteLength, expires_at: new Date(Date.now() + 24 * 3600_000).toISOString() })
      .eq("id", downloadId);
  } catch (e) {
    await db.from("downloads").update({ status: "failed", error: (e as Error).message.slice(0, 300) }).eq("id", downloadId);
    await reportError(e, { where: "download zip" });
  }
}
