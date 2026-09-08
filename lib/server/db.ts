import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { ConfigurationError } from "./errors";

export { ConfigurationError };

export function createServerSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new ConfigurationError(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured on the server",
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
