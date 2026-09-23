import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { handler, ok, requireSameOrigin, requireUser } from "@/lib/api";
import { requireWorkspaceRole, WS_COOKIE } from "@/lib/workspace";

/** Sets the `vf_ws` cookie (SPEC §6). */
export const POST = handler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  requireSameOrigin(req);
  const { id } = await params;
  const { userId } = await requireUser();
  await requireWorkspaceRole(id, userId, "viewer");
  const store = await cookies();
  store.set(WS_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return ok({ workspace_id: id });
});
