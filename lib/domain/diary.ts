import { z } from "zod";

import type { DiaryEntry, DiaryEntryOrigin, DiarySummary } from "./types";
import { ValidationError } from "../server/errors";

const diaryEntrySchema = z.object({
  recordDate: z.iso.date(),
  question: z.string().trim().min(1).max(500),
  metricName: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(40),
  value: z.number().finite().min(-1_000_000_000).max(1_000_000_000),
  calculationRule: z.string().trim().min(1).max(500),
  planRuleVersion: z.number().int().min(1),
  planRule: z.string().trim().min(1).max(500),
  ruleChangeReason: z.string().trim().max(500).nullable().optional(),
  entryOrigin: z.enum(["user_entered", "synthetic_test"]).optional(),
}).strict();

export type DiaryEntryInput = z.infer<typeof diaryEntrySchema>;

export function parseDiaryEntryInput(input: unknown): DiaryEntryInput {
  const result = diaryEntrySchema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.reduce<Record<string, string[]>>((output, issue) => {
      const field = issue.path.join(".") || "form";
      (output[field] ??= []).push(issue.message);
      return output;
    }, {});
    throw new ValidationError("Invalid diary entry", details);
  }
  return result.data;
}

export function calculateDiarySummary(entries: readonly DiaryEntry[]): DiarySummary {
  const ordered = [...entries].sort((a, b) => a.recordDate.localeCompare(b.recordDate));
  const distinctDates = [...new Set(ordered.map((entry) => entry.recordDate))];
  if (!ordered.length) {
    return {
      entryCount: 0, distinctDates: [], metricName: null, unit: null,
      totalValue: null, averageValue: null, baselineAverage: null,
      changedAverage: null, baselineRuleVersion: null, changedRuleVersion: null,
      ruleChangeDate: null, ruleChangeReason: null,
    };
  }

  const metricName = ordered[0].metricName;
  const unit = ordered[0].unit;
  const values = ordered.map((entry) => entry.value);
  const totalValue = values.reduce((total, value) => total + value, 0);
  const averageValue = totalValue / values.length;
  const versions = [...new Set(ordered.map((entry) => entry.planRuleVersion))].sort((a, b) => a - b);
  const baselineRuleVersion = versions[0] ?? null;
  const changedRuleVersion = versions.length > 1 ? versions[versions.length - 1] : null;
  const baselineValues = baselineRuleVersion === null ? [] : ordered.filter((entry) => entry.planRuleVersion === baselineRuleVersion).map((entry) => entry.value);
  const changedValues = changedRuleVersion === null ? [] : ordered.filter((entry) => entry.planRuleVersion === changedRuleVersion).map((entry) => entry.value);
  const changedEntry = changedRuleVersion === null ? null : ordered.find((entry) => entry.planRuleVersion === changedRuleVersion);

  return {
    entryCount: ordered.length,
    distinctDates,
    metricName,
    unit,
    totalValue,
    averageValue,
    baselineAverage: baselineValues.length ? baselineValues.reduce((sum, value) => sum + value, 0) / baselineValues.length : null,
    changedAverage: changedValues.length ? changedValues.reduce((sum, value) => sum + value, 0) / changedValues.length : null,
    baselineRuleVersion,
    changedRuleVersion,
    ruleChangeDate: changedEntry?.recordDate ?? null,
    ruleChangeReason: changedEntry?.ruleChangeReason ?? null,
  };
}

export function createSyntheticDiaryEntries(
  workspaceId: string,
  endDate: string,
  origin: DiaryEntryOrigin = "synthetic_test",
): Array<Omit<DiaryEntry, "id" | "createdAt" | "updatedAt">> {
  const end = new Date(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(end.getTime())) throw new ValidationError("Invalid diary end date");
  const values = [42, 48, 51, 57, 63];
  return values.map((value, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (values.length - index - 1));
    const recordDate = date.toISOString().slice(0, 10);
    const changed = index >= 2;
    return {
      workspaceId,
      recordDate,
      question: "오늘 계획한 핵심 실행을 실제로 얼마나 수행했는가?",
      metricName: "핵심 실행 점수",
      unit: "점",
      value,
      calculationRule: "완료한 핵심 실행 수 ÷ 계획한 핵심 실행 수 × 100",
      planRuleVersion: changed ? 2 : 1,
      planRule: changed ? "하루 핵심 실행을 1개로 제한하고 완료 후 다음 일정을 연다" : "하루 핵심 실행을 3개까지 계획한다",
      ruleChangeReason: changed ? "측정 가능한 한 가지에 집중하기 위해 규칙을 변경했다" : null,
      entryOrigin: origin,
    };
  });
}
