import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreatePlanInput, Plan, PlanRevision, UpdatePlanInput } from "../../domain/types";
import { DatabaseError, NotFoundError, translateSupabaseError } from "../errors";
import type { PlanRepository } from "./contracts";

type Row = Record<string, unknown>;

function requiredString(row: Row, field: string): string {
  const value = row[field];
  if (typeof value !== "string") throw new DatabaseError(`Malformed plans row: ${field}`);
  return value;
}

function requiredNumber(row: Row, field: string): number {
  const value = row[field];
  if (typeof value !== "number") throw new DatabaseError(`Malformed plans row: ${field}`);
  return value;
}

function nullableString(row: Row, field: string): string | null {
  const value = row[field];
  if (value !== null && typeof value !== "string") throw new DatabaseError(`Malformed plans row: ${field}`);
  return value;
}

function mapPlan(row: Row): Plan {
  return {
    id: requiredString(row, "id"), workspaceId: requiredString(row, "workspace_id"),
    title: requiredString(row, "title"), startDate: requiredString(row, "start_date"),
    endDate: requiredString(row, "end_date"), priority: requiredNumber(row, "priority"),
    successCriteria: requiredString(row, "success_criteria"), estimatedMinutes: requiredNumber(row, "estimated_minutes"),
    createdAt: requiredString(row, "created_at"), updatedAt: requiredString(row, "updated_at"),
    archivedAt: nullableString(row, "archived_at"),
  };
}

function mapPlanRevision(row: Row): PlanRevision {
  return {
    id: requiredString(row, "plan_id"), workspaceId: requiredString(row, "workspace_id"),
    title: requiredString(row, "title"), startDate: requiredString(row, "start_date"),
    endDate: requiredString(row, "end_date"), priority: requiredNumber(row, "priority"),
    successCriteria: requiredString(row, "success_criteria"), estimatedMinutes: requiredNumber(row, "estimated_minutes"),
    revisionNo: requiredNumber(row, "revision_no"), savedAt: requiredString(row, "saved_at"),
  };
}

export class SupabasePlanRepository implements PlanRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getById(planId: string): Promise<Plan | null> {
    const { data, error } = await this.client.from("plans").select("*").eq("id", planId).maybeSingle();
    if (error) throw translateSupabaseError(error);
    return data ? mapPlan(data as Row) : null;
  }

  async getCurrent(workspaceId: string): Promise<Plan | null> {
    const { data, error } = await this.client.from("plans").select("*").eq("workspace_id", workspaceId).is("archived_at", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw translateSupabaseError(error);
    return data ? mapPlan(data as Row) : null;
  }

  async listByWorkspace(workspaceId: string): Promise<Plan[]> {
    const { data, error } = await this.client.from("plans").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: true }).order("id", { ascending: true });
    if (error) throw translateSupabaseError(error);
    return (data ?? []).map((row) => mapPlan(row as Row));
  }

  async insert(workspaceId: string, input: CreatePlanInput): Promise<Plan> {
    const { data, error } = await this.client.from("plans").insert({ workspace_id: workspaceId, title: input.title, start_date: input.startDate, end_date: input.endDate, priority: input.priority, success_criteria: input.successCriteria, estimated_minutes: input.estimatedMinutes }).select().single();
    if (error) throw translateSupabaseError(error);
    if (!data) throw new DatabaseError("Plan insert returned no row");
    return mapPlan(data as Row);
  }

  async updateWithRevision(planId: string, input: UpdatePlanInput): Promise<Plan> {
    const patch = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    );
    const { data, error } = await this.client
      .rpc("update_plan_with_revision", { p_plan_id: planId, p_patch: patch })
      .single();
    if (error) throw translateSupabaseError(error);
    if (!data) throw new DatabaseError("Plan update returned no row");
    return mapPlan(data as Row);
  }

  async listRevisions(planId: string): Promise<PlanRevision[]> {
    const { data: plan, error: planError } = await this.client.from("plans").select("workspace_id").eq("id", planId).maybeSingle();
    if (planError) throw translateSupabaseError(planError);
    if (!plan) throw new NotFoundError("Plan not found");
    const { data, error } = await this.client.from("plan_revisions").select("*").eq("plan_id", planId).order("revision_no", { ascending: false });
    if (error) throw translateSupabaseError(error);
    return (data ?? []).map((row) => mapPlanRevision({ ...(row as Row), workspace_id: (plan as Row).workspace_id }));
  }
}
