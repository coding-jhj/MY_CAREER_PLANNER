"use client";

import { useState } from "react";

import type { DashboardData } from "../../lib/domain/types";
import { DiaryEntryForm } from "./DiaryEntryForm";

export function DiarySummaryPanel({ data, onRefresh }: { data: DashboardData; onRefresh: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const summary = data.diarySummary ?? { entryCount: 0, distinctDates: [], metricName: null, unit: null, totalValue: null, averageValue: null, baselineAverage: null, changedAverage: null, baselineRuleVersion: null, changedRuleVersion: null, ruleChangeDate: null, ruleChangeReason: null };
  const entries = data.diaryEntries ?? [];

  async function createDemoData() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/diary/demo", { method: "POST" });
      if (!response.ok) throw new Error("시연 데이터 생성 기능이 현재 비활성화되어 있습니다.");
      await onRefresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "기록을 만들지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="diary-module" aria-labelledby="diary-heading">
      <div className="module-heading">
        <div><span className="section-kicker">FIVE-DAY SIGNAL</span><h2 id="diary-heading">5일 기록과 계획 규칙</h2></div>
        {summary.entryCount < 5 && <button className="quiet-button" type="button" onClick={() => void createDemoData()} disabled={pending}>{pending ? "생성 중…" : "테스트 기록 채우기"}</button>}
      </div>
      {summary.entryCount ? (
        <>
          <div className="diary-stats">
            <div><span>기록 날짜</span><strong>{summary.distinctDates.length}일</strong></div>
            <div><span>{summary.metricName ?? "지표"}</span><strong>{summary.averageValue === null ? "-" : `${summary.averageValue.toFixed(1)}${summary.unit ?? ""}`}</strong></div>
            <div><span>규칙 변경</span><strong>{summary.changedRuleVersion === null ? "없음" : `v${summary.baselineRuleVersion} → v${summary.changedRuleVersion}`}</strong></div>
          </div>
          <ul className="diary-entry-list">
            {entries.map((entry) => <li key={entry.id}><time>{entry.recordDate}</time><span>{entry.value}{entry.unit}</span><small>규칙 v{entry.planRuleVersion}</small></li>)}
          </ul>
          {summary.changedRuleVersion !== null && <p className="diary-rule-note">{summary.ruleChangeDate}부터 규칙을 변경했습니다. {summary.ruleChangeReason ?? ""}</p>}
          {entries.some((entry) => entry.entryOrigin === "synthetic_test") && <p className="diary-origin-note">현재 기록 중 일부는 테스트용으로 생성된 소급 데이터입니다.</p>}
        </>
      ) : (
        <div className="diary-empty"><p>질문·지표·규칙을 정한 뒤 하루 기록을 쌓아보세요.</p><span>동일한 단위와 계산식으로 전후 변화를 비교할 수 있습니다.</span></div>
      )}
      {error && <p className="diary-error" role="alert">{error}</p>}
      <DiaryEntryForm onSaved={onRefresh} />
    </section>
  );
}
