import { describe, expect, it } from "vitest";

import { serializeExport } from "../../lib/domain/serialization";

const plan = { id: "plan-1", workspaceId: "workspace-1", title: "Preparation", startDate: "2026-09-01", endDate: "2026-09-30", priority: 1, successCriteria: "Learn", estimatedMinutes: 120, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", archivedAt: null };

describe("serializeExport", () => {
  it("creates a new public allowlisted object without raw-row or secret fields", () => {
    const exported = serializeExport({
      workspace: { id: "workspace-1", slug: "public", title: "Post-training Research Engineer 지원 준비", timezone: "Asia/Seoul", createdAt: "2026-09-01T00:00:00Z", secret: "nope" } as never,
      plans: [{ ...plan, requestHeaders: { authorization: "secret" } } as never],
      planRevisions: [], tasks: [{ id: "task-1", planId: "plan-1", title: "Task", dueDate: null, priority: 1, tag: "research", estimatedMinutes: 60, status: "todo", blockedReason: null, completedAt: null, deletedAt: null, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", env: { SUPABASE_SERVICE_ROLE_KEY: "secret" } } as never],
      executionRecords: [], reviews: [], exportedAt: "2026-09-07T00:00:00Z",
    });
    expect(exported).toMatchObject({ schemaVersion: "pds-schema-v2", exportedAt: "2026-09-07T00:00:00Z", workspace: { id: "workspace-1" }, plans: [expect.objectContaining({ id: "plan-1" })] });
    expect(JSON.stringify(exported)).not.toContain("secret");
    expect(exported).not.toHaveProperty("requestHeaders");
    expect((exported.tasks as Array<Record<string, unknown>>)[0]).not.toHaveProperty("env");
  });

  it("preserves script-like text as data while retaining only the export allowlist", () => {
    const scriptText = "<script>alert(1)</script>";
    const exported = serializeExport({
      workspace: { id: "workspace-1", slug: "public", title: scriptText, timezone: "Asia/Seoul", createdAt: "2026-09-01T00:00:00Z", raw: "remove" } as never,
      plans: [{ ...plan, title: scriptText, untrusted: true } as never], planRevisions: [],
      tasks: [{ id: "task-1", planId: "plan-1", title: scriptText, dueDate: null, priority: 1, tag: "research", estimatedMinutes: 60, status: "todo", blockedReason: null, completedAt: null, deletedAt: null, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", raw: { injected: true } } as never],
      executionRecords: [], reviews: [], exportedAt: "2026-09-07T00:00:00Z",
    });
    const json = JSON.parse(JSON.stringify(exported)) as Record<string, unknown>;
    expect((json.workspace as Record<string, unknown>).title).toBe(scriptText);
    expect(((json.plans as Array<Record<string, unknown>>)[0]).title).toBe(scriptText);
    expect(((json.tasks as Array<Record<string, unknown>>)[0]).title).toBe(scriptText);
    expect(Object.keys(json).sort()).toEqual(["executionRecords", "exportedAt", "planRevisions", "plans", "reviews", "schemaVersion", "tasks", "workspace"]);
    expect(Object.keys(json.workspace as Record<string, unknown>).sort()).toEqual(["createdAt", "id", "slug", "timezone", "title"]);
    expect(Object.keys((json.plans as Array<Record<string, unknown>>)[0]).sort()).toEqual(["archivedAt", "createdAt", "endDate", "estimatedMinutes", "id", "priority", "startDate", "successCriteria", "title", "updatedAt", "workspaceId"]);
    expect(Object.keys((json.tasks as Array<Record<string, unknown>>)[0]).sort()).toEqual(["blockedReason", "completedAt", "createdAt", "deletedAt", "dueDate", "estimatedMinutes", "id", "planId", "priority", "status", "tag", "title", "updatedAt"]);
    expect(JSON.stringify(json)).not.toContain("untrusted");
    expect(JSON.stringify(json)).not.toContain("injected");
  });
});
