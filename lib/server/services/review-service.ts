import { z } from "zod";

import { calculateReviewMetrics } from "../../domain/metrics";
import { calculateDiarySummary } from "../../domain/diary";
import { serializeExport } from "../../domain/serialization";
import { parseCreatePlanInput, requireNonEmptyId } from "../../domain/validation";
import type { CreatePlanInput, DashboardData, Plan, Review, ReviewMetrics } from "../../domain/types";
import { NotFoundError, ValidationError } from "../errors";
import type { DiaryRepository, ExecutionRepository, PlanRepository, ReviewRepository, TaskRepository, WorkspaceRepository } from "../repositories/contracts";

export type ReviewData = { metrics: ReviewMetrics; reviews: Review[] };
export type CorrectionResult = { review: Review; nextPlan: Plan | null };

const correctionSchema = z.object({
  correctionText: z.string().trim().min(1, "Correction text is required"),
  nextPlanId: z.string().trim().min(1, "Next plan ID is required").optional(),
  nextPlan: z.unknown().optional(),
}).strict().superRefine((value, ctx) => {
  if ((value.nextPlanId === undefined) === (value.nextPlan === undefined)) {
    ctx.addIssue({ code: "custom", path: ["nextPlanId"], message: "Select an existing next plan or provide a complete next plan" });
  }
});

function correctionInput(input: unknown): { correctionText: string; nextPlanId?: string; nextPlan?: CreatePlanInput } {
  const parsed = correctionSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues.reduce<Record<string, string[]>>((result, issue) => {
      const field = issue.path.join(".") || "form";
      (result[field] ??= []).push(issue.message);
      return result;
    }, {});
    throw new ValidationError("Invalid review correction", details);
  }
  return {
    correctionText: parsed.data.correctionText,
    nextPlanId: parsed.data.nextPlanId,
    nextPlan: parsed.data.nextPlan === undefined ? undefined : parseCreatePlanInput(parsed.data.nextPlan),
  };
}

export function currentSeoulDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) throw new ValidationError("Unable to determine Seoul date");
  return `${year}-${month}-${day}`;
}

async function planRecords(
  taskRepository: TaskRepository,
  executionRepository: ExecutionRepository,
  planId: string,
) {
  const tasks = await taskRepository.list(planId, { includeDeleted: false });
  const executionRecords = (await Promise.all(tasks.map((task) => executionRepository.listByTask(task.id)))).flat();
  return { tasks, executionRecords };
}

export async function getReviewData(
  planRepository: PlanRepository,
  taskRepository: TaskRepository,
  executionRepository: ExecutionRepository,
  reviewRepository: ReviewRepository,
  planId: string,
  today: string = currentSeoulDate(),
): Promise<ReviewData> {
  const id = requireNonEmptyId(planId, "planId");
  if (!await planRepository.getById(id)) throw new NotFoundError("Plan not found");
  const { tasks, executionRecords } = await planRecords(taskRepository, executionRepository, id);
  const reviews = await reviewRepository.listByPlan(id);
  return { metrics: calculateReviewMetrics(tasks, executionRecords, today), reviews };
}

export async function getDashboardData(
  workspaceRepository: WorkspaceRepository,
  planRepository: PlanRepository,
  taskRepository: TaskRepository,
  executionRepository: ExecutionRepository,
  reviewRepository: ReviewRepository,
  workspaceSlug = "public",
  today: string = currentSeoulDate(),
  diaryRepository?: DiaryRepository,
): Promise<DashboardData | null> {
  const workspace = await workspaceRepository.getBySlug(workspaceSlug);
  if (!workspace) return null;
  const diaryEntries = diaryRepository ? await diaryRepository.listByWorkspace(workspace.id) : [];
  const currentPlan = await planRepository.getCurrent(workspace.id);
  if (!currentPlan) {
    return { workspace, currentPlan: null, tasks: [], executionRecords: [], reviews: [], metrics: calculateReviewMetrics([], [], today), diaryEntries, diarySummary: calculateDiarySummary(diaryEntries) };
  }
  const { tasks, executionRecords } = await planRecords(taskRepository, executionRepository, currentPlan.id);
  const reviews = await reviewRepository.listByPlan(currentPlan.id);
  return { workspace, currentPlan, tasks, executionRecords, reviews, metrics: calculateReviewMetrics(tasks, executionRecords, today), diaryEntries, diarySummary: calculateDiarySummary(diaryEntries) };
}

export async function saveCorrection(
  reviewRepository: ReviewRepository,
  planRepository: PlanRepository,
  planId: string,
  input: unknown,
): Promise<CorrectionResult> {
  const originPlanId = requireNonEmptyId(planId, "planId");
  const correction = correctionInput(input);
  if (!await planRepository.getById(originPlanId)) throw new NotFoundError("Plan not found");
  if (correction.nextPlan) {
    const created = await reviewRepository.createWithNextPlan(originPlanId, {
      correctionText: correction.correctionText, nextPlan: correction.nextPlan,
    });
    return created;
  }
  const nextPlanId = correction.nextPlanId;
  if (!nextPlanId || !await planRepository.getById(nextPlanId)) throw new NotFoundError("Plan not found");
  const review = await reviewRepository.insert(originPlanId, { planId: originPlanId, correctionText: correction.correctionText, nextPlanId });
  return { review, nextPlan: null };
}

export async function getExportData(
  workspaceRepository: WorkspaceRepository,
  planRepository: PlanRepository,
  taskRepository: TaskRepository,
  executionRepository: ExecutionRepository,
  reviewRepository: ReviewRepository,
  exportedAt = new Date().toISOString(),
  diaryRepository?: DiaryRepository,
): Promise<Record<string, unknown> | null> {
  const workspace = await workspaceRepository.getBySlug("public");
  if (!workspace) return null;
  const diaryEntries = diaryRepository ? await diaryRepository.listByWorkspace(workspace.id) : [];
  const plans = await planRepository.listByWorkspace(workspace.id);
  const records = await Promise.all(plans.map(async (plan) => {
    const tasks = await taskRepository.list(plan.id, { includeDeleted: false });
    const [planRevisions, executionRecords, reviews] = await Promise.all([
      planRepository.listRevisions(plan.id),
      Promise.all(tasks.map((task) => executionRepository.listByTask(task.id))).then((items) => items.flat()),
      reviewRepository.listByPlan(plan.id),
    ]);
    return { tasks, planRevisions, executionRecords, reviews };
  }));
  return serializeExport({
    workspace,
    plans,
    planRevisions: records.flatMap((record) => record.planRevisions),
    tasks: records.flatMap((record) => record.tasks),
    executionRecords: records.flatMap((record) => record.executionRecords),
    reviews: records.flatMap((record) => record.reviews),
    diaryEntries,
    exportedAt,
  });
}
