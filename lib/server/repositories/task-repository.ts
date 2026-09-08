import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreateTaskInput, Task, TaskStatus, UpdateTaskInput } from "../../domain/types";
import { DatabaseError, NotFoundError, translateSupabaseError } from "../errors";
import type { TaskQuery, TaskRepository } from "./contracts";

type Row = Record<string, unknown>;

function string(row: Row, field: string, nullable = false): string | null {
  const value = row[field];
  if (nullable && value === null) return null;
  if (typeof value !== "string") throw new DatabaseError(`Malformed tasks row: ${field}`);
  return value;
}

function number(row: Row, field: string): number {
  if (typeof row[field] !== "number") throw new DatabaseError(`Malformed tasks row: ${field}`);
  return row[field] as number;
}

function mapTask(row: Row): Task {
  const status = string(row, "status") as TaskStatus;
  if (!(["todo", "in_progress", "done"] as const).includes(status)) throw new DatabaseError("Malformed tasks row: status");
  return {
    id: string(row, "id") as string, planId: string(row, "plan_id") as string, title: string(row, "title") as string,
    dueDate: string(row, "due_date", true), priority: number(row, "priority"), tag: string(row, "tag") as string,
    estimatedMinutes: number(row, "estimated_minutes"), status, blockedReason: string(row, "blocked_reason", true),
    completedAt: string(row, "completed_at", true), deletedAt: string(row, "deleted_at", true),
    createdAt: string(row, "created_at") as string, updatedAt: string(row, "updated_at") as string,
  };
}

function taskPatch(input: UpdateTaskInput): Record<string, unknown> {
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) fields.title = input.title;
  if (input.dueDate !== undefined) fields.due_date = input.dueDate;
  if (input.priority !== undefined) fields.priority = input.priority;
  if (input.tag !== undefined) fields.tag = input.tag;
  if (input.estimatedMinutes !== undefined) fields.estimated_minutes = input.estimatedMinutes;
  if (input.status !== undefined) fields.status = input.status;
  if (input.blockedReason !== undefined) fields.blocked_reason = input.blockedReason;
  if (input.completedAt !== undefined) fields.completed_at = input.completedAt;
  return fields;
}

export class SupabaseTaskRepository implements TaskRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(planId: string, query: TaskQuery): Promise<Task[]> {
    let request = this.client.from("tasks").select("*").eq("plan_id", planId).is("deleted_at", null);
    if (query.search) request = request.ilike("title", `%${query.search}%`);
    if (query.status) request = request.eq("status", query.status);
    if (query.priority !== undefined) request = request.eq("priority", query.priority);
    if (query.tag) request = request.eq("tag", query.tag);
    const ascending = query.direction !== "desc";
    const sort = query.sort ?? "created_at";
    if (sort === "priority") {
      request = request
        .order("priority", { ascending })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });
    } else if (sort === "due_date") {
      request = request
        .order("due_date", { ascending, nullsFirst: false })
        .order("priority", { ascending: true })
        .order("id", { ascending: true });
    } else if (sort === "estimated_minutes") {
      request = request
        .order("estimated_minutes", { ascending })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });
    } else {
      request = request
        .order("created_at", { ascending })
        .order("id", { ascending: true });
    }
    const { data, error } = await request;
    if (error) throw translateSupabaseError(error);
    return (data ?? []).map((row) => mapTask(row as Row));
  }

  async insert(planId: string, input: CreateTaskInput): Promise<Task> {
    const { data, error } = await this.client.from("tasks").insert({ plan_id: planId, title: input.title, due_date: input.dueDate ?? null, priority: input.priority, tag: input.tag, estimated_minutes: input.estimatedMinutes, status: input.status ?? "todo", blocked_reason: input.blockedReason ?? null }).select().single();
    if (error) throw translateSupabaseError(error);
    if (!data) throw new DatabaseError("Task insert returned no row");
    return mapTask(data as Row);
  }

  async update(taskId: string, input: UpdateTaskInput): Promise<Task> {
    const { data, error } = await this.client.from("tasks").update(taskPatch(input)).eq("id", taskId).is("deleted_at", null).select().maybeSingle();
    if (error) throw translateSupabaseError(error);
    if (!data) throw new NotFoundError("Task not found");
    return mapTask(data as Row);
  }

  async softDelete(taskId: string): Promise<void> {
    const { data, error } = await this.client.from("tasks").update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", taskId).is("deleted_at", null).select("id").maybeSingle();
    if (error) throw translateSupabaseError(error);
    if (!data) throw new NotFoundError("Task not found");
  }
}
