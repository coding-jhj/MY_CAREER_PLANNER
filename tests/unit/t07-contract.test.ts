import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const protectedRoutes = [
  "app/api/dashboard/route.ts",
  "app/api/export/route.ts",
  "app/api/plans/route.ts",
  "app/api/tasks/route.ts",
  "app/api/reviews/[planId]/route.ts",
  "app/api/diary/route.ts",
];

describe("T07 authentication contract", () => {
  it("puts every representative user-data route behind the authenticated context", async () => {
    const sources = await Promise.all(protectedRoutes.map((path) => readFile(path, "utf8")));
    expect(sources.every((source) => source.includes("getAuthenticatedContext"))).toBe(true);
  });

  it("keeps session refresh and ownership enforcement in the server boundary", async () => {
    const proxy = await readFile("proxy.ts", "utf8");
    const migration = await readFile("supabase/migrations/005_t07_auth_ownership_and_diary.sql", "utf8");
    expect(proxy).toContain("getClaims");
    expect(migration).toContain("alter table public.workspaces enable row level security");
    expect(migration).toContain("alter table public.diary_entries enable row level security");
    expect(migration).toContain("grant select, insert, update, delete on table");
    expect(migration).toContain("to authenticated");
    expect(migration).toContain("with check");
    expect(migration).not.toContain("auth.role()");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set owner_id = new.id");
    const auth = await readFile("lib/server/auth.ts", "utf8");
    expect(auth).toContain('claimString(claims, "session_id")');
    expect(auth).toContain("assertActiveApplicationSession");
  });
});
