import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { ExecutionRecord, Plan, Review, Task, Workspace } from "../../lib/domain/types";
import { NotFoundError, ValidationError } from "../../lib/server/errors";
import type { ExecutionRepository, PlanRepository, ReviewRepository, TaskRepository, WorkspaceRepository } from "../../lib/server/repositories/contracts";
import { getDashboardData, getExportData, getReviewData, saveCorrection } from "../../lib/server/services/review-service";

const workspace: Workspace = { id: "workspace-1", slug: "public", title: "Post-training Research Engineer 지원 준비", timezone: "Asia/Seoul", createdAt: "2026-09-01T00:00:00Z" };
const plan: Plan = { id: "plan-1", workspaceId: workspace.id, title: "Plan", startDate: "2026-09-01", endDate: "2026-09-30", priority: 1, successCriteria: "Learn", estimatedMinutes: 60, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", archivedAt: null };

function repositories() {
  const workspaces: WorkspaceRepository = { getBySlug: vi.fn().mockResolvedValue(workspace) };
  const plans: PlanRepository = { getCurrent: vi.fn().mockResolvedValue(plan), listByWorkspace: vi.fn().mockResolvedValue([plan]), getById: vi.fn().mockResolvedValue(plan), insert: vi.fn(), updateWithRevision: vi.fn(), listRevisions: vi.fn().mockResolvedValue([]) };
  const tasks: TaskRepository = { list: vi.fn().mockResolvedValue([]), insert: vi.fn(), update: vi.fn(), softDelete: vi.fn() };
  const executions: ExecutionRepository = { listByTask: vi.fn(), getByIdempotencyKey: vi.fn(), insert: vi.fn(), completeWithExecution: vi.fn() };
  const reviews: ReviewRepository = { listByPlan: vi.fn().mockResolvedValue([]), update: vi.fn(), insert: vi.fn(async (_planId, input) => ({ id: "review-1", planId: input.planId, correctionText: input.correctionText, nextPlanId: input.nextPlanId ?? null, createdAt: "2026-09-07T00:00:00Z" } satisfies Review)), createWithNextPlan: vi.fn().mockResolvedValue({ review: { id: "review-1", planId: "plan-1", correctionText: "Continue", nextPlanId: "plan-2", createdAt: "2026-09-07T00:00:00Z" }, nextPlan: { ...plan, id: "plan-2" } }) };
  return { workspaces, plans, tasks, executions, reviews };
}

describe("review service", () => {
  it("returns no dashboard rather than fabricating a missing workspace", async () => {
    const r = repositories();
    vi.mocked(r.workspaces.getBySlug).mockResolvedValue(null);
    await expect(getDashboardData(r.workspaces, r.plans, r.tasks, r.executions, r.reviews)).resolves.toBeNull();
    expect(r.plans.getCurrent).not.toHaveBeenCalled();
  });

  it("exports both correction-linked plans and every mapped descendant record", async () => {
    const r = repositories();
    const nextPlan = { ...plan, id: "plan-2", title: "Next plan" };
    const originalTask: Task = { id: "task-1", planId: plan.id, title: "Original task", dueDate: null, priority: 1, tag: "research", estimatedMinutes: 60, status: "in_progress", blockedReason: null, completedAt: null, deletedAt: null, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" };
    const nextTask: Task = { ...originalTask, id: "task-2", planId: nextPlan.id, title: "Next task" };
    const execution: ExecutionRecord = { id: "execution-1", taskId: originalTask.id, startedAt: "2026-09-07T00:00:00Z", endedAt: "2026-09-07T01:00:00Z", actualMinutes: 60, missedReason: null, idempotencyKey: "00000000-0000-4000-8000-000000000001", createdAt: "2026-09-07T01:00:00Z" };
    const review: Review = { id: "review-1", planId: plan.id, correctionText: "Continue", nextPlanId: nextPlan.id, createdAt: "2026-09-07T02:00:00Z" };
    vi.mocked(r.plans.listByWorkspace).mockResolvedValue([plan, nextPlan]);
    vi.mocked(r.plans.listRevisions).mockImplementation(async (planId) => planId === plan.id ? [{ ...plan, revisionNo: 1, savedAt: "2026-09-07T00:00:00Z" }] : []);
    vi.mocked(r.tasks.list).mockImplementation(async (planId) => planId === plan.id ? [originalTask] : [nextTask]);
    vi.mocked(r.executions.listByTask).mockImplementation(async (taskId) => taskId === originalTask.id ? [execution] : []);
    vi.mocked(r.reviews.listByPlan).mockImplementation(async (planId) => planId === plan.id ? [review] : []);

    const exported = await getExportData(r.workspaces, r.plans, r.tasks, r.executions, r.reviews, "2026-09-07T03:00:00Z");

    expect(exported).toMatchObject({
      exportedAt: "2026-09-07T03:00:00Z",
      plans: [{ id: plan.id, title: plan.title }, { id: nextPlan.id, title: nextPlan.title }],
      planRevisions: [{ id: plan.id, revisionNo: 1 }],
      tasks: [{ id: originalTask.id, planId: plan.id }, { id: nextTask.id, planId: nextPlan.id }],
      executionRecords: [{ id: execution.id, taskId: originalTask.id }],
      reviews: [{ id: review.id, planId: plan.id, nextPlanId: nextPlan.id }],
    });
    expect(r.plans.getCurrent).not.toHaveBeenCalled();
    expect(r.tasks.list).toHaveBeenCalledWith(plan.id, { includeDeleted: false });
    expect(r.tasks.list).toHaveBeenCalledWith(nextPlan.id, { includeDeleted: false });
  });

  it("saves a non-empty correction linked to an explicitly selected plan", async () => {
    const r = repositories();
    const saved = await saveCorrection(r.reviews, r.plans, "plan-1", { correctionText: " Spend more time on evaluation. ", nextPlanId: "plan-2" });
    expect(saved.review).toMatchObject({ id: "review-1", planId: "plan-1", nextPlanId: "plan-2", correctionText: "Spend more time on evaluation." });
    expect(r.plans.insert).not.toHaveBeenCalled();
    expect(r.plans.getById).toHaveBeenCalledWith("plan-1");
    expect(r.plans.getById).toHaveBeenCalledWith("plan-2");
  });

  it("creates a next plan and originating review through the atomic repository operation", async () => {
    const r = repositories();
    await saveCorrection(r.reviews, r.plans, "plan-1", { correctionText: "Continue", nextPlan: { workspaceId: "workspace-1", title: "Next", startDate: "2026-10-01", endDate: "2026-10-31", priority: 1, successCriteria: "Improve", estimatedMinutes: 120 } });
    expect(r.reviews.createWithNextPlan).toHaveBeenCalledWith("plan-1", expect.objectContaining({ nextPlan: expect.objectContaining({ title: "Next" }) }));
    expect(r.plans.insert).not.toHaveBeenCalled();
    expect(r.reviews.insert).not.toHaveBeenCalled();
  });

  it("rejects a missing plan before loading review records or saving a correction", async () => {
    const r = repositories();
    vi.mocked(r.plans.getById).mockResolvedValue(null);
    await expect(getReviewData(r.plans, r.tasks, r.executions, r.reviews, "missing", "2026-09-07")).rejects.toBeInstanceOf(NotFoundError);
    expect(r.tasks.list).not.toHaveBeenCalled();
    await expect(saveCorrection(r.reviews, r.plans, "missing", { correctionText: "Continue", nextPlanId: "plan-2" })).rejects.toBeInstanceOf(NotFoundError);
    expect(r.reviews.insert).not.toHaveBeenCalled();
  });

  it("rejects an empty correction and unknown input fields", async () => {
    const r = repositories();
    await expect(saveCorrection(r.reviews, r.plans, "plan-1", { correctionText: " ", nextPlanId: "plan-2", unsafe: "value" })).rejects.toBeInstanceOf(ValidationError);
    expect(r.reviews.insert).not.toHaveBeenCalled();
  });
});

describe("atomic correction repository", () => {
  it("delegates creation to the scoped transaction RPC and migration locks the source before both inserts", async () => {
    const { SupabaseReviewRepository } = await import("../../lib/server/repositories/review-repository");
    const review = { id: "review-1", plan_id: "plan-1", correction_text: "Continue", next_plan_id: "plan-2", created_at: "2026-09-07T00:00:00Z" };
    const nextPlan = { id: "plan-2", workspace_id: "workspace-1", title: "Next", start_date: "2026-10-01", end_date: "2026-10-31", priority: 1, success_criteria: "Improve", estimated_minutes: 120, created_at: "2026-09-07T00:00:00Z", updated_at: "2026-09-07T00:00:00Z", archived_at: null };
    const single = vi.fn().mockResolvedValue({ data: { review, nextPlan }, error: null });
    const rpc = vi.fn().mockReturnValue({ single });
    const saved = await new SupabaseReviewRepository({ rpc } as never).createWithNextPlan("plan-1", { correctionText: "Continue", nextPlan: { workspaceId: "workspace-1", title: "Next", startDate: "2026-10-01", endDate: "2026-10-31", priority: 1, successCriteria: "Improve", estimatedMinutes: 120 } });
    expect(saved).toMatchObject({ review: { id: "review-1", nextPlanId: "plan-2" }, nextPlan: { id: "plan-2" } });
    expect(rpc).toHaveBeenCalledWith("create_review_with_next_plan", expect.objectContaining({ p_plan_id: "plan-1", p_workspace_id: "workspace-1" }));
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/004_review_correction_transaction.sql"), "utf8");
    expect(migration).toContain("create_review_with_next_plan");
    expect(migration).toContain("for update");
    expect(migration).toContain("insert into public.plans");
    expect(migration).toContain("insert into public.reviews");
  });
});
