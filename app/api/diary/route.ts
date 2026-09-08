import { NextResponse } from "next/server";

import { parseDiaryEntryInput } from "../../../lib/domain/diary";
import { getAuthenticatedContext } from "../../../lib/server/auth";
import { DatabaseError, NotFoundError, UnauthorizedError, ValidationError } from "../../../lib/server/errors";
import { SupabaseDiaryRepository } from "../../../lib/server/repositories/diary-repository";
import { SupabaseWorkspaceRepository } from "../../../lib/server/repositories/workspace-repository";

function errorResponse(error: unknown): NextResponse {
  if (error instanceof ValidationError) return NextResponse.json({ error: error.message, details: error.details }, { status: 400 });
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (error instanceof NotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (error instanceof DatabaseError) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

async function getWorkspaceContext() {
  const { client } = await getAuthenticatedContext();
  const workspace = await new SupabaseWorkspaceRepository(client).getBySlug(process.env.PUBLIC_WORKSPACE_SLUG ?? "public");
  if (!workspace) throw new NotFoundError("Workspace not found");
  return { client, workspace };
}

export async function GET(): Promise<NextResponse> {
  try {
    const { client, workspace } = await getWorkspaceContext();
    const entries = await new SupabaseDiaryRepository(client).listByWorkspace(workspace.id);
    return NextResponse.json(entries);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json().catch(() => {
      throw new ValidationError("Invalid diary entry", { body: ["Request body must be valid JSON"] });
    });
    const parsed = parseDiaryEntryInput(body);
    const { client, workspace } = await getWorkspaceContext();
    const entry = await new SupabaseDiaryRepository(client).insert(workspace.id, {
      ...parsed,
      ruleChangeReason: parsed.ruleChangeReason ?? null,
      entryOrigin: "user_entered",
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
