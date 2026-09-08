import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";

const createClient = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("server-only", () => ({}));

describe("server database configuration", () => {
  beforeEach(() => {
    createClient.mockReset();
    vi.resetModules();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("rejects a missing service configuration", async () => {
    const { ConfigurationError, createServerSupabaseClient } = await import(
      "../../lib/server/db"
    );

    expect(() => createServerSupabaseClient()).toThrow(ConfigurationError);
  });

  it("creates a non-persisting server client from server environment variables", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    createClient.mockReturnValue({});

    const { createServerSupabaseClient } = await import("../../lib/server/db");
    createServerSupabaseClient();

    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-key",
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: false }),
      }),
    );
  });
});

describe("repository error translation", () => {
  it("turns idempotency-key uniqueness failures into conflicts", async () => {
    const { ConflictError, translateSupabaseError } = await import(
      "../../lib/server/errors"
    );

    const error = translateSupabaseError({
      code: "23505",
      message: "duplicate key value violates unique constraint execution_records_idempotency_key_key",
    });

    expect(error).toBeInstanceOf(ConflictError);
    if (!(error instanceof ConflictError)) throw new Error("expected a conflict");
    expect(error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("maps foreign-key failures to validation errors", async () => {
    const { ValidationError, translateSupabaseError } = await import(
      "../../lib/server/errors"
    );

    expect(
      translateSupabaseError({ code: "23503", message: "foreign key violation" }),
    ).toBeInstanceOf(ValidationError);
  });

  it("does not retain raw database messages in public error classes", async () => {
    const { translateSupabaseError } = await import("../../lib/server/errors");
    const error = translateSupabaseError({ code: "23514", message: "check failed: leaked internal constraint" });
    expect(error.message).toBe("Invalid database input");
    expect(error.message).not.toContain("leaked");
  });
});

describe("task query contract", () => {
  it("applies a priority equality filter when priority is provided", async () => {
    const { SupabaseTaskRepository } = await import(
      "../../lib/server/repositories/task-repository"
    );
    const filters: Array<[string, unknown]> = [];
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return query;
      },
      is: () => query,
      ilike: () => query,
      order: () => query,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };
    const client = { from: () => query };
    const repository = new SupabaseTaskRepository(client as never);

    await repository.list("plan-id", { priority: 3 });

    expect(filters).toContainEqual(["plan_id", "plan-id"]);
    expect(filters).toContainEqual(["priority", 3]);
  });

  it("filters title, status, tag, excludes deleted rows, and orders with id ASC", async () => {
    const { SupabaseTaskRepository } = await import(
      "../../lib/server/repositories/task-repository"
    );
    const calls: Array<[string, unknown, unknown?]> = [];
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        calls.push(["eq", column, value]);
        return query;
      },
      is: (column: string, value: unknown) => {
        calls.push(["is", column, value]);
        return query;
      },
      ilike: (column: string, value: unknown) => {
        calls.push(["ilike", column, value]);
        return query;
      },
      order: (column: string, options: unknown) => {
        calls.push(["order", column, options]);
        return query;
      },
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };
    const repository = new SupabaseTaskRepository({ from: () => query } as never);

    await repository.list("plan-id", {
      search: "paper", status: "todo", tag: "research", priority: 2,
      sort: "estimated_minutes", direction: "desc", includeDeleted: false,
    });

    expect(calls).toEqual(expect.arrayContaining([
      ["is", "deleted_at", null],
      ["ilike", "title", "%paper%"],
      ["eq", "status", "todo"],
      ["eq", "tag", "research"],
      ["order", "estimated_minutes", { ascending: false }],
      ["order", "due_date", { ascending: true, nullsFirst: false }],
      ["order", "id", { ascending: true }],
    ]));
  });

  it.each([
    ["priority", [["priority", { ascending: false }], ["due_date", { ascending: true, nullsFirst: false }], ["id", { ascending: true }]]],
    ["due_date", [["due_date", { ascending: false, nullsFirst: false }], ["priority", { ascending: true }], ["id", { ascending: true }]]],
    ["estimated_minutes", [["estimated_minutes", { ascending: false }], ["due_date", { ascending: true, nullsFirst: false }], ["id", { ascending: true }]]],
    ["created_at", [["created_at", { ascending: false }], ["id", { ascending: true }]]],
  ] as const)(
    "uses the full approved %s order sequence with id ASC tie-breaking",
    async (sort, expectedOrders) => {
      const { SupabaseTaskRepository } = await import(
        "../../lib/server/repositories/task-repository"
      );
      const orders: Array<[string, { ascending: boolean }]> = [];
      const query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        ilike: () => query,
        order: (column: string, options: { ascending: boolean }) => {
          orders.push([column, options]);
          return query;
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      };
      const repository = new SupabaseTaskRepository({ from: () => query } as never);

      await repository.list("plan-id", { sort, direction: "desc", includeDeleted: false });

      expect(orders).toEqual(expectedOrders);
    },
  );
});

