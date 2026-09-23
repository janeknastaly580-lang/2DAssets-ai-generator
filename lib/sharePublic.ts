import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { resolveShareToken } from "@/lib/share";
import { filesWithUrls, withPreviewUrls } from "@/lib/assets";
import { slugify } from "@/lib/utils";

/**
 * Public share payload (SPEC §18) — used by GET /api/s/:token and the /s/[token] page.
 * Only non-technical metadata; prompt only when `show_prompt`; download links only when allowed.
 */
export async function getSharePayload(token: string, opts: { countView?: boolean } = {}) {
  const link = await resolveShareToken(token);
  if (!link) return null;
  const db = supabaseAdmin();
  if (opts.countView) {
    await db.from("share_links").update({ view_count: link.view_count + 1 }).eq("id", link.id);
  }
  const st = storage();
  const pick = (m: Record<string, unknown>) => {
    const keys = ["category", "width", "height", "pixel_grid", "palette", "clips", "frame_width", "frame_height", "duration_s", "tri_count", "has_rig", "animations", "loop", "lines"];
    return Object.fromEntries(keys.filter((k) => k in m).map((k) => [k, m[k]]));
  };

  if (link.target_type === "asset") {
    const { data: asset } = await db.from("assets").select("*").eq("id", link.target_id).is("deleted_at", null).maybeSingle();
    if (!asset) return null;
    const [view] = await withPreviewUrls([asset]);
    const files = await filesWithUrls(asset.id);
    const previewFiles = files.filter((f) => ["png", "webp", "gif", "glb", "wav", "mp3", "ogg", "json_atlas"].includes(f.format));
    const downloads = link.allow_download
      ? await Promise.all(
          files.map(async (f) => ({
            id: f.id,
            format: f.format,
            variant: f.variant,
            size_bytes: f.size_bytes,
            url: await st.presignGet(f.r2_key, { ttl: 15 * 60, filename: `${slugify(asset.name, 40)}_${f.variant ?? f.format}.${f.ext}` }),
          })),
        )
      : [];
    return {
      kind: "asset" as const,
      allow_download: link.allow_download,
      asset: {
        id: asset.id,
        name: asset.name,
        type: asset.type,
        prompt: link.show_prompt ? asset.prompt : null,
        metadata: pick(asset.metadata as Record<string, unknown>),
        preview_url: view.preview_url,
        animated_preview_url: view.animated_preview_url,
        created_at: asset.created_at,
      },
      preview_files: previewFiles.map((f) => ({ id: f.id, format: f.format, variant: f.variant, url: f.url })),
      downloads,
    };
  }

  const { data: project } = await db.from("projects").select("id, name, description").eq("id", link.target_id).maybeSingle();
  if (!project) return null;
  const { data: assets } = await db
    .from("assets")
    .select("*")
    .eq("project_id", project.id)
    .is("deleted_at", null)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(60);
  const views = await withPreviewUrls(assets ?? []);
  return {
    kind: "project" as const,
    allow_download: link.allow_download,
    project: { id: project.id, name: project.name, description: project.description },
    assets: views.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      prompt: link.show_prompt ? a.prompt : null,
      preview_url: a.preview_url,
      animated_preview_url: a.animated_preview_url,
      created_at: a.created_at,
    })),
  };
}
