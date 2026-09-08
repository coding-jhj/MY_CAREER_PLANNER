import type { Task } from "../../lib/domain/types";

export function ReviewDetailList({ taskIds, tasks }: { taskIds: string[] | null; tasks: Task[] }) {
  if (!taskIds) return null;
  const sources = tasks.filter((task) => taskIds.includes(task.id));
  return <section className="review-details" aria-live="polite" aria-label="지표 원본 할 일">
    <h3>지표 원본 할 일</h3>
    {sources.length ? <ul className="revision-list">{sources.map((task) => <li key={task.id}><strong>{task.title}</strong><span className="muted"> · {task.id}</span></li>)}</ul> : <p className="muted">이 지표에 해당하는 할 일이 없습니다.</p>}
  </section>;
}
