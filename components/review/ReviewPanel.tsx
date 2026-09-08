"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Plan, ReviewMetrics, Task } from "../../lib/domain/types";
import { ReviewDetailList } from "./ReviewDetailList";

type MetricKey = "plan" | "completed" | "delayed" | "blocked" | "expected" | "actual" | "difference";
type ReviewData = { metrics: ReviewMetrics };

const labels: Record<MetricKey, string> = { plan: "계획", completed: "완료", delayed: "지연", blocked: "막힘", expected: "예상", actual: "실제", difference: "차이" };

function sourceIds(metrics: ReviewMetrics, key: MetricKey): string[] {
  return key === "plan" || key === "completed" || key === "delayed" || key === "blocked"
    ? metrics.taskIdsByMetric[key] : metrics.taskIdsByMetric.plan;
}

export function ReviewPanel({ plan, workspaceId, tasks, onDrillDown, refreshDashboard }: { plan: Plan | null; workspaceId: string; tasks: Task[]; onDrillDown: (ids: string[] | null) => void; refreshDashboard: () => Promise<void> }) {
  const [data, setData] = useState<ReviewData | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [selected, setSelected] = useState<MetricKey | null>(null);
  const [correctionText, setCorrectionText] = useState(""); const [nextTitle, setNextTitle] = useState(""); const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState(""); const [successCriteria, setSuccessCriteria] = useState(""); const [priority, setPriority] = useState("1"); const [estimatedMinutes, setEstimatedMinutes] = useState("0"); const [saving, setSaving] = useState(false); const [nextPlanId, setNextPlanId] = useState<string | null>(null);
  const load = useCallback(async (): Promise<ReviewData | null> => {
    if (!plan) return null;
    setLoading(true); setError(null);
    try { const result = await fetch(`/api/reviews/${plan.id}`); if (!result.ok) throw new Error("돌아보기 정보를 불러오지 못했습니다."); const response = await result.json() as ReviewData; setData(response); return response; }
    catch (caught) { setError(caught instanceof Error ? caught.message : "돌아보기 정보를 불러오지 못했습니다."); return null; } finally { setLoading(false); }
  }, [plan]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useEffect(() => { void Promise.resolve().then(() => { setData(null); setSelected(null); onDrillDown(null); }); }, [plan?.id, onDrillDown]);
  const chooseMetric = async (key: MetricKey) => { const current = await load(); if (!current) return; setSelected(key); onDrillDown(sourceIds(current.metrics, key)); };
  const saveCorrection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!plan || !correctionText.trim()) { setError("개선점을 입력해 주세요."); return; }
    setSaving(true); setError(null); setNextPlanId(null);
    try {
      const response = await fetch(`/api/reviews/${plan.id}/corrections`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correctionText: correctionText.trim(), nextPlan: { workspaceId, title: nextTitle, startDate, endDate, priority: Number(priority), successCriteria, estimatedMinutes: Number(estimatedMinutes) } }) });
      if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string } | null; throw new Error(body?.error ?? "개선점을 다음 계획으로 넘기지 못했습니다."); }
      const saved = await response.json() as { review: { nextPlanId: string | null }; nextPlan: Plan | null };
      setNextPlanId(saved.nextPlan?.id ?? saved.review.nextPlanId); setCorrectionText(""); await refreshDashboard(); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "개선점을 다음 계획으로 넘기지 못했습니다."); } finally { setSaving(false); }
  };
  if (!plan) return <section className="panel" aria-labelledby="see-heading"><h2 id="see-heading">See · 돌아보기</h2><p>계획을 만든 뒤 돌아보기를 시작할 수 있습니다.</p></section>;
  const metrics = data?.metrics;
  const values: Array<[MetricKey, string]> = metrics ? [["plan", `${metrics.planTaskCount}개`], ["completed", `${metrics.completedCount}개`], ["delayed", `${metrics.delayedCount}개`], ["blocked", `${metrics.blockedCount}개`], ["expected", `${metrics.expectedMinutes}분`], ["actual", `${metrics.actualMinutes}분`], ["difference", `${metrics.differenceMinutes}분`]] : [];
  return <section className="panel" aria-labelledby="see-heading"><h2 id="see-heading">See · 돌아보기</h2><p>지표를 누르면 서버에서 원본 할 일 ID를 다시 확인해 할 일 목록을 강조합니다.</p>{loading && <p role="status">돌아보기 정보를 불러오는 중…</p>}{error && <p className="inline-error" role="alert">{error}</p>}{metrics && <div className="review-metrics">{values.map(([key, value]) => <button key={key} className="metric-button" type="button" onClick={() => void chooseMetric(key)} aria-pressed={selected === key} aria-label={`${labels[key]} ${value} 원본 할 일 보기`}><span>{labels[key]}</span><span className="metric-number">{value}</span></button>)}</div>}<ReviewDetailList taskIds={selected && metrics ? sourceIds(metrics, selected) : null} tasks={tasks} /><form className="form-grid correction-form" onSubmit={(event) => void saveCorrection(event)} aria-label="개선점 다음 계획 반영"><h3>개선점 다음 계획으로 넘기기</h3><label className="full-width">개선점<textarea value={correctionText} onChange={(event) => setCorrectionText(event.target.value)} required disabled={saving} /></label><p className="form-note">다음 계획의 값은 직접 입력합니다. 기록되지 않은 활동이나 시간을 자동으로 만들지 않습니다.</p><label>다음 계획 제목<input value={nextTitle} onChange={(event) => setNextTitle(event.target.value)} required disabled={saving} /></label><label>다음 계획 시작일<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required disabled={saving} /></label><label>다음 계획 종료일<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required disabled={saving} /></label><label>우선순위<select value={priority} onChange={(event) => setPriority(event.target.value)} disabled={saving}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>예상 시간(분)<input type="number" min="0" value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(event.target.value)} required disabled={saving} /></label><label className="full-width">다음 계획 성공 기준<textarea value={successCriteria} onChange={(event) => setSuccessCriteria(event.target.value)} required disabled={saving} /></label><button className="primary" type="submit" disabled={saving}>{saving ? "저장 중…" : "다음 계획으로 넘기기"}</button></form>{nextPlanId && <p className="saved-result" role="status">개선점을 다음 계획에 반영했습니다. <a href={`#plan-${nextPlanId}`}>다음 계획 보기</a></p>}</section>;
}
