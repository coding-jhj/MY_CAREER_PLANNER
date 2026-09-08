"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarBlank,
  ChartLineUp,
  CheckCircle,
  Circle,
  Clock,
  DownloadSimple,
  House,
  ListChecks,
  NotePencil,
  Play,
  Plus,
  Sparkle,
  Target,
  UserCircle,
} from "@phosphor-icons/react";
import type { DashboardData, Task } from "../../lib/domain/types";
import { PlanPanel } from "../plan/PlanPanel";
import { TaskPanel } from "../tasks/TaskPanel";
import { ErrorMessage } from "../shared/ErrorMessage";
import { LoadingState } from "../shared/LoadingState";
import { PublicNotice } from "../shared/PublicNotice";
import { MetricButton } from "./MetricButton";
import { ReviewPanel } from "../review/ReviewPanel";
import { ExportButton } from "../export/ExportButton";

type MetricKey = "plan" | "completed" | "delayed" | "blocked";
type ViewKey = "today" | "plan" | "execute" | "review";

const navigation: Array<{ key: ViewKey; label: string; description: string; icon: typeof House }> = [
  { key: "today", label: "오늘", description: "오늘의 흐름", icon: House },
  { key: "plan", label: "계획", description: "목표와 기준", icon: CalendarBlank },
  { key: "execute", label: "실행", description: "할 일과 기록", icon: Play },
  { key: "review", label: "회고", description: "결과와 다음 계획", icon: NotePencil },
];

const viewCopy: Record<ViewKey, { kicker: string; title: string; description: string }> = {
  today: { kicker: "MY DAY", title: "오늘의 커리어 플래너", description: "오늘 해야 할 한 가지부터 차분하게 시작해요." },
  plan: { kicker: "PLAN", title: "계획", description: "이번 기간에 집중할 목표와 성공 기준을 정합니다." },
  execute: { kicker: "DO", title: "실행", description: "계획한 일을 실제 기록으로 바꿉니다." },
  review: { kicker: "SEE", title: "회고", description: "예상과 실제를 비교하고 다음 계획에 반영합니다." },
};

const horizonItems = [
  ["10년", "AI 연구 리더"],
  ["5년", "주요 연구 성과"],
  ["3년", "Post-training 전문성"],
  ["1년", "실전 프로젝트"],
  ["6개월", "핵심 스킬 강화"],
  ["이번 달", "작은 실험"],
  ["이번 주", "오늘의 루틴"],
] as const;

function formatDate(value: string | null | undefined): string {
  if (!value) return "일정 미정";
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" }).format(new Date(`${value}T00:00:00+09:00`));
}

function formatToday(): string {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" }).format(new Date());
}

function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const target = new Date(`${value}T00:00:00+09:00`).getTime();
  const now = new Date();
  const today = new Date(`${now.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })}T00:00:00+09:00`).getTime();
  return Math.max(0, Math.ceil((target - today) / 86_400_000));
}

function getFocusTask(tasks: Task[]): Task | null {
  return tasks.find((task) => task.status !== "done") ?? tasks[0] ?? null;
}

function taskStatusLabel(status: Task["status"]): string {
  if (status === "done") return "완료";
  if (status === "in_progress") return "진행 중";
  return "할 일";
}

