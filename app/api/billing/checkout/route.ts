import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireSameOrigin, requireUser, audit } from "@/lib/api";
import { checkoutSchema } from "@/lib/validation/misc";
import { requireWorkspaceRole } from "@/lib/workspace";
import { createCheckoutSession } from "@/lib/billing/stripe";

/** POST /api/billing/checkout — hosted Stripe Checkout URL (SPEC §11.6). Owner only. */
export const POST = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const { userId, email, profile } = await requireUser();
  const body = await parseJson(req, checkoutSchema);
  const { workspace } = await requireWorkspaceRole(body.workspace_id, userId, "owner");
  const url = await createCheckoutSession({
    workspace,
    userId,
    email,
    kind: body.kind,
    trialUsed: Boolean(profile.trial_used_at),
  });
  await audit(userId, "billing.checkout", { type: "workspace", id: workspace.id }, { kind: body.kind });
  return ok({ url });
});
