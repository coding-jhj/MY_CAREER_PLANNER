import type {
  CreateExecutionRecordInput,
  CreatePlanInput,
  CreateReviewInput,
  CreateTaskInput,
  DiaryEntry,
  ExecutionRecord,
  Plan,
  PlanRevision,
  Review,
  SortKey,
  Task,
  TaskStatus,
  UpdatePlanInput,
  UpdateReviewInput,
  UpdateTaskInput,
  Workspace,
} from "../../domain/types";

export interface TaskQuery {
  search?: string;
  status?: TaskStatus;
  priority?: number;
  tag?: string;
  sort?: SortKey;
  direction?: "asc" | "desc";
  includeDeleted?: false;
}

export interface PlanRepository {
  getCurrent(workspaceId: string): Promise<Plan | null>;
  listByWorkspace(workspaceId: string): Promise<Plan[]>;
  getById(planId: string): Promise<Plan | null>;
  insert(workspaceId: string, input: CreatePlanInput): Promise<Plan>;
  updateWithRevision(planId: string, input: UpdatePlanInput): Promise<Plan>;
  listRevisions(planId: string): Promise<PlanRevision[]>;
}

export interface TaskRepository {
  list(planId: string, query: TaskQuery): Promise<Task[]>;
  insert(planId: string, input: CreateTaskInput): Promise<Task>;
  update(taskId: string, input: UpdateTaskInput): Promise<Task>;
  softDelete(taskId: string): Promise<void>;
}

export interface ExecutionRepository {
  listByTask(taskId: string): Promise<ExecutionRecord[]>;
  getByIdempotencyKey(idempotencyKey: string): Promise<ExecutionRecord | null>;
  insert(taskId: string, input: Omit<CreateExecutionRecordInput, "taskId">): Promise<ExecutionRecord>;
  completeWithExecution(taskId: string, input: Omit<CreateExecutionRecordInput, "taskId">): Promise<ExecutionRecord>;
}

export interface ReviewRepository {
  listByPlan(planId: string): Promise<Review[]>;
  insert(planId: string, input: CreateReviewInput): Promise<Review>;
  update(reviewId: string, input: UpdateReviewInput): Promise<Review>;
  createWithNextPlan(planId: string, input: { correctionText: string; nextPlan: CreatePlanInput }): Promise<{ review: Review; nextPlan: Plan }>;
}

/** Server-only boundary for the one public workspace; it never returns raw DB rows. */
export interface WorkspaceRepository {
  getBySlug(slug: string): Promise<Workspace | null>;
}

export interface DiaryRepository {
  listByWorkspace(workspaceId: string): Promise<DiaryEntry[]>;
  insertMany(workspaceId: string, entries: readonly Omit<DiaryEntry, "id" | "workspaceId" | "createdAt" | "updatedAt">[]): Promise<DiaryEntry[]>;
  insert(workspaceId: string, entry: Omit<DiaryEntry, "id" | "workspaceId" | "createdAt" | "updatedAt">): Promise<DiaryEntry>;
}
