import { beforeEach, describe, expect, it, vi } from "vitest";

// SPEC §21.5 — account deletion must remove every file of the user's workspaces and fail loudly.
const deleted: string[] = [];
let failOn: string | null = null;

vi.mock("@/lib/env", () => ({ integrations: { r2: false } }));
vi.mock("@/lib/storage/r2", () => ({ r2Storage: () => null }));
vi.mock("@/lib/storage/local", () => ({
  localStorageDriver: () => ({
    id: "local",
    async deletePrefix(prefix: string) {
      if (prefix === failOn) throw new Error("R2 unavailable");
      deleted.push(prefix);
      return 1;
    },
  }),
}));

const { deleteUserFiles } = await import("@/lib/storage");

describe("deleteUserFiles", () => {
  beforeEach(() => {
    deleted.length = 0;
    failOn = null;
  });

  it("removes workspace files, ZIP downloads and the user prefix", async () => {
    await deleteUserFiles("user-1", ["ws-a", "ws-b"]);
    expect(deleted).toEqual(["ws/ws-a/", "downloads/ws-a/", "ws/ws-b/", "downloads/ws-b/", "users/user-1/"]);
  });

  it("propagates storage errors so the caller keeps the account", async () => {
    failOn = "downloads/ws-a/";
    await expect(deleteUserFiles("user-1", ["ws-a"])).rejects.toThrow("R2 unavailable");
  });
});