function RealDataChecklist({ data }: { data: DashboardData }) {
  const items = [
    ["계획 1개", data.currentPlan !== null],
    ["할 일 5개", data.tasks.length >= 5],
    ["실제 실행 기록 3건", data.executionRecords.length >= 3],
  ] as const;
  const completeCount = items.filter(([, complete]) => complete).length;

  return (
    <details className="data-health">
      <summary>
        <span><CheckCircle weight="fill" aria-hidden="true" /> 데이터 연결 상태</span>
        <strong>{completeCount}/3 확인</strong>
      </summary>
      <div className="data-health-body">
        <p>현재 대시보드에 저장된 실제 데이터만 표시합니다.</p>
        <ul className="setup-checklist-list">
          {items.map(([label, complete]) => (
            <li key={label} className={complete ? "is-complete" : "is-pending"}>
              <CheckCircle weight={complete ? "fill" : "regular"} aria-hidden="true" />
              <span>{complete ? "완료" : "필요"}: {label}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function ProgressSummary({ data, progress, metric, onMetric }: { data: DashboardData; progress: number; metric: MetricKey | null; onMetric: (key: MetricKey) => void }) {
  return (
    <aside className="progress-module" aria-labelledby="progress-heading">
      <div className="module-heading">
        <div>
          <span className="section-kicker">THIS WEEK</span>
          <h2 id="progress-heading">이번 주 진행률</h2>
        </div>
        <ChartLineUp className="module-heading-icon" aria-hidden="true" />
      </div>
      <div className="progress-total"><strong>{progress}%</strong><span>{data.metrics.completedCount} / {data.tasks.length}개 완료</span></div>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="이번 주 할 일 완료율"><span style={{ width: `${progress}%` }} /></div>
      <p className="module-note">완료한 기록이 쌓일수록 다음 계획이 더 정확해져요.</p>
      <div className="metric-strip" aria-label="실행 지표">
        <MetricButton label="계획" value={data.metrics.planTaskCount} active={metric === "plan"} onClick={() => onMetric("plan")} />
        <MetricButton label="완료" value={data.metrics.completedCount} active={metric === "completed"} onClick={() => onMetric("completed")} />
        <MetricButton label="지연" value={data.metrics.delayedCount} active={metric === "delayed"} onClick={() => onMetric("delayed")} />
        <MetricButton label="막힘" value={data.metrics.blockedCount} active={metric === "blocked"} onClick={() => onMetric("blocked")} />
      </div>
    </aside>
  );
}

function AgendaList({ tasks, onOpenExecute }: { tasks: Task[]; onOpenExecute: () => void }) {
  const agenda = tasks.slice(0, 5);
  return (
    <section className="agenda-module" aria-labelledby="agenda-heading">
      <div className="module-heading">
        <div>
          <span className="section-kicker">UP NEXT</span>
          <h2 id="agenda-heading">이번 주 할 일</h2>
        </div>
        <button className="quiet-button" type="button" onClick={onOpenExecute}>전체 보기 <ArrowRight weight="bold" aria-hidden="true" /></button>
      </div>
      {agenda.length ? (
        <ul className="agenda-list">
          {agenda.map((task) => (
            <li key={task.id} className={task.status === "done" ? "is-done" : ""}>
              <span className="agenda-status" aria-hidden="true">{task.status === "done" ? <CheckCircle weight="fill" /> : <Circle />}</span>
              <span className="agenda-title">{task.title}</span>
              <span className="agenda-tag">{task.tag || "일반"}</span>
              <span className="agenda-time"><Clock aria-hidden="true" /> {task.estimatedMinutes}분</span>
              <span className="agenda-state">{taskStatusLabel(task.status)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state compact-empty"><ListChecks aria-hidden="true" /><p>아직 등록된 할 일이 없어요.</p><button className="secondary" type="button" onClick={onOpenExecute}><Plus aria-hidden="true" /> 할 일 추가</button></div>
      )}
    </section>
  );
}

function TodayView({ data, metric, onMetric, onNavigate }: { data: DashboardData; metric: MetricKey | null; onMetric: (key: MetricKey) => void; onNavigate: (view: ViewKey) => void }) {
  const focusTask = getFocusTask(data.tasks);
  const progress = data.tasks.length ? Math.round((data.metrics.completedCount / data.tasks.length) * 100) : 0;
  const daysToReview = daysUntil(data.currentPlan?.endDate);
  return (
    <div className="today-view">
      <section className="today-intro">
        <div>
          <span className="section-kicker">{data.currentPlan ? "CURRENT PLAN" : "START HERE"}</span>
          <h2>{data.currentPlan?.title ?? "나만의 첫 계획을 만들어보세요"}</h2>
          <p>{data.currentPlan?.successCriteria ?? "목표를 정하고, 오늘의 작은 실행부터 기록해보세요."}</p>
        </div>
        <div className="today-intro-meta"><CalendarBlank aria-hidden="true" /><span>{formatToday()}</span></div>
      </section>

      <section className="today-primary-grid" aria-label="오늘의 핵심 정보">
        <article className="focus-module" aria-labelledby="focus-heading">
          <div className="module-heading">
            <div>
              <span className="section-kicker">FOCUS NOW</span>
              <h2 id="focus-heading">오늘의 한 가지</h2>
            </div>
            <Target className="module-heading-icon" aria-hidden="true" />
          </div>
          {focusTask ? (
            <div className="focus-content">
              <div className="focus-icon" aria-hidden="true"><BookOpen weight="duotone" /></div>
              <div className="focus-copy"><span className="task-tag">{focusTask.tag || "우선 실행"}</span><h3>{focusTask.title}</h3><p>{data.currentPlan?.successCriteria ?? "작은 결과를 남기며 오늘의 실행을 완성해보세요."}</p><div className="focus-meta"><span><Clock aria-hidden="true" /> 예상 {focusTask.estimatedMinutes}분</span><span><CalendarBlank aria-hidden="true" /> {focusTask.dueDate ? formatDate(focusTask.dueDate) : "오늘 시작"}</span></div></div>
              <button className="primary-button" type="button" onClick={() => onNavigate("execute")}><Play weight="fill" aria-hidden="true" /> 실행 시작 <ArrowRight weight="bold" aria-hidden="true" /></button>
            </div>
          ) : (
            <div className="empty-state"><ListChecks aria-hidden="true" /><h3>오늘의 첫 할 일을 정해볼까요?</h3><p>계획을 만든 뒤 작은 실행 하나를 추가하면 여기서 바로 시작할 수 있어요.</p><button className="primary-button" type="button" onClick={() => onNavigate("plan")}><Plus aria-hidden="true" /> 계획 만들기</button></div>
          )}
        </article>
        <ProgressSummary data={data} progress={progress} metric={metric} onMetric={onMetric} />
      </section>

      <AgendaList tasks={data.tasks} onOpenExecute={() => onNavigate("execute")} />

      <section className="today-secondary-grid" aria-label="다음 행동과 장기 목표">
        <article className="next-review-module">
          <div className="module-heading"><div><span className="section-kicker">NEXT REVIEW</span><h2>다음 계획 점검</h2></div><CalendarBlank className="module-heading-icon" aria-hidden="true" /></div>
          <div className="review-date-line"><strong>{data.currentPlan ? formatDate(data.currentPlan.endDate) : "계획을 먼저 만들어보세요"}</strong>{daysToReview !== null && <span>D-{daysToReview}</span>}</div>
          <p>{data.currentPlan ? "이번 실행을 돌아보고 다음 한 주를 더 잘 설계해요." : "계획이 생기면 다음 점검일을 여기서 확인할 수 있어요."}</p>
          <button className="quiet-button" type="button" onClick={() => onNavigate("review")}>회고 열기 <ArrowRight weight="bold" aria-hidden="true" /></button>
        </article>
        <article className="horizon-mini">
          <div className="module-heading"><div><span className="section-kicker">MY HORIZON</span><h2>나의 커리어 방향</h2></div><button className="quiet-button" type="button" onClick={() => onNavigate("plan")}>자세히 <ArrowRight weight="bold" aria-hidden="true" /></button></div>
          <div className="horizon-mini-track" aria-label="장기 목표 단계">{horizonItems.map(([period, title], index) => <span key={period} className={index === horizonItems.length - 1 ? "is-current" : ""}><strong>{period}</strong><small>{title}</small></span>)}</div>
        </article>
      </section>

      <section className="today-utilities" aria-label="보조 기능">
        <RealDataChecklist data={data} />
        <div className="export-module"><div><span className="section-kicker">TAKE IT WITH YOU</span><strong>기록을 내보내기</strong><p>현재 계획과 실행 기록을 JSON으로 저장합니다.</p></div><DownloadSimple aria-hidden="true" /><ExportButton /></div>
      </section>
    </div>
  );
}

function PlanView({ data, refreshDashboard, onError }: { data: DashboardData; refreshDashboard: () => Promise<void>; onError: () => void }) {
  const progress = data.tasks.length ? Math.round((data.metrics.completedCount / data.tasks.length) * 100) : 0;
  return <div className="workspace-view plan-view"><div className="workspace-grid"><PlanPanel plan={data.currentPlan} workspaceId={data.workspace.id} refreshDashboard={refreshDashboard} onError={onError} /><aside className="workspace-aside"><div className="aside-card aside-card--accent"><span className="section-kicker">PLAN HEALTH</span><strong>{progress}%</strong><p>현재 계획의 실행 완료율</p><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div><div className="aside-card"><span className="section-kicker">MY HORIZON</span><h2>나의 커리어 방향</h2><div className="horizon-list">{horizonItems.map(([period, title], index) => <div key={period} className={index === horizonItems.length - 1 ? "is-current" : ""}><strong>{period}</strong><span>{title}</span></div>)}</div></div></aside></div></div>;
}

function ExecuteView({ data, refreshDashboard, onError, metricTaskIds }: { data: DashboardData; refreshDashboard: () => Promise<void>; onError: () => void; metricTaskIds: string[] | null }) {
  return <div className="workspace-view execute-view"><div className="workspace-grid workspace-grid--execute"><TaskPanel planId={data.currentPlan?.id ?? null} tasks={data.tasks} refreshDashboard={refreshDashboard} onError={onError} metricTaskIds={metricTaskIds} /><aside className="workspace-aside"><div className="aside-card aside-card--accent"><span className="section-kicker">DO IT GENTLY</span><h2>한 번에 하나씩</h2><p>완벽하게 끝내려 하기보다, 시작과 실제 시간을 기록하는 데 집중해요.</p><button className="quiet-button" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>맨 위로 <ArrowRight weight="bold" aria-hidden="true" /></button></div><div className="aside-card"><span className="section-kicker">TODAY&apos;S SIGNAL</span><div className="aside-stat"><strong>{data.metrics.completedCount}</strong><span>완료한 할 일</span></div><div className="aside-stat"><strong>{data.metrics.actualMinutes}분</strong><span>실제로 기록한 시간</span></div></div></aside></div></div>;
}

function ReviewView({ data, refreshDashboard, onError, reviewTaskIds, onDrillDown }: { data: DashboardData; refreshDashboard: () => Promise<void>; onError: () => void; reviewTaskIds: string[] | null; onDrillDown: (ids: string[] | null) => void }) {
  return <div className="workspace-view review-view"><div className="workspace-grid workspace-grid--review"><ReviewPanel plan={data.currentPlan} workspaceId={data.workspace.id} tasks={data.tasks} refreshDashboard={refreshDashboard} onDrillDown={onDrillDown} />{reviewTaskIds && <TaskPanel planId={data.currentPlan?.id ?? null} tasks={data.tasks} refreshDashboard={refreshDashboard} onError={onError} metricTaskIds={reviewTaskIds} compact />}</div></div>;
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [metric, setMetric] = useState<MetricKey | null>(null);
  const [reviewTaskIds, setReviewTaskIds] = useState<string[] | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>("today");

  const refreshDashboard = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/dashboard");
      if (!response.ok) throw new Error("dashboard request failed");
      setData(await response.json() as DashboardData);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(refreshDashboard); }, [refreshDashboard]);

  const showError = useCallback(() => setError(true), []);
  const focusMetricIds = metric ? data?.metrics.taskIdsByMetric[metric] ?? null : null;
  const metricIds = reviewTaskIds ?? focusMetricIds;
  const page = viewCopy[activeView];

  const navigate = useCallback((view: ViewKey) => {
    setActiveView(view);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const selectMetric = (key: MetricKey) => {
    setReviewTaskIds(null);
    setMetric(key);
    navigate("execute");
  };

  const handleReviewDrillDown = useCallback((ids: string[] | null) => {
    setReviewTaskIds(ids);
    setMetric(null);
  }, []);

  return (
    <div className="planner-app">
      <header className="planner-header">
        <button className="brand" type="button" onClick={() => navigate("today")} aria-label="MY CAREER PLANNER 오늘 화면으로 이동">
          <span className="brand-mark" aria-hidden="true"><Sparkle weight="fill" /></span>
          <span className="brand-copy"><strong>MY CAREER PLANNER</strong><small>career OS</small></span>
        </button>
        <div className="header-context"><span className="header-context-dot" aria-hidden="true" /><span>공개 작업공간</span><span className="header-context-separator">·</span><span>나의 기록을 쌓는 중</span></div>
        <div className="header-actions"><ExportButton /><span className="avatar" aria-hidden="true"><UserCircle weight="fill" /></span></div>
      </header>

      <div className="planner-frame">
        <aside className="sidebar" aria-label="플래너 메뉴">
          <div className="sidebar-intro"><span className="section-kicker">MY SPACE</span><p>오늘의 작은 실행을<br />나의 방향과 연결해요.</p></div>
          <nav className="sidebar-nav">
            {navigation.map(({ key, label, description, icon: Icon }) => <button key={key} className={activeView === key ? "is-active" : ""} type="button" onClick={() => navigate(key)} aria-label={`${label} ${description}`} aria-current={activeView === key ? "page" : undefined}><span className="sidebar-nav-icon"><Icon weight={activeView === key ? "fill" : "regular"} aria-hidden="true" /></span><span><strong>{label}</strong><small>{description}</small></span></button>)}
          </nav>
          <div className="sidebar-bottom"><div className="sidebar-status"><Circle weight="fill" aria-hidden="true" /><span>공개 작업공간</span></div><p>로그인 없이 사용하는<br />개인 커리어 기록장</p></div>
        </aside>

        <main className="planner-main">
          <div className="page-heading"><div><span className="section-kicker">{page.kicker}</span><h1>{page.title}</h1><p>{page.description}</p></div><div className="page-heading-date"><CalendarBlank aria-hidden="true" /><span>{formatToday()}</span></div></div>
          {activeView === "today" && <PublicNotice />}
          {loading && <LoadingState />}
          {error && <ErrorMessage onRetry={() => void refreshDashboard()} />}
          {data && activeView === "today" && <TodayView data={data} metric={metric} onMetric={selectMetric} onNavigate={navigate} />}
          {data && activeView === "plan" && <PlanView data={data} refreshDashboard={refreshDashboard} onError={showError} />}
          {data && activeView === "execute" && <ExecuteView data={data} refreshDashboard={refreshDashboard} onError={showError} metricTaskIds={metricIds} />}
          {data && activeView === "review" && <ReviewView data={data} refreshDashboard={refreshDashboard} onError={showError} reviewTaskIds={reviewTaskIds} onDrillDown={handleReviewDrillDown} />}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="모바일 플래너 메뉴">
        {navigation.map(({ key, label, icon: Icon }) => <button key={key} className={activeView === key ? "is-active" : ""} type="button" onClick={() => navigate(key)} aria-current={activeView === key ? "page" : undefined}><Icon weight={activeView === key ? "fill" : "regular"} aria-hidden="true" /><span>{label}</span></button>)}
      </nav>
    </div>
  );
}
