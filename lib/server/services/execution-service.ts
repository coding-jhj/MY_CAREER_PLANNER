import { z } from "zod";

import { requireNonEmptyId } from "../../domain/validation";
import type { CreateExecutionRecordInput, ExecutionRecord, Task } from "../../domain/types";
import { ConflictError, ValidationError } from "../errors";
import type { ExecutionRepository, TaskRepository } from "../repositories/contracts";

type ExecutionInput = Omit<CreateExecutionRecordInput, "taskId">;

const timestampWithOffset = z.string().trim().refine(
  (value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)),
  "must be an ISO timestamp with an offset",
);

const executionInputSchema = z.object({
  startedAt: timestampWithOffset,
  endedAt: timestampWithOffset,
  missedReason: z.union([z.string(), z.null()]).optional(),
  idempotencyKey: z.string().trim().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "idempotencyKey must be a UUID",
  ),
}).strict().superRefine((input, ctx) => {
  const startedAt = Date.parse(input.startedAt);
  const endedAt = Date.parse(input.endedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) {
    ctx.addIssue({ code: "custom", path: ["startedAt"], message: "Execution timestamps must be valid" });
  } else if (endedAt <= startedAt) {
    ctx.addIssue({ code: "custom", path: ["endedAt"], message: "endedAt must be after startedAt" });
  }
});

function executionValidationError(issues: z.core.$ZodIssue[]): ValidationError {
  const details = issues.reduce<Record<string, string[]>>((result, issue) => {
    const field = issue.path.length ? issue.path.join(".") : "form";
    (result[field] ??= []).push(issue.message);
    return result;
  }, {});
  return new ValidationError("Invalid execution input", details);
}

export function parseExecutionInput(input: unknown): ExecutionInput {
  const result = executionInputSchema.safeParse(input);
  if (!result.success) throw executionValidationError(result.error.issues);
  return result.data;
}

export function calculateActualMinutes(startedAt: string, endedAt: string): number {
  const milliseconds = Date.parse(endedAt) - Date.parse(startedAt);
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    throw new ValidationError("Invalid execution input", { endedAt: ["endedAt must be after startedAt"] });
  }
  return Math.floor(milliseconds / 60_000);
}

export async function recordExecution(
  repository: ExecutionRepository,
  taskId: string,
  input: unknown,
): Promise<ExecutionRecord> {
  const validTaskId = requireNonEmptyId(taskId, "taskId");
  const execution = parseExecutionInput(input);
  calculateActualMinutes(execution.startedAt, execution.endedAt);
  return repository.insert(validTaskId, execution);
}

export async function completeTask(
  repository: ExecutionRepository,
  taskId: string,
  input: unknown,
): Promise<ExecutionRecord> {
  const validTaskId = requireNonEmptyId(taskId, "taskId");
  const execution = parseExecutionInput(input);
  calculateActualMinutes(execution.startedAt, execution.endedAt);
  const existing = await repository.getByIdempotencyKey(execution.idempotencyKey);
  if (existing) {
    if (existing.taskId !== validTaskId) {
      throw new ConflictError("This idempotency key belongs to a different task", "IDEMPOTENCY_CONFLICT");
    }
    return existing;
  }
  return repository.completeWithExecution(validTaskId, execution);
}

export async function reopenTask(repository: TaskRepository, taskId: string): Promise<Task> {
  return repository.update(requireNonEmptyId(taskId, "taskId"), {
    status: "in_progress",
    completedAt: null,
  });
}
