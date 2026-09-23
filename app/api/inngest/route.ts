import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

/** SPEC §14.1 — Inngest serve endpoint. Vercel: maxDuration 300 (Fluid compute). */
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
  signingKey: process.env.INNGEST_SIGNING_KEY || undefined,
});
