import type { ExecutionRecord, ReviewMetrics, Task } from "./types";

/**
 * Calculates review figures from typed domain records. `currentSeoulDate` must be
 * an ISO calendar date obtained in Asia/Seoul by the server boundary.
 */
export function calculateReviewMetrics(
  tasks: readonly Task[],
  executionRecords: readonly ExecutionRecord[],
  currentSeoulDate: string,
): ReviewMetrics {
  const activeTasks = tasks.filter((task) => task.deletedAt === null);
  const taskIds = new Set(activeTasks.map((task) => task.id));
  const completed = activeTasks.filter((task) => task.status === "done");
  const delayed = activeTasks.filter(
    (task) => task.status !== "done" && task.dueDate !== null && task.dueDate < currentSeoulDate,
  );
  const blocked = activeTasks.filter((task) => (task.blockedReason?.trim() ?? "") !== "");
  const expectedMinutes = activeTasks.reduce((total, task) => total + task.estimatedMinutes, 0);
  const actualMinutes = executionRecords
    .filter((record) => taskIds.has(record.taskId))
    .reduce((total, record) => total + record.actualMinutes, 0);

  return {
    planTaskCount: activeTasks.length,
    completedCount: completed.length,
    delayedCount: delayed.length,
    blockedCount: blocked.length,
    expectedMinutes,
    actualMinutes,
    differenceMinutes: actualMinutes - expectedMinutes,
    taskIdsByMetric: {
      plan: activeTasks.map((task) => task.id),
      completed: completed.map((task) => task.id),
      delayed: delayed.map((task) => task.id),
      blocked: blocked.map((task) => task.id),
    },
  };
}
