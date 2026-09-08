import { createServerSupabaseClient } from "../../../lib/server/db";
import { DatabaseError, ValidationError } from "../../../lib/server/errors";
import { SupabaseExecutionRepository } from "../../../lib/server/repositories/execution-repository";
import { SupabasePlanRepository } from "../../../lib/server/repositories/plan-repository";
import { SupabaseReviewRepository } from "../../../lib/server/repositories/review-repository";
import { SupabaseTaskRepository } from "../../../lib/server/repositories/task-repository";
import { SupabaseWorkspaceRepository } from "../../../lib/server/repositories/workspace-repository";
import { getExportData } from "../../../lib/server/services/review-service";

function errorResponse(error: unknown): Response {
  if (error instanceof ValidationError) return Response.json({ error: error.message, details: error.details }, { status: 400 });
  if (error instanceof DatabaseError) return Response.json({ error: "Internal server error" }, { status: 500 });
  return Response.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET(): Promise<Response> {
  try {
    const client = createServerSupabaseClient();
    const exported = await getExportData(
      new SupabaseWorkspaceRepository(client), new SupabasePlanRepository(client),
      new SupabaseTaskRepository(client), new SupabaseExecutionRepository(client), new SupabaseReviewRepository(client),
    );
    if (!exported) return Response.json({ error: "Workspace not found" }, { status: 404 });
    return new Response(JSON.stringify(exported), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"pds-export-v2.json\"",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
