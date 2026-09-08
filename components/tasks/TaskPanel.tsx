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

export function TaskPanel({ planId, tasks: dashboardTasks, refreshDashboard, onError, metricTaskIds }: { planId: string | null; tasks: Task[]; refreshDashboard: () => Promise<void>; onError: () => void; metricTaskIds: string[] | null }) {
  const [filters, setFilters] = useState(initialFilters); const [tasks, setTasks] = useState<Task[]>(dashboardTasks); const [editing, setEditing] = useState<string | null>(null); const [openForm, setOpenForm] = useState<OpenForm | null>(null); const [actionError, setActionError] = useState<string | null>(null);
  const loadTasks = useCallback(async () => { if (!planId) return; const params = new URLSearchParams({ sort: filters.sort, direction: filters.direction }); if (filters.q) params.set("q", filters.q); if (filters.status) params.set("status", filters.status); if (filters.tag) params.set("tag", filters.tag); if (filters.priority) params.set("priority", filters.priority); const response = await fetch(`/api/tasks?planId=${encodeURIComponent(planId)}&${params}`); if (!response.ok) throw new Error("task list request failed"); setTasks(await response.json() as Task[]); }, [filters, planId]);
  useEffect(() => { if (!metricTaskIds) void Promise.resolve().then(loadTasks).catch(onError); }, [metricTaskIds, loadTasks, onError]);
  const saved = async () => { await refreshDashboard(); await loadTasks(); setEditing(null); };
  const remove = async (taskId: string) => { try { setActionError(null); const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" }); if (!response.ok) throw new Error(); await saved(); } catch { setActionError("삭제하지 못했습니다. 다시 시도해 주세요."); onError(); } };
  const reopen = async (taskId: string) => { try { setActionError(null); const response = await fetch(`/api/tasks/${taskId}/reopen`, { method: "POST" }); if (!response.ok) throw new Error(); await saved(); } catch { setActionError("되돌리지 못했습니다. 기존 실행 기록은 보존됩니다."); onError(); } };
  const openExecution = (taskId: string, mode: OpenForm["mode"]) => { try { setActionError(null); setOpenForm({ taskId, mode, idempotencyKey: createIdempotencyKey() }); } catch { setActionError("안전한 요청 키를 만들지 못했습니다. 다시 시도해 주세요."); } };
  const executionSaved = async (_record: ExecutionRecord) => { await saved(); setOpenForm(null); };
  const visibleTasks = metricTaskIds ? dashboardTasks.filter((task) => metricTaskIds.includes(task.id)) : tasks;
  return <section className="panel" aria-labelledby="task-heading"><h2 id="task-heading">Do · 할 일 관리</h2>{!planId ? <p>계획을 불러온 뒤 할 일을 관리할 수 있습니다.</p> : <><TaskForm planId={planId} onSave={saved} onError={onError} /><TaskToolbar filters={filters} setFilters={setFilters} /><p className="muted">현재 정렬: {filters.sort} · {filters.direction}{metricTaskIds ? " · 돌아보기 지표 원본만 표시" : ""}</p>{actionError && <p className="inline-error" role="alert">{actionError}</p>}<ul className="task-list">{visibleTasks.map((task) => <li key={task.id} className={metricTaskIds?.includes(task.id) ? "highlighted-task" : ""}><div className="task-heading"><strong>{task.title}</strong><span className="status">{task.status === "todo" ? "할 일" : task.status === "in_progress" ? "진행 중" : "완료"}</span></div><div className="task-meta">마감 {task.dueDate ?? "없음"} · 우선순위 {task.priority} · {task.tag} · 예상 {task.estimatedMinutes}분</div>{task.blockedReason && <p>막힘: {task.blockedReason}</p>}<div className="task-actions">{task.status !== "done" && <><button className="secondary" type="button" onClick={() => openExecution(task.id, "record")} aria-label={`${task.title} 실행 기록 열기`}>실행 기록</button><button className="primary" type="button" onClick={() => openExecution(task.id, "complete")} aria-label={`${task.title} 완료 기록 열기`}>완료 기록</button></>}{task.status === "done" && <button className="secondary" type="button" onClick={() => void reopen(task.id)} aria-label={`${task.title} 진행 중으로 되돌리기`}>되돌리기</button>}<button className="secondary" type="button" onClick={() => setEditing(task.id)} aria-label={`${task.title} 수정`}>수정</button><button className="danger" type="button" onClick={() => void remove(task.id)} aria-label={`${task.title} 삭제`}>삭제</button></div>{editing === task.id && <TaskForm key={task.id} planId={planId} task={task} onSave={saved} onError={onError} />}{openForm?.taskId === task.id && <ExecutionForm task={task} mode={openForm.mode} idempotencyKey={openForm.idempotencyKey} onSaved={executionSaved} onCancel={() => setOpenForm(null)} />}</li>)}</ul>{visibleTasks.length === 0 && <p className="muted">조건에 맞는 할 일이 없습니다.</p>}</>}</section>;
}
