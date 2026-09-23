import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getAppContext } from "@/lib/appContext";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Generator } from "@/components/generate/generator";
import { ASSET_TYPES } from "@/lib/validation/jobs";
import { ASSET_TYPE_LABELS } from "@/lib/utils";
import { roleAtLeast } from "@/lib/workspace";
import { isFlagEnabled, PIPELINE_FLAG } from "@/lib/flags";
import { Alert, AlertDescription } from "@/components/ui/primitives";

const DESCRIPTIONS: Record<string, string> = {
  model_3d: "Text or image to 3D with PBR textures, optional rigging and animations. GLB / GLTF / FBX / OBJ.",
  audio_sfx: "Sound effects, optionally loopable. WAV / OGG / MP3.",
  audio_music: "Music tracks and loops. WAV / OGG / MP3.",
  audio_voice: "Character voice lines (text-to-speech). One line = one cue.",
};

/** SPEC §17.4 — /app/generate/[type]: three-panel generator. */
export default async function GeneratePage({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<{ project?: string }> }) {
  const { type } = await params;
  const { project } = await searchParams;
  if (!(ASSET_TYPES as readonly string[]).includes(type)) notFound();
  const ctx = await getAppContext();
  const enabled = await isFlagEnabled(PIPELINE_FLAG[type], true);
  let initialProjectId: string | null = null;
  if (project) {
    const { data } = await supabaseAdmin().from("projects").select("id").eq("id", project).eq("workspace_id", ctx.workspace.id).maybeSingle();
    initialProjectId = data?.id ?? null;
  }
  const canGenerate = roleAtLeast(ctx.role, "member") && !ctx.readOnly && enabled;
  const reason = !enabled ? "This generator is temporarily disabled" : ctx.readOnly ? "Team workspace is read-only without Studio" : !roleAtLeast(ctx.role, "member") ? "Viewers cannot generate" : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Generate {ASSET_TYPE_LABELS[type]}</h1>
        <p className="text-muted-foreground text-sm">{DESCRIPTIONS[type]}</p>
      </div>
      {!enabled && (
        <Alert variant="warning">
          <AlertDescription>This generator is currently disabled by the administrators.</AlertDescription>
        </Alert>
      )}
      <Suspense>
        <Generator type={type} plan={ctx.workspace.plan} canGenerate={canGenerate} disabledReason={reason} initialProjectId={initialProjectId} balance={ctx.balance.available} />
      </Suspense>
    </div>
  );
}
