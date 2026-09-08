import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "../../../lib/server/db";
import { DatabaseError, ValidationError } from "../../../lib/server/errors";
import { SupabaseExecutionRepository } from "../../../lib/server/repositories/execution-repository";
import { SupabasePlanRepository } from "../../../lib/server/repositories/plan-repository";
import { SupabaseReviewRepository } from "../../../lib/server/repositories/review-repository";
import { SupabaseTaskRepository } from "../../../lib/server/repositories/task-repository";
import { SupabaseWorkspaceRepository } from "../../../lib/server/repositories/workspace-repository";
import { getDashboardData } from "../../../lib/server/services/review-service";

function errorResponse(error: unknown): NextResponse {
  if (error instanceof ValidationError) return NextResponse.json({ error: error.message, details: error.details }, { status: 400 });
  if (error instanceof DatabaseError) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET(): Promise<NextResponse> {
  try {
    const client = createServerSupabaseClient();
    const dashboard = await getDashboardData(
      new SupabaseWorkspaceRepository(client), new SupabasePlanRepository(client),
      new SupabaseTaskRepository(client), new SupabaseExecutionRepository(client), new SupabaseReviewRepository(client),
    );
    if (!dashboard) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    return NextResponse.json(dashboard);
  } catch (error) {
    return errorResponse(error);
  }
}
