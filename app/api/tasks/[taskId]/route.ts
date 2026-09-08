import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "../../../../lib/server/db";
import { DatabaseError, NotFoundError, ValidationError } from "../../../../lib/server/errors";
import { SupabaseTaskRepository } from "../../../../lib/server/repositories/task-repository";
import { deleteTask, updateTask } from "../../../../lib/server/services/task-service";

type RouteContext = { params: Promise<{ taskId: string }> };

function errorResponse(error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message, details: error.details }, { status: 400 });
  }
  if (error instanceof NotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (error instanceof DatabaseError) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const body: unknown = await request.json().catch(() => {
      throw new ValidationError("Invalid task input", { body: ["Request body must be valid JSON"] });
    });
    const { taskId } = await params;
    const task = await updateTask(new SupabaseTaskRepository(createServerSupabaseClient()), taskId, body);
    return NextResponse.json(task);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const { taskId } = await params;
    await deleteTask(new SupabaseTaskRepository(createServerSupabaseClient()), taskId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
