"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardData } from "../../lib/domain/types";
import { PlanPanel } from "../plan/PlanPanel";
import { TaskPanel } from "../tasks/TaskPanel";
import { ErrorMessage } from "../shared/ErrorMessage";
import { LoadingState } from "../shared/LoadingState";
import { PublicNotice } from "../shared/PublicNotice";
import { MetricButton } from "./MetricButton";
import { ReviewPanel } from "../review/ReviewPanel";
import { ExportButton } from "../export/ExportButton";

type MetricKey = "plan" | "completed" | "delayed" | "blocked";

function RealDataChecklist({ data }: { data: DashboardData }) {
  const items = [
    ["계획 1개", data.currentPlan !== null],
    ["할 일 5개", data.tasks.length >= 5],
    ["실제 실행 기록 3건", data.executionRecords.length >= 3],
  ] as const;

  return <section className="setup-checklist" aria-labelledby="setup-checklist-heading"><h2 id="setup-checklist-heading">실제 데이터 입력 확인</h2><p className="muted">현재 대시보드에 저장된 데이터만 표시합니다. 실행 기록은 실제 활동 후 입력하세요.</p><ul>{items.map(([label, complete]) => <li key={label}>{complete ? "완료" : "필요"}: {label}</li>)}</ul></section>;
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(false); const [metric, setMetric] = useState<MetricKey | null>(null); const [reviewTaskIds, setReviewTaskIds] = useState<string[] | null>(null);
  const refreshDashboard = useCallback(async () => { setLoading(true); setError(false); try { const response = await fetch("/api/dashboard"); if (!response.ok) throw new Error("dashboard request failed"); setData(await response.json() as DashboardData); } catch { setError(true); } finally { setLoading(false); } }, []);
  useEffect(() => { void Promise.resolve().then(refreshDashboard); }, [refreshDashboard]);
  const showError = useCallback(() => setError(true), []);
  const metricIds = reviewTaskIds ?? (metric ? data?.metrics.taskIdsByMetric[metric] ?? null : null);
  const selectMetric = (key: MetricKey) => { setReviewTaskIds(null); setMetric(key); };
  return <div className="dashboard"><p className="eyebrow">Plan · Do · See</p><h1>Post-training Research Engineer 지원 준비</h1><PublicNotice />{loading && <LoadingState />}{error && <ErrorMessage onRetry={() => void refreshDashboard()} />}{data && <><nav className="progress" aria-label="Plan Do See 단계"><span>Plan · 계획</span><span>Do · 실행</span><span>See · 돌아보기</span></nav><RealDataChecklist data={data} /><section aria-label="현재 계획 지표"><div className="metrics"><MetricButton label="계획" value={data.metrics.planTaskCount} active={metric === "plan"} onClick={() => selectMetric("plan")} /><MetricButton label="완료" value={data.metrics.completedCount} active={metric === "completed"} onClick={() => selectMetric("completed")} /><MetricButton label="지연" value={data.metrics.delayedCount} active={metric === "delayed"} onClick={() => selectMetric("delayed")} /><MetricButton label="막힘" value={data.metrics.blockedCount} active={metric === "blocked"} onClick={() => selectMetric("blocked")} /></div><p className="muted">예상 {data.metrics.expectedMinutes}분 · 실제 {data.metrics.actualMinutes}분 · 차이 {data.metrics.differenceMinutes}분</p></section><div className="layout"><PlanPanel plan={data.currentPlan} workspaceId={data.workspace.id} refreshDashboard={refreshDashboard} onError={showError} /><TaskPanel planId={data.currentPlan?.id ?? null} tasks={data.tasks} refreshDashboard={refreshDashboard} onError={showError} metricTaskIds={metricIds} /></div><ReviewPanel plan={data.currentPlan} workspaceId={data.workspace.id} tasks={data.tasks} refreshDashboard={refreshDashboard} onDrillDown={setReviewTaskIds} /><ExportButton /></>}</div>;
}
