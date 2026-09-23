import "server-only";
import JSZip from "jszip";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { sendTemplateEmail } from "@/lib/email/resend";

/** SPEC §21.5 — GDPR data export: JSON dump + presigned file links (24 h), delivered by e-mail. */
export async function buildDataExport(userId: string): Promise<string> {
  const db = supabaseAdmin();
  const st = storage();
  const { data: profile } = await db.from("profiles").select("*").eq("id", userId).single();
  if (!profile) throw new Error("profile not found");
  const { data: memberships } = await db.from("workspace_members").select("workspace_id, role, joined_at, workspaces(*)").eq("user_id", userId);
  const wsIds = (memberships ?? []).map((m) => m.workspace_id);
  const { data: projects } = await db.from("projects").select("*").in("workspace_id", wsIds);
  const { data: assets } = await db.from("assets").select("*, asset_files(id, format, variant, r2_key, size_bytes)").in("workspace_id", wsIds).eq("created_by", userId);
  const { data: jobs } = await db
    .from("jobs")
    .select("id, workspace_id, project_id, type, status, input, credits_estimated, credits_charged, error_code, created_at, finished_at")
    .eq("user_id", userId);
  const { data: ledger } = await db.from("credit_ledger").select("*").in("workspace_id", wsIds);

  const files: { asset_id: string; name: string; url: string }[] = [];
  for (const a of assets ?? []) {
    for (const f of (a.asset_files ?? []) as { r2_key: string; variant: string | null; format: string }[]) {
      files.push({ asset_id: a.id, name: `${f.variant ?? f.format}`, url: await st.presignGet(f.r2_key, { ttl: 24 * 3600 }) });
    }
  }
  const zip = new JSZip();
  zip.file("profile.json", JSON.stringify(profile, null, 2));
  zip.file("workspaces.json", JSON.stringify(memberships ?? [], null, 2));
  zip.file("projects.json", JSON.stringify(projects ?? [], null, 2));
  zip.file("assets.json", JSON.stringify((assets ?? []).map(({ asset_files: _f, ...rest }) => rest), null, 2));
  zip.file("jobs.json", JSON.stringify(jobs ?? [], null, 2));
  zip.file("credit_ledger.json", JSON.stringify(ledger ?? [], null, 2));
  zip.file("file_links.json", JSON.stringify(files, null, 2));
  const body = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const key = `users/${userId}/export-${Date.now()}.zip`;
  await st.put(key, body, { contentType: "application/zip" });
  const url = await st.presignGet(key, { ttl: 24 * 3600, filename: "veyraflow-export.zip" });
  await sendTemplateEmail({ to: profile.email, alias: "data-export-ready", variables: { DOWNLOAD_URL: url } }).catch(() => undefined);
  return url;
}