describe("plan revision transaction contract", () => {
  it("delegates snapshot and update to the server-side transaction RPC", async () => {
    const { SupabasePlanRepository } = await import(
      "../../lib/server/repositories/plan-repository"
    );
    const updatedRow = {
      id: "plan-1",
      workspace_id: "workspace-1",
      title: "Revised plan",
      start_date: "2026-09-07",
      end_date: "2026-10-07",
      priority: 1,
      success_criteria: "Done",
      estimated_minutes: 120,
      created_at: "2026-09-07T00:00:00.000Z",
      updated_at: "2026-09-08T00:00:00.000Z",
      archived_at: null,
    };
    const single = vi.fn().mockResolvedValue({ data: updatedRow, error: null });
    const rpc = vi.fn().mockReturnValue({ single });
    const repository = new SupabasePlanRepository({ rpc } as never);

    const plan = await repository.updateWithRevision("plan-1", {
      title: "Revised plan",
    });

    expect(plan.id).toBe("plan-1");
    expect(rpc).toHaveBeenCalledWith("update_plan_with_revision", {
      p_plan_id: "plan-1",
      p_patch: { title: "Revised plan" },
    });
  });
});

describe("execution completion transaction contract", () => {
  it("delegates completion to the atomic server-side RPC", async () => {
    const { SupabaseExecutionRepository } = await import(
      "../../lib/server/repositories/execution-repository"
    );
    const executionRow = {
      id: "execution-1", task_id: "task-1", started_at: "2026-09-07T00:00:00.000Z",
      ended_at: "2026-09-07T01:30:00.000Z", actual_minutes: 90, missed_reason: null,
      idempotency_key: "00000000-0000-0000-0000-000000000001", created_at: "2026-09-07T01:30:00.000Z",
    };
    const single = vi.fn().mockResolvedValue({ data: executionRow, error: null });
    const rpc = vi.fn().mockReturnValue({ single });
    const repository = new SupabaseExecutionRepository({ rpc } as never);

    const execution = await repository.completeWithExecution("task-1", {
      startedAt: "2026-09-07T09:00:00+09:00", endedAt: "2026-09-07T10:30:00+09:00",
      missedReason: null, idempotencyKey: "00000000-0000-0000-0000-000000000001",
    });

    expect(execution.id).toBe("execution-1");
    expect(rpc).toHaveBeenCalledWith("complete_task_with_execution", {
      p_task_id: "task-1", p_started_at: "2026-09-07T09:00:00+09:00", p_ended_at: "2026-09-07T10:30:00+09:00",
      p_missed_reason: null, p_idempotency_key: "00000000-0000-0000-0000-000000000001",
    });
  });

  it("delegates ordinary execution recording to the active-task RPC", async () => {
    const { SupabaseExecutionRepository } = await import(
      "../../lib/server/repositories/execution-repository"
    );
    const executionRow = {
      id: "execution-1", task_id: "task-1", started_at: "2026-09-07T00:00:00.000Z",
      ended_at: "2026-09-07T01:30:00.000Z", actual_minutes: 90, missed_reason: null,
      idempotency_key: "00000000-0000-0000-0000-000000000001", created_at: "2026-09-07T01:30:00.000Z",
    };
    const single = vi.fn().mockResolvedValue({ data: executionRow, error: null });
    const rpc = vi.fn().mockReturnValue({ single });
    const repository = new SupabaseExecutionRepository({ rpc } as never);

    await repository.insert("task-1", {
      startedAt: "2026-09-07T09:00:00+09:00", endedAt: "2026-09-07T10:30:00+09:00",
      missedReason: null, idempotencyKey: "00000000-0000-0000-0000-000000000001",
    });

    expect(rpc).toHaveBeenCalledWith("record_execution_for_active_task", {
      p_task_id: "task-1", p_started_at: "2026-09-07T09:00:00+09:00", p_ended_at: "2026-09-07T10:30:00+09:00",
      p_missed_reason: null, p_idempotency_key: "00000000-0000-0000-0000-000000000001",
    });
  });
});

