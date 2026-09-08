import type { ExecutionRecord, Plan, PlanRevision, Review, Task, Workspace } from "./types";

export interface ExportInput {
  workspace: Workspace;
  plans: readonly Plan[];
  planRevisions: readonly PlanRevision[];
  tasks: readonly Task[];
  executionRecords: readonly ExecutionRecord[];
  reviews: readonly Review[];
  exportedAt: string;
}

/** Constructs a fresh export document from the public schema allowlist only. */
export function serializeExport(input: ExportInput): Record<string, unknown> {
  return {
    schemaVersion: "pds-schema-v2",
    exportedAt: input.exportedAt,
    workspace: pickWorkspace(input.workspace),
    plans: input.plans.map(pickPlan),
    planRevisions: input.planRevisions.map(pickPlanRevision),
    tasks: input.tasks.map(pickTask),
    executionRecords: input.executionRecords.map(pickExecutionRecord),
    reviews: input.reviews.map(pickReview),
  };
}

function pickWorkspace(value: Workspace) { return { id: value.id, slug: value.slug, title: value.title, timezone: value.timezone, createdAt: value.createdAt }; }
function pickPlan(value: Plan) { return { id: value.id, workspaceId: value.workspaceId, title: value.title, startDate: value.startDate, endDate: value.endDate, priority: value.priority, successCriteria: value.successCriteria, estimatedMinutes: value.estimatedMinutes, createdAt: value.createdAt, updatedAt: value.updatedAt, archivedAt: value.archivedAt }; }
function pickPlanRevision(value: PlanRevision) { return { id: value.id, workspaceId: value.workspaceId, title: value.title, startDate: value.startDate, endDate: value.endDate, priority: value.priority, successCriteria: value.successCriteria, estimatedMinutes: value.estimatedMinutes, revisionNo: value.revisionNo, savedAt: value.savedAt }; }
function pickTask(value: Task) { return { id: value.id, planId: value.planId, title: value.title, dueDate: value.dueDate, priority: value.priority, tag: value.tag, estimatedMinutes: value.estimatedMinutes, status: value.status, blockedReason: value.blockedReason, completedAt: value.completedAt, deletedAt: value.deletedAt, createdAt: value.createdAt, updatedAt: value.updatedAt }; }
function pickExecutionRecord(value: ExecutionRecord) { return { id: value.id, taskId: value.taskId, startedAt: value.startedAt, endedAt: value.endedAt, actualMinutes: value.actualMinutes, missedReason: value.missedReason, idempotencyKey: value.idempotencyKey, createdAt: value.createdAt }; }
function pickReview(value: Review) { return { id: value.id, planId: value.planId, correctionText: value.correctionText, nextPlanId: value.nextPlanId, createdAt: value.createdAt }; }
