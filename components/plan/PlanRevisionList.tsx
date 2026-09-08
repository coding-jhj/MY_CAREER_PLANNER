import type { PlanRevision } from "../../lib/domain/types";

export function PlanRevisionList({ revisions }: { revisions: PlanRevision[] }) {
  return <section aria-labelledby="revision-heading"><h3 id="revision-heading">수정 이력</h3>{revisions.length === 0 ? <p className="muted">아직 이전 수정본이 없습니다.</p> : <ol className="revision-list">{revisions.map((revision) => <li key={`${revision.id}-${revision.revisionNo}`}><strong>이전 값 #{revision.revisionNo}: {revision.title}</strong><div className="task-meta">기간 {revision.startDate} ~ {revision.endDate} · 우선순위 {revision.priority} · 예상 {revision.estimatedMinutes}분</div><p>{revision.successCriteria}</p></li>)}</ol>}</section>;
}