describe("execution routes", () => {
  it("rejects missing user-supplied timestamps before creating an execution record", async () => {
    const { POST } = await import("../../app/api/tasks/[taskId]/executions/route");
    const response = await POST(new Request("http://localhost/api/tasks/task-1/executions", {
      method: "POST", body: JSON.stringify({ idempotencyKey: "00000000-0000-0000-0000-000000000001" }),
    }), { params: Promise.resolve({ taskId: "task-1" }) });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ details: expect.objectContaining({ startedAt: expect.any(Array), endedAt: expect.any(Array) }) });
  });

  it("defines a scoped completion RPC that locks the task and computes duration from timestamps", async () => {
    const migration = await readFile("supabase/migrations/003_execution_completion_transaction.sql", "utf8");
    expect(migration).toContain("complete_task_with_execution");
    expect(migration).toContain("for update");
    expect(migration).toContain("floor(extract(epoch from (p_ended_at - p_started_at)) / 60)::integer");
    expect(migration).toContain("exception when unique_violation");
    expect(migration).toContain("completed_at = p_ended_at");
    expect(migration.match(/existing_execution\.task_id <> p_task_id/g)).toHaveLength(2);
    expect(migration).toContain("saved_execution.task_id <> p_task_id");
    expect(migration).toContain("idempotency_key_task_mismatch");
    expect(migration).toContain("record_execution_for_active_task");
    expect(migration).toContain("where id = p_task_id and deleted_at is null for update");
  });

  it("maps execution uniqueness conflicts to HTTP 409", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint execution_records_idempotency_key_key" },
    });
    createClient.mockReturnValue({ rpc: vi.fn().mockReturnValue({ single }) });
    vi.resetModules();
    const { POST } = await import("../../app/api/tasks/[taskId]/executions/route");
    const response = await POST(new Request("http://localhost/api/tasks/task-1/executions", {
      method: "POST",
      body: JSON.stringify({ startedAt: "2026-09-07T09:00:00+09:00", endedAt: "2026-09-07T10:30:00+09:00", idempotencyKey: "00000000-0000-0000-0000-000000000001" }),
    }), { params: Promise.resolve({ taskId: "task-1" }) });
    expect(response.status).toBe(409);
  });

  it("maps completion cross-task idempotency conflicts to HTTP 409", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const lookup = {
      select: () => lookup,
      eq: () => lookup,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
    };
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "Idempotency key belongs to a different task", details: "idempotency_key_task_mismatch" },
    });
    createClient.mockReturnValue({ from: () => lookup, rpc: vi.fn().mockReturnValue({ single }) });
    vi.resetModules();
    const { POST } = await import("../../app/api/tasks/[taskId]/complete/route");
    const response = await POST(new Request("http://localhost/api/tasks/task-1/complete", {
      method: "POST",
      body: JSON.stringify({ startedAt: "2026-09-07T09:00:00+09:00", endedAt: "2026-09-07T10:30:00+09:00", idempotencyKey: "00000000-0000-0000-0000-000000000001" }),
    }), { params: Promise.resolve({ taskId: "task-1" }) });
    expect(response.status).toBe(409);
  });
});

