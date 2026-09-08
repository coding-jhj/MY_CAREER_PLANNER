import { NextResponse } from "next/server";

import { getAuthenticatedContext } from "../../../../../lib/server/auth";
import { DatabaseError, NotFoundError, UnauthorizedError, ValidationError } from "../../../../../lib/server/errors";
import { SupabasePlanRepository } from "../../../../../lib/server/repositories/plan-repository";
import { SupabaseReviewRepository } from "../../../../../lib/server/repositories/review-repository";
import { saveCorrection } from "../../../../../lib/server/services/review-service";

type RouteContext = { params: Promise<{ planId: string }> };

function errorResponse(error: unknown): NextResponse {
  if (error instanceof ValidationError) return NextResponse.json({ error: error.message, details: error.details }, { status: 400 });
  if (error instanceof NotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (error instanceof DatabaseError) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const body: unknown = await request.json().catch(() => { throw new ValidationError("Invalid review correction", { body: ["Request body must be valid JSON"] }); });
    const { planId } = await params;
    const { client } = await getAuthenticatedContext();
    const saved = await saveCorrection(new SupabaseReviewRepository(client), new SupabasePlanRepository(client), planId, body);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
