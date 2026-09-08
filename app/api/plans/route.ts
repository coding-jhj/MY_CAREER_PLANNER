import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "../../../lib/server/db";
import {
  DatabaseError,
  NotFoundError,
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
    const repository = new SupabasePlanRepository(createServerSupabaseClient());
    const plan = await createPlan(repository, body);
    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
