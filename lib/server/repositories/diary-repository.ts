import type { SupabaseClient } from "@supabase/supabase-js";

import type { DiaryEntry, DiaryEntryOrigin } from "../../domain/types";
import { DatabaseError, translateSupabaseError } from "../errors";
import type { DiaryRepository } from "./contracts";

type Row = Record<string, unknown>;

function requiredString(row: Row, field: string): string {
  if (typeof row[field] !== "string") throw new DatabaseError(`Malformed diary_entries row: ${field}`);
  return row[field] as string;
}

function requiredNumber(row: Row, field: string): number {
  const value = row[field];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new DatabaseError(`Malformed diary_entries row: ${field}`);
}

function nullableString(row: Row, field: string): string | null {
  if (row[field] === null) return null;
  return requiredString(row, field);
}

function mapDiaryEntry(row: Row): DiaryEntry {
  const origin = requiredString(row, "entry_origin") as DiaryEntryOrigin;
  if (origin !== "user_entered" && origin !== "synthetic_test") throw new DatabaseError("Malformed diary_entries row: entry_origin");
  return {
    id: requiredString(row, "id"),
    workspaceId: requiredString(row, "workspace_id"),
    recordDate: requiredString(row, "record_date"),
    question: requiredString(row, "question"),
    metricName: requiredString(row, "metric_name"),
    unit: requiredString(row, "unit"),
    value: requiredNumber(row, "value"),
    calculationRule: requiredString(row, "calculation_rule"),
    planRuleVersion: requiredNumber(row, "plan_rule_version"),
    planRule: requiredString(row, "plan_rule"),
    ruleChangeReason: nullableString(row, "rule_change_reason"),
    entryOrigin: origin,
    createdAt: requiredString(row, "created_at"),
    updatedAt: requiredString(row, "updated_at"),
  };
}

function toRow(workspaceId: string, entry: Omit<DiaryEntry, "id" | "workspaceId" | "createdAt" | "updatedAt">) {
  return {
    workspace_id: workspaceId,
    record_date: entry.recordDate,
    question: entry.question,
    metric_name: entry.metricName,
    unit: entry.unit,
    value: entry.value,
    calculation_rule: entry.calculationRule,
    plan_rule_version: entry.planRuleVersion,
    plan_rule: entry.planRule,
    rule_change_reason: entry.ruleChangeReason,
    entry_origin: entry.entryOrigin,
  };
}

export class SupabaseDiaryRepository implements DiaryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByWorkspace(workspaceId: string): Promise<DiaryEntry[]> {
    const { data, error } = await this.client.from("diary_entries").select("*").eq("workspace_id", workspaceId).order("record_date", { ascending: true }).order("id", { ascending: true });
    if (error) throw translateSupabaseError(error);
    return (data ?? []).map((row) => mapDiaryEntry(row as Row));
  }

  async insert(workspaceId: string, entry: Omit<DiaryEntry, "id" | "workspaceId" | "createdAt" | "updatedAt">): Promise<DiaryEntry> {
    const { data, error } = await this.client.from("diary_entries").insert(toRow(workspaceId, entry)).select().single();
    if (error) throw translateSupabaseError(error);
    if (!data) throw new DatabaseError("Diary insert returned no row");
    return mapDiaryEntry(data as Row);
  }

  async insertMany(workspaceId: string, entries: readonly Omit<DiaryEntry, "id" | "workspaceId" | "createdAt" | "updatedAt">[]): Promise<DiaryEntry[]> {
    const { data, error } = await this.client.from("diary_entries").upsert(entries.map((entry) => toRow(workspaceId, entry)), { onConflict: "workspace_id,record_date,metric_name" }).select();
    if (error) throw translateSupabaseError(error);
    return (data ?? []).map((row) => mapDiaryEntry(row as Row));
  }
}
