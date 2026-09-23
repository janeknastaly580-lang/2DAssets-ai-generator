import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, requireUser } from "@/lib/api";
import { portalSchema } from "@/lib/validation/misc";
import { requireWorkspaceRole } from "@/lib/workspace";
import { createPortalSession } from "@/lib/billing/stripe";

/** POST /api/billing/portal — Stripe Customer Portal (SPEC §11.6). Owner only. */
export const POST = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const { userId, email } = await requireUser();
  const body = await parseJson(req, portalSchema);
  const { workspace } = await requireWorkspaceRole(body.workspace_id, userId, "owner");
  return ok({ url: await createPortalSession(workspace, email) });
});
