import { NextResponse } from "next/server";

import { getAuthenticatedContext, revokeCurrentApplicationSession } from "../../../../lib/server/auth";
import { createServiceRoleSupabaseClient } from "../../../../lib/server/db";
import { DatabaseError, UnauthorizedError, ValidationError } from "../../../../lib/server/errors";

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json().catch(() => ({}));
    if (!body || typeof body !== "object" || (body as { confirmation?: unknown }).confirmation !== "DELETE") {
      throw new ValidationError("Account deletion requires confirmation", { confirmation: ["Type DELETE to confirm"] });
    }

    const context = await getAuthenticatedContext();
    await revokeCurrentApplicationSession(context);
    await context.client.auth.signOut({ scope: "global" });
    const admin = createServiceRoleSupabaseClient();
    const { error } = await admin.auth.admin.deleteUser(context.userId);
    if (error) throw new DatabaseError("Account deletion failed", error);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message, details: error.details }, { status: 400 });
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof DatabaseError) return NextResponse.json({ error: "Account deletion failed" }, { status: 500 });
    return NextResponse.json({ error: "Account deletion failed" }, { status: 500 });
  }
}
