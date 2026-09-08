import { describe, expect, it, vi } from "vitest";

import type { ExecutionRecord, Task, UpdateTaskInput } from "../../lib/domain/types";
import { ConflictError, ValidationError } from "../../lib/server/errors";
import type { ExecutionRepository, TaskRepository } from "../../lib/server/repositories/contracts";

const taskId = "task-1";
const key = "00000000-0000-0000-0000-000000000001";

function record(overrides: Partial<ExecutionRecord> = {}): ExecutionRecord {
  return {
    id: "execution-1", taskId, startedAt: "2026-09-07T00:00:00.000Z", endedAt: "2026-09-07T01:30:00.000Z",
    actualMinutes: 90, missedReason: null, idempotencyKey: key, createdAt: "2026-09-07T01:30:00.000Z", ...overrides,
  };
}

function taskRepository(): TaskRepository {
  return {
    list: vi.fn(), insert: vi.fn(), softDelete: vi.fn(),
    update: vi.fn(async (_id: string, input: UpdateTaskInput) => ({
      id: taskId, planId: "plan-1", title: "Read paper", dueDate: null, priority: 1, tag: "research",
      estimatedMinutes: 60, status: input.status ?? "todo", blockedReason: null,
      completedAt: input.completedAt ?? null, deletedAt: null, createdAt: "2026-09-07T00:00:00.000Z", updatedAt: "2026-09-07T00:00:00.000Z",
    } satisfies Task)),
  };
}

function executionRepository(): ExecutionRepository {
  return {
    listByTask: vi.fn(), getByIdempotencyKey: vi.fn(), insert: vi.fn(async () => record()),
    completeWithExecution: vi.fn(async () => record()),
  };
}

describe("execution service", () => {
  it("calculates and stores actual minutes from start and end", async () => {
    const { recordExecution } = await import("../../lib/server/services/execution-service");
    const repository = executionRepository();

    const saved = await recordExecution(repository, taskId, {
      startedAt: "2026-09-07T09:00:00+09:00", endedAt: "2026-09-07T10:30:00+09:00", idempotencyKey: key, missedReason: null,
    });

    expect(saved.actualMinutes).toBe(90);
    expect(repository.insert).toHaveBeenCalledWith(taskId, expect.objectContaining({
      startedAt: "2026-09-07T09:00:00+09:00", endedAt: "2026-09-07T10:30:00+09:00",
    }));
  });

  it("rejects invalid timestamps, reversed time order, blank task IDs, and non-UUID keys", async () => {
    const { recordExecution } = await import("../../lib/server/services/execution-service");
    const repository = executionRepository();
    await expect(recordExecution(repository, " ", { startedAt: "invalid", endedAt: "2026-09-07T10:30:00+09:00", idempotencyKey: "not-a-uuid" })).rejects.toBeInstanceOf(ValidationError);
    await expect(recordExecution(repository, taskId, { startedAt: "2026-09-07T10:30:00+09:00", endedAt: "2026-09-07T09:00:00+09:00", idempotencyKey: key })).rejects.toBeInstanceOf(ValidationError);
  });

  it("records execution without changing the task plan", async () => {
    const { recordExecution } = await import("../../lib/server/services/execution-service");
    const executions = executionRepository();
    await recordExecution(executions, taskId, { startedAt: "2026-09-07T09:00:00+09:00", endedAt: "2026-09-07T10:30:00+09:00", idempotencyKey: key });
    expect(executions.insert).toHaveBeenCalledTimes(1);
  });

  it("returns a same-task retry from the idempotency preflight without a second RPC", async () => {
    const { completeTask } = await import("../../lib/server/services/execution-service");
    const repository = executionRepository();
    vi.mocked(repository.getByIdempotencyKey).mockResolvedValueOnce(null).mockResolvedValueOnce(record());
    const input = { startedAt: "2026-09-07T09:00:00+09:00", endedAt: "2026-09-07T10:30:00+09:00", idempotencyKey: key };
    const first = await completeTask(repository, taskId, input);
    const second = await completeTask(repository, taskId, input);
    expect(second.id).toBe(first.id);
    expect(repository.getByIdempotencyKey).toHaveBeenCalledTimes(2);
    expect(repository.completeWithExecution).toHaveBeenCalledTimes(1);
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("rejects an idempotency key that already belongs to another task", async () => {
    const { completeTask } = await import("../../lib/server/services/execution-service");
    const repository = executionRepository();
    vi.mocked(repository.getByIdempotencyKey).mockResolvedValue(record({ taskId: "task-2" }));
    await expect(completeTask(repository, taskId, {
      startedAt: "2026-09-07T09:00:00+09:00", endedAt: "2026-09-07T10:30:00+09:00", idempotencyKey: key,
    })).rejects.toBeInstanceOf(ConflictError);
    expect(repository.completeWithExecution).not.toHaveBeenCalled();
  });

  it("reopens without deleting prior execution records", async () => {
    const { reopenTask } = await import("../../lib/server/services/execution-service");
    const tasks = taskRepository();
    const executions = executionRepository();
    await reopenTask(tasks, taskId);
    expect(tasks.update).toHaveBeenCalledWith(taskId, { status: "in_progress", completedAt: null });
    expect(executions.listByTask).not.toHaveBeenCalled();
  });
});
