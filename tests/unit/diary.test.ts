import { describe, expect, it } from "vitest";

import { calculateDiarySummary, createSyntheticDiaryEntries } from "../../lib/domain/diary";
import type { DiaryEntry } from "../../lib/domain/types";

function entry(overrides: Partial<DiaryEntry>): DiaryEntry {
  return {
    id: "entry-id", workspaceId: "workspace-id", recordDate: "2026-09-04",
    question: "Question", metricName: "Focus", unit: "점", value: 40,
    calculationRule: "same rule", planRuleVersion: 1, planRule: "three tasks",
    ruleChangeReason: null, entryOrigin: "user_entered",
    createdAt: "2026-09-04T00:00:00Z", updatedAt: "2026-09-04T00:00:00Z",
    ...overrides,
  };
}

describe("diary calculations", () => {
  it("counts distinct dates and compares rule versions using the same metric", () => {
    const summary = calculateDiarySummary([
      entry({ id: "1", recordDate: "2026-09-04", value: 40 }),
      entry({ id: "2", recordDate: "2026-09-05", value: 50 }),
      entry({ id: "3", recordDate: "2026-09-06", value: 70, planRuleVersion: 2, planRule: "one task", ruleChangeReason: "focus" }),
      entry({ id: "4", recordDate: "2026-09-07", value: 80, planRuleVersion: 2, planRule: "one task", ruleChangeReason: "focus" }),
    ]);

    expect(summary.distinctDates).toEqual(["2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07"]);
    expect(summary.totalValue).toBe(240);
    expect(summary.averageValue).toBe(60);
    expect(summary.baselineAverage).toBe(45);
    expect(summary.changedAverage).toBe(75);
    expect(summary.ruleChangeDate).toBe("2026-09-06");
  });

  it("creates five distinct Seoul-calendar records with one rule change", () => {
    const records = createSyntheticDiaryEntries("workspace-id", "2026-09-08");
    expect(records).toHaveLength(5);
    expect(new Set(records.map((record) => record.recordDate)).size).toBe(5);
    expect(records.map((record) => record.planRuleVersion)).toEqual([1, 1, 2, 2, 2]);
    expect(records.every((record) => record.entryOrigin === "synthetic_test")).toBe(true);
  });
});
