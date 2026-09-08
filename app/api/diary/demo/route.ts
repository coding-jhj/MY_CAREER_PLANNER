import { NextResponse } from "next/server";

import { createSyntheticDiaryEntries, calculateDiarySummary } from "../../../../lib/domain/diary";
import { getAuthenticatedContext } from "../../../../lib/server/auth";
import { DatabaseError, NotFoundError, UnauthorizedError } from "../../../../lib/server/errors";
import { SupabaseDiaryRepository } from "../../../../lib/server/repositories/diary-repository";
import { SupabaseWorkspaceRepository } from "../../../../lib/server/repositories/workspace-repository";
import { currentSeoulDate } from "../../../../lib/server/services/review-service";

export async function POST(): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_SYNTHETIC_DIARY !== "true") {
    return NextResponse.json({ error: "Synthetic diary generation is disabled" }, { status: 403 });
  }

  try {
    const { client } = await getAuthenticatedContext();
    const workspace = await new SupabaseWorkspaceRepository(client).getBySlug(process.env.PUBLIC_WORKSPACE_SLUG ?? "public");
    if (!workspace) throw new NotFoundError("Workspace not found");
    const generated = createSyntheticDiaryEntries(workspace.id, currentSeoulDate());
    const entries = await new SupabaseDiaryRepository(client).insertMany(workspace.id, generated.map(({ workspaceId: _workspaceId, ...entry }) => entry));
    return NextResponse.json({ entries, summary: calculateDiarySummary(entries), entryOrigin: "synthetic_test" });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof NotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (error instanceof DatabaseError) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    return NextResponse.json({ error: "Unable to create diary data" }, { status: 500 });
  }
}