describe("review export route", () => {
  it("uses the required download headers and does not fabricate a missing workspace", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const workspaceQuery = {
      select: () => workspaceQuery,
      eq: () => workspaceQuery,
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    createClient.mockReturnValue({ from: vi.fn().mockReturnValue(workspaceQuery) });
    vi.resetModules();
    const { GET } = await import("../../app/api/export/route");
    const response = await GET();
    expect(response.status).toBe(404);

    const planQuery = {
      select: () => planQuery,
      eq: () => planQuery,
      is: () => planQuery,
      order: () => planQuery,
      limit: () => planQuery,
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    workspaceQuery.maybeSingle.mockResolvedValue({ data: {
      id: "workspace-1", slug: "public", title: "Post-training Research Engineer 지원 준비", timezone: "Asia/Seoul", created_at: "2026-09-07T00:00:00Z",
    }, error: null });
    createClient.mockReturnValue({ from: vi.fn().mockImplementation((table: string) => table === "workspaces" ? workspaceQuery : planQuery) });
    vi.resetModules();
    const exportResponse = await (await import("../../app/api/export/route")).GET();
    expect(exportResponse.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(exportResponse.headers.get("content-disposition")).toBe('attachment; filename="pds-export-v2.json"');
    await expect(exportResponse.json()).resolves.toMatchObject({ workspace: { id: "workspace-1" }, plans: [] });
  });
});

describe("review routes", () => {
  it("returns 404 instead of empty metrics for a nonexistent review plan", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const query = { select: () => query, eq: () => query, maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    createClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
    vi.resetModules();
    const { GET } = await import("../../app/api/reviews/[planId]/route");
    const response = await GET(new Request("http://localhost/api/reviews/missing"), { params: Promise.resolve({ planId: "missing" }) });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });

  it("preflights a selected next plan and returns a stable 404 response", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const planRow = { id: "plan-1", workspace_id: "workspace-1", title: "Plan", start_date: "2026-09-01", end_date: "2026-09-30", priority: 1, success_criteria: "Learn", estimated_minutes: 60, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z", archived_at: null };
    const query = { select: () => query, eq: () => query, maybeSingle: vi.fn().mockResolvedValueOnce({ data: planRow, error: null }).mockResolvedValueOnce({ data: null, error: null }) };
    createClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
    vi.resetModules();
    const { POST } = await import("../../app/api/reviews/[planId]/corrections/route");
    const response = await POST(new Request("http://localhost/api/reviews/plan-1/corrections", { method: "POST", body: JSON.stringify({ correctionText: "Continue", nextPlanId: "missing" }) }), { params: Promise.resolve({ planId: "plan-1" }) });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });
});

describe("plan route status mapping", () => {
  it("returns field-specific validation errors with a 400 status", async () => {
    vi.resetModules();
    const { POST } = await import("../../app/api/plans/route");

    const response = await POST(
      new Request("http://localhost/api/plans", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: "workspace-1",
          title: "",
          startDate: "2026-09-08",
          endDate: "2026-09-07",
          priority: 8,
          successCriteria: "",
          estimatedMinutes: -1,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      details: expect.objectContaining({
        title: expect.any(Array),
        endDate: expect.any(Array),
        priority: expect.any(Array),
        successCriteria: expect.any(Array),
        estimatedMinutes: expect.any(Array),
      }),
    });
  });

  it("maps a missing plan from the revision transaction to a 404 status", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    const single = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "P0002", message: "Plan not found" } });
    createClient.mockReturnValue({ rpc: vi.fn().mockReturnValue({ single }) });
    vi.resetModules();
    const { PATCH } = await import("../../app/api/plans/[planId]/route");

    const response = await PATCH(
      new Request("http://localhost/api/plans/missing", {
        method: "PATCH",
        body: JSON.stringify({ title: "Revised plan" }),
      }),
      { params: Promise.resolve({ planId: "missing" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });
});
