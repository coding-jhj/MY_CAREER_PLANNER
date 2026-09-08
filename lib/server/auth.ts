import type { SupabaseClient } from "@supabase/supabase-js";

import { createServerSupabaseClient as createCookieSupabaseClient } from "../supabase/server";
import { createServerSupabaseClient as createTestServiceClient } from "./db";
import { UnauthorizedError, translateSupabaseError } from "./errors";

export interface AuthenticatedContext {
  client: SupabaseClient;
  userId: string;
  email: string | null;
  sessionId: string | null;
}

type Claims = Record<string, unknown>;

function claimString(claims: Claims, name: string): string | null {
  return typeof claims[name] === "string" && claims[name] ? claims[name] as string : null;
}

async function assertActiveApplicationSession(
  client: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<void> {
  const { data, error } = await client
    .from("app_sessions")
    .select("user_id, revoked_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw translateSupabaseError(error);
  if (data && (data.user_id !== userId || data.revoked_at !== null)) {
    throw new UnauthorizedError("This session has been revoked");
  }

  if (!data) {
    const { error: insertError } = await client.from("app_sessions").insert({
      session_id: sessionId,
      user_id: userId,
    });

    if (insertError && insertError.code !== "23505") {
      throw translateSupabaseError(insertError);
    }

    if (insertError?.code === "23505") {
      const { data: existing, error: retryError } = await client
        .from("app_sessions")
        .select("user_id, revoked_at")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (retryError) throw translateSupabaseError(retryError);
      if (!existing || existing.user_id !== userId || existing.revoked_at !== null) {
        throw new UnauthorizedError("This session has been revoked");
      }
    }
  }

  const { error: touchError } = await client
    .from("app_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (touchError) throw translateSupabaseError(touchError);
}

export async function getAuthenticatedContext(): Promise<AuthenticatedContext> {
  // This branch only exists for the repository's isolated Vitest route tests;
  // it is never active in a production build.
  if (process.env.NODE_ENV === "test") {
    return {
      client: createTestServiceClient(),
      userId: "test-user",
      email: "test@example.com",
      sessionId: "test-session",
    };
  }

  const client = await createCookieSupabaseClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims || typeof data.claims !== "object") {
    throw new UnauthorizedError();
  }

  const claims = data.claims as Claims;
  const userId = claimString(claims, "sub");
  if (!userId) throw new UnauthorizedError();

  const sessionId = claimString(claims, "session_id");
  if (!sessionId) throw new UnauthorizedError("This session is missing a session identifier");
  await assertActiveApplicationSession(client, userId, sessionId);

  return {
    client,
    userId,
    email: claimString(claims, "email"),
    sessionId,
  };
}

export async function revokeCurrentApplicationSession(
  context: AuthenticatedContext,
): Promise<void> {
  if (!context.sessionId) return;
  const { error } = await context.client
    .from("app_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("session_id", context.sessionId)
    .eq("user_id", context.userId)
    .is("revoked_at", null);
  if (error) throw translateSupabaseError(error);
}
