import { z } from "zod";

import type {
  CreatePlanInput,
  CreateTaskInput,
  UpdatePlanInput,
  UpdateTaskInput,
} from "./types";
import { ValidationError } from "../server/errors";

type FieldErrors = Record<string, string[]>;

const requiredText = (field: string) =>
  z.string().trim().min(1, `${field} is required`);

const planFields = {
  title: requiredText("Title"),
  startDate: z.iso.date({ error: "Start date must be an ISO date (YYYY-MM-DD)" }),
  endDate: z.iso.date({ error: "End date must be an ISO date (YYYY-MM-DD)" }),
  priority: z.number().int("Priority must be an integer").min(1).max(5),
  successCriteria: requiredText("Success criteria"),
  estimatedMinutes: z
    .number()
    .int("Estimated minutes must be an integer")
    .nonnegative("Estimated minutes must be non-negative"),
};

const taskFields = {
  title: requiredText("Title"),
  dueDate: z.union([z.iso.date({ error: "Due date must be an ISO date (YYYY-MM-DD)" }), z.null()]),
  priority: z.number().int("Priority must be an integer").min(1).max(5),
  tag: requiredText("Tag"),
  estimatedMinutes: z
    .number()
    .int("Estimated minutes must be an integer")
    .nonnegative("Estimated minutes must be non-negative"),
  publicStatus: z.enum(["todo", "in_progress"]),
  blockedReason: z.union([z.string(), z.null()]),
};

const orderedDates = (value: { startDate?: string; endDate?: string }, ctx: z.RefinementCtx) => {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "End date must be on or after start date",
    });
  }
};

export const createPlanSchema = z
  .object({
    workspaceId: requiredText("Workspace ID"),
    ...planFields,
  })
  .strict()
  .superRefine(orderedDates);

export const updatePlanSchema = z
  .object({
    title: planFields.title.optional(),
    startDate: planFields.startDate.optional(),
    endDate: planFields.endDate.optional(),
    priority: planFields.priority.optional(),
    successCriteria: planFields.successCriteria.optional(),
    estimatedMinutes: planFields.estimatedMinutes.optional(),
    archivedAt: z.union([z.iso.datetime({ offset: true }), z.null()]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one plan field must be provided",
  })
  .superRefine(orderedDates);

export const createTaskSchema = z
  .object({
    planId: requiredText("Plan ID"),
    title: taskFields.title,
    dueDate: taskFields.dueDate.optional(),
    priority: taskFields.priority,
    tag: taskFields.tag,
    estimatedMinutes: taskFields.estimatedMinutes,
    status: taskFields.publicStatus.optional(),
    blockedReason: taskFields.blockedReason.optional(),
  })
  .strict();

export const updateTaskSchema = z
  .object({
    title: taskFields.title.optional(),
    dueDate: taskFields.dueDate.optional(),
    priority: taskFields.priority.optional(),
    tag: taskFields.tag.optional(),
    estimatedMinutes: taskFields.estimatedMinutes.optional(),
    status: taskFields.publicStatus.optional(),
    blockedReason: taskFields.blockedReason.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one task field must be provided",
  });

function fieldErrors(error: z.ZodError): FieldErrors {
  return error.issues.reduce<FieldErrors>((errors, issue) => {
    const field = issue.path.length > 0 ? issue.path.join(".") : "form";
    (errors[field] ??= []).push(issue.message);
    return errors;
  }, {});
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError("Invalid plan input", fieldErrors(result.error));
  }
  return result.data;
}

export function parseCreatePlanInput(input: unknown): CreatePlanInput {
  return parse(createPlanSchema, input);
}

export function parseUpdatePlanInput(input: unknown): UpdatePlanInput {
  return parse(updatePlanSchema, input);
}

export function parseCreateTaskInput(input: unknown): CreateTaskInput {
  return parse(createTaskSchema, input);
}

export function parseUpdateTaskInput(input: unknown): UpdateTaskInput {
  return parse(updateTaskSchema, input);
}

export function requireNonEmptyId(value: string, field: string): string {
  if (value.trim().length === 0) {
    throw new ValidationError("Invalid plan input", { [field]: [`${field} is required`] });
  }
  return value;
}
