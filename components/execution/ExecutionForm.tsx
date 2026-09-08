"use client";

import { FormEvent, useState } from "react";
import type { ExecutionRecord, Task } from "../../lib/domain/types";

type Props = {
  task: Task;
  mode: "record" | "complete";
  idempotencyKey: string;
  onSaved: (record: ExecutionRecord) => Promise<void> | void;
  onCancel: () => void;
};

function seoulLocalToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("올바른 서울 시간을 입력해 주세요.");
  return `${value}:00+09:00`;
}

async function errorMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") return body.error;
  return "저장하지 못했습니다. 입력을 확인한 뒤 다시 시도해 주세요.";
}

export function ExecutionForm({ task, mode, idempotencyKey, onSaved, onCancel }: Props) {
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");
  const [missedReason, setMissedReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<ExecutionRecord | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}/${mode === "complete" ? "complete" : "executions"}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startedAt: seoulLocalToIso(startedAt), endedAt: seoulLocalToIso(endedAt), missedReason: missedReason.trim() || null, idempotencyKey }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const record = await response.json() as ExecutionRecord;
      setSaved(record);
      await onSaved(record);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "저장하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (saved) return <p className="saved-result" role="status">실행 기록을 저장했습니다. 서버 계산 실제 소요 시간: {saved.actualMinutes}분</p>;
  const action = mode === "complete" ? "완료 저장" : "실행 기록 저장";
  return <form className="completion-form form-grid" onSubmit={(event) => void submit(event)} aria-label={`${task.title} ${mode === "complete" ? "완료 시간 기록" : "실행 시간 기록"}`}>
    <p className="form-note">입력한 시간은 Asia/Seoul (+09:00) 기준으로 서버에 전달되며, 실제 소요 시간은 서버가 계산합니다.</p>
    <label>시작 시각<input type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} required disabled={submitting} /></label>
    <label>종료 시각<input type="datetime-local" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} required disabled={submitting} /></label>
    <label className="full-width">문제·미실행 이유 (선택)<textarea value={missedReason} onChange={(event) => setMissedReason(event.target.value)} disabled={submitting} /></label>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <button className="primary" type="submit" disabled={submitting}>{submitting ? "저장 중…" : action}</button>
    <button className="secondary" type="button" onClick={onCancel} disabled={submitting}>취소</button>
  </form>;
}
