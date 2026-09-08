import { NextResponse } from "next/server";

import { getAuthenticatedContext } from "../../../../../lib/server/auth";
import { DatabaseError, NotFoundError, UnauthorizedError, ValidationError } from "../../../../../lib/server/errors";
import { SupabaseTaskRepository } from "../../../../../lib/server/repositories/task-repository";
import { reopenTask } from "../../../../../lib/server/services/execution-service";

type RouteContext = { params: Promise<{ taskId: string }> };

function errorResponse(error: unknown): NextResponse {
  if (error instanceof ValidationError) return NextResponse.json({ error: error.message, details: error.details }, { status: 400 });
  if (error instanceof NotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (error instanceof DatabaseError) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const { taskId } = await params;
    const { client } = await getAuthenticatedContext();
    const task = await reopenTask(new SupabaseTaskRepository(client), taskId);
    return NextResponse.json(task);
  } catch (error) {
    return errorResponse(error);
  }
}
