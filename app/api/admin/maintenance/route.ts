import type { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok, parseJson, requireSameOrigin, requireAdmin, audit } from "@/lib/api";
import { expireCreditsSweep, resetViolationCounters, retentionCleanup } from "@/lib/maintenance";

const schema = z.object({ task: z.enum(["retention", "expire_credits", "violations"]) });

/** POST /api/admin/maintenance — run a scheduled task on demand (useful locally, where Upstash schedules do not run). */
export const POST = handler(async (req: NextRequest) => {
  requireSameOrigin(req);
  const admin = await requireAdmin();
  const { task } = await parseJson(req, schema);
  let result: unknown;
  switch (task) {
    case "retention":
      result = await retentionCleanup();
      break;
    case "expire_credits":
      result = await expireCreditsSweep();
      break;
    case "violations":
      result = await resetViolationCounters();
      break;
  }
  await audit(admin.userId, "admin.maintenance.run", { type: "task", id: task }, { result: result as never });
  return ok({ task, result });
});
