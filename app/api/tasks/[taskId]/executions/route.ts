import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "../../../../../lib/server/db";
import { ConflictError, DatabaseError, NotFoundError, ValidationError } from "../../../../../lib/server/errors";
import { SupabaseExecutionRepository } from "../../../../../lib/server/repositories/execution-repository";
import { recordExecution } from "../../../../../lib/server/services/execution-service";

type RouteContext = { params: Promise<{ taskId: string }> };

function errorResponse(error: unknown): NextResponse {
  if (error instanceof ValidationError) return NextResponse.json({ error: error.message, details: error.details }, { status: 400 });
  if (error instanceof ConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof NotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (error instanceof DatabaseError) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const body: unknown = await request.json().catch(() => {
      throw new ValidationError("Invalid execution input", { body: ["Request body must be valid JSON"] });
    });
    const { taskId } = await params;
    const record = await recordExecution(new SupabaseExecutionRepository(createServerSupabaseClient()), taskId, body);
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
