"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Plan, PlanRevision } from "../../lib/domain/types";
import { PlanRevisionList } from "./PlanRevisionList";

type Props = { plan: Plan | null; workspaceId: string; refreshDashboard: () => Promise<void>; onError: () => void };
type Fields = { title: string; startDate: string; endDate: string; priority: string; successCriteria: string; estimatedMinutes: string };
const blank: Fields = { title: "", startDate: "", endDate: "", priority: "3", successCriteria: "", estimatedMinutes: "0" };
const values = (plan: Plan): Fields => ({ title: plan.title, startDate: plan.startDate, endDate: plan.endDate, priority: String(plan.priority), successCriteria: plan.successCriteria, estimatedMinutes: String(plan.estimatedMinutes) });
const payload = (fields: Fields) => ({ ...fields, priority: Number(fields.priority), estimatedMinutes: Number(fields.estimatedMinutes) });
async function assertOk(response: Response) { if (!response.ok) throw new Error("plan request failed"); }

function PlanFields({ fields, setFields, submitLabel, saving }: { fields: Fields; setFields: (fields: Fields) => void; submitLabel: string; saving: boolean }) {
  const update = (key: keyof Fields, value: string) => setFields({ ...fields, [key]: value });
  return <><label>계획 제목<input value={fields.title} onChange={(e) => update("title", e.target.value)} required /></label><label>시작일<input type="date" value={fields.startDate} onChange={(e) => update("startDate", e.target.value)} required /></label><label>종료일<input type="date" value={fields.endDate} onChange={(e) => update("endDate", e.target.value)} required /></label><label>우선순위<input type="number" min="1" max="5" value={fields.priority} onChange={(e) => update("priority", e.target.value)} required /></label><label>예상 시간(분)<input type="number" min="0" value={fields.estimatedMinutes} onChange={(e) => update("estimatedMinutes", e.target.value)} required /></label><label>성공 기준<textarea value={fields.successCriteria} onChange={(e) => update("successCriteria", e.target.value)} required /></label><button className="primary" disabled={saving} type="submit">{saving ? "저장 중" : submitLabel}</button></>;
}

export function PlanPanel({ plan, workspaceId, refreshDashboard, onError }: Props) {
  if (!plan) return <PlanCreator workspaceId={workspaceId} refreshDashboard={refreshDashboard} onError={onError} />;
  return <PlanEditor key={plan.id} plan={plan} refreshDashboard={refreshDashboard} onError={onError} />;
}

function PlanCreator({ workspaceId, refreshDashboard, onError }: Omit<Props, "plan">) {
  const [fields, setFields] = useState<Fields>(blank); const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); try { const response = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload(fields), workspaceId }) }); await assertOk(response); await refreshDashboard(); } catch { onError(); } finally { setSaving(false); } };
  return <section className="panel" aria-labelledby="plan-heading"><h2 id="plan-heading">Plan · 현재 계획</h2><p>현재 계획이 없습니다. 새 계획을 만들어 시작하세요.</p><form onSubmit={submit} className="form-grid" aria-label="새 계획 양식"><PlanFields fields={fields} setFields={setFields} submitLabel="계획 만들기" saving={saving} /></form></section>;
}

function PlanEditor({ plan, refreshDashboard, onError }: Omit<Props, "workspaceId" | "plan"> & { plan: Plan }) {
  const [editing, setEditing] = useState(false); const [fields, setFields] = useState<Fields>(() => values(plan)); const [revisions, setRevisions] = useState<PlanRevision[]>([]); const [saving, setSaving] = useState(false);
  const loadRevisions = useCallback(async () => { const response = await fetch(`/api/plans/${plan.id}/revisions`); await assertOk(response); setRevisions(await response.json() as PlanRevision[]); }, [plan.id]);
  useEffect(() => { void Promise.resolve().then(loadRevisions).catch(onError); }, [loadRevisions, onError]);
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); try { const response = await fetch(`/api/plans/${plan.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(fields)) }); await assertOk(response); await refreshDashboard(); await loadRevisions(); setEditing(false); } catch { onError(); } finally { setSaving(false); } };
  return <section className="panel" aria-labelledby="plan-heading"><h2 id="plan-heading">Plan · 현재 계획</h2><div className="current-value"><strong>{plan.title}</strong><p>기간 {plan.startDate} ~ {plan.endDate} · 우선순위 {plan.priority} · 예상 {plan.estimatedMinutes}분</p><p>{plan.successCriteria}</p></div><button className="secondary" type="button" onClick={() => { setFields(values(plan)); setEditing((value) => !value); }} aria-expanded={editing} aria-label="현재 계획 수정 양식 열기">계획 수정</button>{editing && <form onSubmit={submit} className="form-grid" aria-label="계획 수정 양식"><PlanFields fields={fields} setFields={setFields} submitLabel="계획 저장" saving={saving} /></form>}<PlanRevisionList revisions={revisions} /></section>;
}
