import {
  parseCreateTaskInput,
  parseUpdateTaskInput,
  requireNonEmptyId,
} from "../../domain/validation";
import type { CreateTaskInput, SortKey, Task, TaskStatus, UpdateTaskInput } from "../../domain/types";
import { ValidationError } from "../errors";
import type { TaskQuery, TaskRepository } from "../repositories/contracts";

type TaskListInput = {
  q?: string;
  status?: string;
  tag?: string;
  priority?: string | number;
  sort?: string;
  direction?: string;
};

const sortKeys: readonly SortKey[] = [
  "priority",
  "due_date",
  "estimated_minutes",
  "created_at",
];
const statuses: readonly TaskStatus[] = ["todo", "in_progress", "done"];

function queryError(field: string, message: string): ValidationError {
  return new ValidationError("Invalid task query", { [field]: [message] });
}

function optionalText(value: string | undefined, field: string): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) throw queryError(field, `${field} must not be empty`);
  return trimmed;
}

export function parseTaskQuery(input: TaskListInput): TaskQuery {
  const search = optionalText(input.q, "q");
  const tag = optionalText(input.tag, "tag");
  const status = input.status === undefined ? undefined : input.status as TaskStatus;
  if (status !== undefined && !statuses.includes(status)) {
    throw queryError("status", "status must be todo, in_progress, or done");
  }

  let priority: number | undefined;
  if (input.priority !== undefined) {
    const rawPriority = typeof input.priority === "number" ? String(input.priority) : input.priority;
    if (!/^[1-5]$/.test(rawPriority)) {
      throw queryError("priority", "priority must be an integer from 1 to 5");
    }
    priority = Number(rawPriority);
  }

  const sort = input.sort === undefined ? undefined : input.sort as SortKey;
  if (sort !== undefined && !sortKeys.includes(sort)) {
    throw queryError("sort", "sort must be priority, due_date, estimated_minutes, or created_at");
  }
  const direction = input.direction;
  if (direction !== undefined && direction !== "asc" && direction !== "desc") {
    throw queryError("direction", "direction must be asc or desc");
  }

  return { search, tag, status, priority, sort, direction, includeDeleted: false };
}

export async function createTask(repository: TaskRepository, input: unknown): Promise<Task> {
  const taskInput: CreateTaskInput = parseCreateTaskInput(input);
  return repository.insert(requireNonEmptyId(taskInput.planId, "planId"), taskInput);
}

export async function updateTask(
  repository: TaskRepository,
  taskId: string,
  input: unknown,
): Promise<Task> {
  return repository.update(requireNonEmptyId(taskId, "taskId"), parseUpdateTaskInput(input));
}

export async function deleteTask(repository: TaskRepository, taskId: string): Promise<void> {
  await repository.softDelete(requireNonEmptyId(taskId, "taskId"));
}

export async function listTasks(
  repository: TaskRepository,
  planId: string,
  query: TaskListInput = {},
): Promise<Task[]> {
  return repository.list(requireNonEmptyId(planId, "planId"), parseTaskQuery(query));
}
