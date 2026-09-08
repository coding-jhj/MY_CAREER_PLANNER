"use client";

import { FormEvent, useState } from "react";

function todaySeoul(): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function DiaryEntryForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [recordDate, setRecordDate] = useState(todaySeoul);
  const [question, setQuestion] = useState("");
  const [metricName, setMetricName] = useState("");
  const [unit, setUnit] = useState("");
  const [value, setValue] = useState("");
  const [calculationRule, setCalculationRule] = useState("");
  const [planRuleVersion, setPlanRuleVersion] = useState("1");
  const [planRule, setPlanRule] = useState("");
  const [ruleChangeReason, setRuleChangeReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordDate, question, metricName, unit, value: Number(value), calculationRule,
          planRuleVersion: Number(planRuleVersion), planRule,
          ruleChangeReason: ruleChangeReason.trim() || null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "기록을 저장하지 못했습니다.");
      }
      setQuestion(""); setMetricName(""); setUnit(""); setValue(""); setCalculationRule(""); setPlanRule(""); setRuleChangeReason("");
      setOpen(false);
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "기록을 저장하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="diary-form-details" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>직접 하루 기록 추가</summary>
      <form className="diary-form" onSubmit={submit}>
        <label>날짜<input type="date" value={recordDate} onChange={(event) => setRecordDate(event.target.value)} required /></label>
        <label>질문<input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="오늘 확인할 질문" required /></label>
        <label>지표명<input value={metricName} onChange={(event) => setMetricName(event.target.value)} placeholder="예: 집중 시간" required /></label>
        <label>단위<input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="예: 분, 점" required /></label>
        <label>값<input type="number" step="any" value={value} onChange={(event) => setValue(event.target.value)} required /></label>
        <label>규칙 버전<input type="number" min="1" step="1" value={planRuleVersion} onChange={(event) => setPlanRuleVersion(event.target.value)} required /></label>
        <label className="diary-form-wide">계산식<input value={calculationRule} onChange={(event) => setCalculationRule(event.target.value)} placeholder="값을 계산한 방법" required /></label>
        <label className="diary-form-wide">계획 규칙<input value={planRule} onChange={(event) => setPlanRule(event.target.value)} placeholder="그날 적용한 계획 규칙" required /></label>
        <label className="diary-form-wide">규칙 변경 사유<input value={ruleChangeReason} onChange={(event) => setRuleChangeReason(event.target.value)} placeholder="변경한 날에만 작성" /></label>
        {error && <p className="diary-error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={pending}>{pending ? "저장 중…" : "기록 저장"}</button>
      </form>
    </details>
  );
}
