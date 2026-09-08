import { NextResponse } from "next/server";

import { getAuthenticatedContext } from "../../../lib/server/auth";
import {
  DatabaseError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../../lib/server/errors";
import { SupabasePlanRepository } from "../../../lib/server/repositories/plan-repository";
import { createPlan } from "../../../lib/server/services/plan-service";

function errorResponse(error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: 400 },
    );
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (error instanceof DatabaseError) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json().catch(() => {
      throw new ValidationError("Invalid plan input", {
        body: ["Request body must be valid JSON"],
      });
    });
    const { client } = await getAuthenticatedContext();
    const repository = new SupabasePlanRepository(client);
    const plan = await createPlan(repository, body);
    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
