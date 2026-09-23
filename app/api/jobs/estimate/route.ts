import type { NextRequest } from "next/server";
import { handler, ok, parseJson, requireUser } from "@/lib/api";
import { estimateJobSchema, parseJobInput } from "@/lib/validation/jobs";
import { getCurrentWorkspace } from "@/lib/workspace";
import { estimateJob } from "@/lib/credits/pricing";
import { getBalance } from "@/lib/credits/ledger";

/** POST /api/jobs/estimate — "This will use N credits" (SPEC §11.2, §16.3). */
export const POST = handler(async (req: NextRequest) => {
  const { userId } = await requireUser();
  const { workspace } = await getCurrentWorkspace(userId);
  const body = await parseJson(req, estimateJobSchema);
  const input = parseJobInput(body.type, body.input);
  const estimate = await estimateJob(body.type, input, workspace.plan);
  const balance = await getBalance(workspace.id);
  return ok({ ...estimate, balance: balance.available, enough: balance.available >= estimate.credits });
});
