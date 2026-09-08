import { NextResponse } from "next/server";

import {
  getAuthenticatedContext,
  revokeCurrentApplicationSession,
} from "../../../../lib/server/auth";
import { UnauthorizedError } from "../../../../lib/server/errors";

export async function POST(): Promise<NextResponse> {
  try {
    const context = await getAuthenticatedContext();
    await revokeCurrentApplicationSession(context);
    await context.client.auth.signOut({ scope: "global" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to sign out" }, { status: 500 });
  }
}
