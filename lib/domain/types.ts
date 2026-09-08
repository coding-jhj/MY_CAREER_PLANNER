export type TaskStatus = "todo" | "in_progress" | "done";

export type SortKey =
  | "priority"
  | "due_date"
  | "estimated_minutes"
  | "created_at";

export interface Workspace {
  id: string;
  slug: string;
  title: string;
  timezone: string;
  createdAt: string;
}

export interface Plan {
  id: string;
  workspaceId: string;
  title: string;
  startDate: string;
  endDate: string;
  priority: number;
  successCriteria: string;
  estimatedMinutes: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface PlanRevision
  extends Omit<Plan, "createdAt" | "updatedAt" | "archivedAt"> {
  revisionNo: number;
  savedAt: string;
}

export interface Task {
  id: string;
  planId: string;
  title: string;
  dueDate: string | null;
  priority: number;
  tag: string;
  estimatedMinutes: number;
  status: TaskStatus;
  blockedReason: string | null;
  completedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionRecord {
  id: string;
  taskId: string;
  startedAt: string;
  endedAt: string;
  actualMinutes: number;
  missedReason: string | null;
  idempotencyKey: string;
  createdAt: string;
}

export interface Review {
  id: string;
  planId: string;
  correctionText: string;
  nextPlanId: string | null;
  createdAt: string;
}

export type DiaryEntryOrigin = "user_entered" | "synthetic_test";

export interface DiaryEntry {
  id: string;
  workspaceId: string;
  recordDate: string;
  question: string;
  metricName: string;
  unit: string;
  value: number;
  calculationRule: string;
  planRuleVersion: number;
  planRule: string;
  ruleChangeReason: string | null;
  entryOrigin: DiaryEntryOrigin;
  createdAt: string;
  updatedAt: string;
}

export interface DiarySummary {
  entryCount: number;
  distinctDates: string[];
  metricName: string | null;
  unit: string | null;
  totalValue: number | null;
  averageValue: number | null;
  baselineAverage: number | null;
  changedAverage: number | null;
  baselineRuleVersion: number | null;
  changedRuleVersion: number | null;
  ruleChangeDate: string | null;
  ruleChangeReason: string | null;
}

export interface CreatePlanInput {
  workspaceId: string;
  title: string;
  startDate: string;
  endDate: string;
  priority: number;
  successCriteria: string;
  estimatedMinutes: number;
}

export interface UpdatePlanInput {
  title?: string;
  startDate?: string;
  endDate?: string;
  priority?: number;
  successCriteria?: string;
  estimatedMinutes?: number;
  archivedAt?: string | null;
}

export interface CreateTaskInput {
  planId: string;
  title: string;
  dueDate?: string | null;
  priority: number;
  tag: string;
  estimatedMinutes: number;
  status?: TaskStatus;
  blockedReason?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  dueDate?: string | null;
  priority?: number;
  tag?: string;
  estimatedMinutes?: number;
  status?: TaskStatus;
  blockedReason?: string | null;
  completedAt?: string | null;
}

export interface CreateExecutionRecordInput {
  taskId: string;
  startedAt: string;
  endedAt: string;
  missedReason?: string | null;
  idempotencyKey: string;
}

export interface CreateReviewInput {
  planId: string;
  correctionText: string;
  nextPlanId?: string | null;
}

export interface UpdateReviewInput {
  correctionText?: string;
  nextPlanId?: string | null;
}

export interface ReviewMetrics {
  planTaskCount: number;
  completedCount: number;
  delayedCount: number;
  blockedCount: number;
  expectedMinutes: number;
  actualMinutes: number;
  differenceMinutes: number;
  taskIdsByMetric: Record<"plan" | "completed" | "delayed" | "blocked", string[]>;
}

export interface DashboardData {
  workspace: Workspace;
  currentPlan: Plan | null;
  tasks: Task[];
  executionRecords: ExecutionRecord[];
  reviews: Review[];
  metrics: ReviewMetrics;
  diaryEntries: DiaryEntry[];
  diarySummary: DiarySummary;
}
