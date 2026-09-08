"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutionRecord, Task } from "../../lib/domain/types";
import { ExecutionForm } from "../execution/ExecutionForm";
import { TaskForm } from "./TaskForm";
import { type Filters, TaskToolbar } from "./TaskToolbar";

const initialFilters: Filters = { q: "", status: "", tag: "", priority: "", sort: "priority", direction: "asc" };
type OpenForm = { taskId: string; mode: "record" | "complete"; idempotencyKey: string };

function createIdempotencyKey(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16); if (!globalThis.crypto?.getRandomValues) throw new Error("Secure random values are unavailable"); globalThis.crypto.getRandomValues(bytes); bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function TaskPanel({ planId, tasks: dashboardTasks, refreshDashboard, onError, metricTaskIds, compact = false }: { planId: string | null; tasks: Task[]; refreshDashboard: () => Promise<void>; onError: () => void; metricTaskIds: string[] | null; compact?: boolean }) {
  const [filters, setFilters] = useState(initialFilters); const [tasks, setTasks] = useState<Task[]>(dashboardTasks); const [editing, setEditing] = useState<string | null>(null); const [openForm, setOpenForm] = useState<OpenForm | null>(null); const [actionError, setActionError] = useState<string | null>(null); const [adding, setAdding] = useState(false); const [filtersOpen, setFiltersOpen] = useState(false);
  const loadTasks = useCallback(async () => { if (!planId) return; const params = new URLSearchParams({ sort: filters.sort, direction: filters.direction }); if (filters.q) params.set("q", filters.q); if (filters.status) params.set("status", filters.status); if (filters.tag) params.set("tag", filters.tag); if (filters.priority) params.set("priority", filters.priority); const response = await fetch(`/api/tasks?planId=${encodeURIComponent(planId)}&${params}`); if (!response.ok) throw new Error("task list request failed"); setTasks(await response.json() as Task[]); }, [filters, planId]);
  useEffect(() => { if (!metricTaskIds) void Promise.resolve().then(loadTasks).catch(onError); }, [metricTaskIds, loadTasks, onError]);
  const saved = async () => { await refreshDashboard(); await loadTasks(); setEditing(null); setAdding(false); };
  const remove = async (taskId: string) => { try { setActionError(null); const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" }); if (!response.ok) throw new Error(); await saved(); } catch { setActionError("삭제하지 못했습니다. 다시 시도해 주세요."); onError(); } };
  const reopen = async (taskId: string) => { try { setActionError(null); const response = await fetch(`/api/tasks/${taskId}/reopen`, { method: "POST" }); if (!response.ok) throw new Error(); await saved(); } catch { setActionError("되돌리지 못했습니다. 기존 실행 기록은 보존됩니다."); onError(); } };
  const openExecution = (taskId: string, mode: OpenForm["mode"]) => { try { setActionError(null); setOpenForm({ taskId, mode, idempotencyKey: createIdempotencyKey() }); } catch { setActionError("안전한 요청 키를 만들지 못했습니다. 다시 시도해 주세요."); } };
  const executionSaved = async (_record: ExecutionRecord) => { await saved(); setOpenForm(null); };
  const visibleTasks = metricTaskIds ? dashboardTasks.filter((task) => metricTaskIds.includes(task.id)) : tasks;

  return <section className={`panel task-panel ${compact ? "task-panel--compact" : ""}`} aria-labelledby="task-heading">
    <div className="panel-topbar">
      <div><span className="panel-eyebrow">EXECUTION LOG</span><h2 id="task-heading">실행 목록</h2><p>{compact ? "선택한 지표에 포함된 원본 할 일입니다." : "오늘 할 일을 정리하고 실제로 쓴 시간을 기록해요."}</p></div>
      {!compact && planId && <button className="primary compact-button" type="button" onClick={() => setAdding((value) => !value)}>{adding ? "추가 닫기" : "할 일 추가"}</button>}
    </div>
    {!planId ? <p className="panel-empty-copy">계획을 먼저 만든 뒤 할 일을 관리할 수 있습니다.</p> : <>
      {!compact && adding && <div className="inline-form-panel"><TaskForm planId={planId} onSave={saved} onError={onError} /></div>}
      {!compact && <details className="filter-details" open={filtersOpen} onToggle={(event) => setFiltersOpen(event.currentTarget.open)}><summary><span>검색·필터</span><small>{filters.q || filters.status || filters.tag || filters.priority ? "필터 적용 중" : "필요할 때만 열어보세요"}</small></summary><TaskToolbar filters={filters} setFilters={setFilters} /></details>}
      <p className="muted task-sort-note">현재 정렬: {filters.sort} · {filters.direction}{metricTaskIds ? " · 돌아보기 지표 원본만 표시" : ""}</p>
      {actionError && <p className="inline-error" role="alert">{actionError}</p>}
      <ul className="task-list">{visibleTasks.map((task) => <li key={task.id} className={metricTaskIds?.includes(task.id) ? "highlighted-task" : ""}>
        <div className="task-row-main"><span className={`task-check task-check--${task.status}`} aria-hidden="true">{task.status === "done" ? "✓" : ""}</span><div className="task-row-copy"><div className="task-heading"><strong>{task.title}</strong><span className="status">{task.status === "todo" ? "할 일" : task.status === "in_progress" ? "진행 중" : "완료"}</span></div><div className="task-meta">마감 {task.dueDate ?? "없음"} · 우선순위 {task.priority} · {task.tag} · 예상 {task.estimatedMinutes}분</div>{task.blockedReason && <p>막힘: {task.blockedReason}</p>}</div></div>
        <div className="task-actions">{task.status !== "done" && <><button className="secondary" type="button" onClick={() => openExecution(task.id, "record")} aria-label={`${task.title} 실행 기록 열기`}>실행 기록</button><button className="primary" type="button" onClick={() => openExecution(task.id, "complete")} aria-label={`${task.title} 완료 기록 열기`}>완료 처리</button></>}{task.status === "done" && <button className="secondary" type="button" onClick={() => void reopen(task.id)} aria-label={`${task.title} 진행 중으로 되돌리기`}>되돌리기</button>}<button className="secondary" type="button" onClick={() => setEditing(task.id)} aria-label={`${task.title} 수정`}>수정</button><button className="danger" type="button" onClick={() => void remove(task.id)} aria-label={`${task.title} 삭제`}>삭제</button></div>
        {editing === task.id && <TaskForm key={task.id} planId={planId} task={task} onSave={saved} onError={onError} />}{openForm?.taskId === task.id && <ExecutionForm task={task} mode={openForm.mode} idempotencyKey={openForm.idempotencyKey} onSaved={executionSaved} onCancel={() => setOpenForm(null)} />}
      </li>)}</ul>{visibleTasks.length === 0 && <div className="empty-state compact-empty"><p>조건에 맞는 할 일이 없습니다.</p>{!compact && <button className="secondary" type="button" onClick={() => setAdding(true)}>새 할 일 만들기</button>}</div>}
    </>}
  </section>;
}
