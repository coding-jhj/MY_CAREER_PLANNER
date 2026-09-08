import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreateExecutionRecordInput, ExecutionRecord } from "../../domain/types";
import { DatabaseError, translateSupabaseError } from "../errors";
import type { ExecutionRepository } from "./contracts";

type Row = Record<string, unknown>;

function requiredString(row: Row, field: string): string {
  if (typeof row[field] !== "string") throw new DatabaseError(`Malformed execution_records row: ${field}`);
  return row[field] as string;
}

function nullableString(row: Row, field: string): string | null {
  if (row[field] === null) return null;
  return requiredString(row, field);
}

function mapExecution(row: Row): ExecutionRecord {
  if (typeof row.actual_minutes !== "number") throw new DatabaseError("Malformed execution_records row: actual_minutes");
  return { id: requiredString(row, "id"), taskId: requiredString(row, "task_id"), startedAt: requiredString(row, "started_at"), endedAt: requiredString(row, "ended_at"), actualMinutes: row.actual_minutes, missedReason: nullableString(row, "missed_reason"), idempotencyKey: requiredString(row, "idempotency_key"), createdAt: requiredString(row, "created_at") };
}

export class SupabaseExecutionRepository implements ExecutionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByTask(taskId: string): Promise<ExecutionRecord[]> {
    const { data, error } = await this.client.from("execution_records").select("*").eq("task_id", taskId).order("started_at", { ascending: false });
    if (error) throw translateSupabaseError(error);
    return (data ?? []).map((row) => mapExecution(row as Row));
  }

  async getByIdempotencyKey(idempotencyKey: string): Promise<ExecutionRecord | null> {
    const { data, error } = await this.client.from("execution_records").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
    if (error) throw translateSupabaseError(error);
    return data ? mapExecution(data as Row) : null;
  }

  async insert(taskId: string, input: Omit<CreateExecutionRecordInput, "taskId">): Promise<ExecutionRecord> {
    const { data, error } = await this.client.rpc("record_execution_for_active_task", {
      p_task_id: taskId,
      p_started_at: input.startedAt,
      p_ended_at: input.endedAt,
      p_missed_reason: input.missedReason ?? null,
      p_idempotency_key: input.idempotencyKey,
    }).single();
    if (error) throw translateSupabaseError(error);
    if (!data) throw new DatabaseError("Execution insert returned no row");
    return mapExecution(data as Row);
  }

  async completeWithExecution(taskId: string, input: Omit<CreateExecutionRecordInput, "taskId">): Promise<ExecutionRecord> {
    const { data, error } = await this.client.rpc("complete_task_with_execution", {
      p_task_id: taskId,
      p_started_at: input.startedAt,
      p_ended_at: input.endedAt,
      p_missed_reason: input.missedReason ?? null,
      p_idempotency_key: input.idempotencyKey,
    }).single();
    if (error) throw translateSupabaseError(error);
    if (!data) throw new DatabaseError("Completion transaction returned no execution row");
    return mapExecution(data as Row);
  }
}
