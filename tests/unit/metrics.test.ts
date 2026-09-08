import { describe, expect, it } from "vitest";

import { calculateReviewMetrics } from "../../lib/domain/metrics";
import type { ExecutionRecord, Task } from "../../lib/domain/types";

function task(id: string, overrides: Partial<Task> = {}): Task {
  return { id, planId: "plan-1", title: id, dueDate: null, priority: 1, tag: "research", estimatedMinutes: 60, status: "todo", blockedReason: null, completedAt: null, deletedAt: null, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", ...overrides };
}
function execution(taskId: string, actualMinutes: number): ExecutionRecord {
  return { id: `execution-${taskId}`, taskId, startedAt: "2026-09-01T00:00:00Z", endedAt: "2026-09-01T01:00:00Z", actualMinutes, missedReason: null, idempotencyKey: "00000000-0000-0000-0000-000000000001", createdAt: "2026-09-01T01:00:00Z" };
}

describe("calculateReviewMetrics", () => {
  it("uses non-deleted tasks, Seoul date comparisons, execution totals, and source IDs", () => {
    const metrics = calculateReviewMetrics([
      task("done", { status: "done", dueDate: "2026-09-01" }),
      task("overdue", { dueDate: "2026-09-06" }),
      task("blocked", { blockedReason: " Waiting for access " }),
      task("open"),
      task("deleted", { deletedAt: "2026-09-01T00:00:00Z", estimatedMinutes: 999, status: "done", dueDate: "2026-09-01", blockedReason: "ignored" }),
    ], [execution("done", 120), execution("overdue", 90), execution("deleted", 999)], "2026-09-07");

    expect(metrics.planTaskCount).toBe(4);
    expect(metrics.completedCount).toBe(1);
    expect(metrics.delayedCount).toBe(1);
    expect(metrics.blockedCount).toBe(1);
    expect(metrics.expectedMinutes).toBe(240);
    expect(metrics.actualMinutes).toBe(210);
    expect(metrics.differenceMinutes).toBe(-30);
    expect(metrics.taskIdsByMetric).toEqual({ plan: ["done", "overdue", "blocked", "open"], completed: ["done"], delayed: ["overdue"], blocked: ["blocked"] });
  });
});
