import { NextResponse } from "next/server";

import { getAuthenticatedContext } from "../../../lib/server/auth";
import { DatabaseError, NotFoundError, UnauthorizedError, ValidationError } from "../../../lib/server/errors";
import { SupabaseTaskRepository } from "../../../lib/server/repositories/task-repository";
import { createTask, listTasks } from "../../../lib/server/services/task-service";

function errorResponse(error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message, details: error.details }, { status: 400 });
  }
  if (error instanceof NotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (error instanceof DatabaseError) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const planId = url.searchParams.get("planId") ?? "";
    const { client } = await getAuthenticatedContext();
    const repository = new SupabaseTaskRepository(client);
    const tasks = await listTasks(repository, planId, {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      tag: url.searchParams.get("tag") ?? undefined,
      priority: url.searchParams.get("priority") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      direction: url.searchParams.get("direction") ?? undefined,
    });
    return NextResponse.json(tasks);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json().catch(() => {
      throw new ValidationError("Invalid task input", { body: ["Request body must be valid JSON"] });
    });
    const { client } = await getAuthenticatedContext();
    const repository = new SupabaseTaskRepository(client);
    const task = await createTask(repository, body);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
