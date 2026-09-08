import { describe, expect, it, vi } from "vitest";

import type { Task } from "../../lib/domain/types";
import { ValidationError } from "../../lib/server/errors";
import type { TaskRepository } from "../../lib/server/repositories/contracts";
import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
} from "../../lib/server/services/task-service";

const baseTask: Task = {
  id: "task-1",
  planId: "plan-1",
  title: "Read post-training paper",
  dueDate: "2026-09-10",
  priority: 2,
  tag: "post-training",
  estimatedMinutes: 90,
  status: "todo",
  blockedReason: null,
  completedAt: null,
  deletedAt: null,
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

function createRepository(): TaskRepository {
  return {
    list: vi.fn().mockResolvedValue([baseTask]),
    insert: vi.fn().mockResolvedValue(baseTask),
    update: vi.fn().mockImplementation(async (_id, input) => ({ ...baseTask, ...input })),
    softDelete: vi.fn().mockResolvedValue(undefined),
  };
}

describe("task service", () => {
  it("creates a task with validated fields", async () => {
    const repository = createRepository();
    const input = {
      planId: "plan-1", title: "Read post-training paper", dueDate: "2026-09-10",
      priority: 2, tag: "post-training", estimatedMinutes: 90, status: "todo",
    };

    await createTask(repository, input);

    expect(repository.insert).toHaveBeenCalledWith("plan-1", input);
  });

  it("allows public CRUD to set todo or in-progress but reserves completion for Task 6", async () => {
    const repository = createRepository();

    await updateTask(repository, "task-1", { status: "in_progress" });

    expect(repository.update).toHaveBeenCalledWith("task-1", { status: "in_progress" });
    await expect(createTask(repository, {
      planId: "plan-1", title: "Complete through execution", priority: 1,
      tag: "post-training", estimatedMinutes: 30, status: "done",
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateTask(repository, "task-1", { status: "done" })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateTask(repository, "task-1", {
      completedAt: "2026-09-07T09:00:00.000Z",
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateTask(repository, "task-1", { status: "blocked" })).rejects.toBeInstanceOf(ValidationError);
    expect(repository.update).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid task fields before writing", async () => {
    const repository = createRepository();

    await expect(createTask(repository, {
      planId: "plan-1", title: " ", dueDate: "not-a-date", priority: 6,
      tag: " ", estimatedMinutes: -1, status: "complete",
    })).rejects.toMatchObject({
      details: expect.objectContaining({
        title: expect.any(Array), dueDate: expect.any(Array), priority: expect.any(Array),
        tag: expect.any(Array), estimatedMinutes: expect.any(Array), status: expect.any(Array),
      }),
    });
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("builds title search and tag, status, priority filters for the repository", async () => {
    const repository = createRepository();

    await listTasks(repository, "plan-1", {
      q: "  paper ", tag: " research ", status: "in_progress", priority: "3",
      sort: "due_date", direction: "desc",
    });

    expect(repository.list).toHaveBeenCalledWith("plan-1", {
      search: "paper", tag: "research", status: "in_progress", priority: 3,
      sort: "due_date", direction: "desc", includeDeleted: false,
    });
  });

  it("uses id as a stable tie breaker and excludes soft-deleted tasks", async () => {
    const repository = createRepository();
    vi.mocked(repository.list).mockResolvedValue([
      { ...baseTask, id: "a", priority: 1 },
      { ...baseTask, id: "b", priority: 1 },
      { ...baseTask, id: "c", priority: 1 },
    ]);

    const result = await listTasks(repository, "plan-1", { sort: "priority", direction: "asc" });
    await deleteTask(repository, "task-1");

    expect(result.map((task) => task.id)).toEqual(["a", "b", "c"]);
    expect(repository.list).toHaveBeenCalledWith("plan-1", expect.objectContaining({
      sort: "priority", direction: "asc", includeDeleted: false,
    }));
    expect(repository.softDelete).toHaveBeenCalledWith("task-1");
  });
});
