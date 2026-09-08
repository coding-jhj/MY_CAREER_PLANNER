import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { ConfigurationError } from "./errors";

export { ConfigurationError };

export function createServiceRoleSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new ConfigurationError(
      "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be configured on the server",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Kept as a compatibility alias for existing tests and one-time administrative
 * tasks. User-facing request handlers must use getAuthenticatedContext() from
 * auth.ts so that RLS is evaluated with the signed-in user's session.
 */
export const createServerSupabaseClient = createServiceRoleSupabaseClient;
