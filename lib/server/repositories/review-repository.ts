import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreatePlanInput, CreateReviewInput, Plan, Review, UpdateReviewInput } from "../../domain/types";
import { DatabaseError, NotFoundError, translateSupabaseError } from "../errors";
import type { ReviewRepository } from "./contracts";

type Row = Record<string, unknown>;

function requiredString(row: Row, field: string): string {
  if (typeof row[field] !== "string") throw new DatabaseError(`Malformed reviews row: ${field}`);
  return row[field] as string;
}

function mapReview(row: Row): Review {
  const nextPlanId = row.next_plan_id;
  if (nextPlanId !== null && typeof nextPlanId !== "string") throw new DatabaseError("Malformed reviews row: next_plan_id");
  return { id: requiredString(row, "id"), planId: requiredString(row, "plan_id"), correctionText: requiredString(row, "correction_text"), nextPlanId, createdAt: requiredString(row, "created_at") };
}

function mapPlan(row: Row): Plan {
  const number = (field: string) => {
    if (typeof row[field] !== "number") throw new DatabaseError(`Malformed plans row: ${field}`);
    return row[field] as number;
  };
  const nullable = (field: string) => {
    if (row[field] === null) return null;
    return requiredString(row, field);
  };
  return { id: requiredString(row, "id"), workspaceId: requiredString(row, "workspace_id"), title: requiredString(row, "title"), startDate: requiredString(row, "start_date"), endDate: requiredString(row, "end_date"), priority: number("priority"), successCriteria: requiredString(row, "success_criteria"), estimatedMinutes: number("estimated_minutes"), createdAt: requiredString(row, "created_at"), updatedAt: requiredString(row, "updated_at"), archivedAt: nullable("archived_at") };
}

export class SupabaseReviewRepository implements ReviewRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByPlan(planId: string): Promise<Review[]> {
    const { data, error } = await this.client.from("reviews").select("*").eq("plan_id", planId).order("created_at", { ascending: false });
    if (error) throw translateSupabaseError(error);
    return (data ?? []).map((row) => mapReview(row as Row));
  }

  async insert(planId: string, input: CreateReviewInput): Promise<Review> {
    const { data, error } = await this.client.from("reviews").insert({ plan_id: planId, correction_text: input.correctionText, next_plan_id: input.nextPlanId ?? null }).select().single();
    if (error) throw translateSupabaseError(error);
    if (!data) throw new DatabaseError("Review insert returned no row");
    return mapReview(data as Row);
  }

  async update(reviewId: string, input: UpdateReviewInput): Promise<Review> {
    const patch: Record<string, unknown> = {};
    if (input.correctionText !== undefined) patch.correction_text = input.correctionText;
    if (input.nextPlanId !== undefined) patch.next_plan_id = input.nextPlanId;
    const { data, error } = await this.client.from("reviews").update(patch).eq("id", reviewId).select().maybeSingle();
    if (error) throw translateSupabaseError(error);
    if (!data) throw new NotFoundError("Review not found");
    return mapReview(data as Row);
  }

  async createWithNextPlan(planId: string, input: { correctionText: string; nextPlan: CreatePlanInput }): Promise<{ review: Review; nextPlan: Plan }> {
    const next = input.nextPlan;
    const { data, error } = await this.client.rpc("create_review_with_next_plan", {
      p_plan_id: planId, p_correction_text: input.correctionText, p_workspace_id: next.workspaceId,
      p_title: next.title, p_start_date: next.startDate, p_end_date: next.endDate,
      p_priority: next.priority, p_success_criteria: next.successCriteria,
      p_estimated_minutes: next.estimatedMinutes,
    }).single();
    if (error) throw translateSupabaseError(error);
    if (!data || typeof data !== "object") throw new DatabaseError("Review creation returned no result");
    const result = data as Row;
    if (!result.review || typeof result.review !== "object" || !result.nextPlan || typeof result.nextPlan !== "object") {
      throw new DatabaseError("Review creation returned malformed result");
    }
    return { review: mapReview(result.review as Row), nextPlan: mapPlan(result.nextPlan as Row) };
  }
}
