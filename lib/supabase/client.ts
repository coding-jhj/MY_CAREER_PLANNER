"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublishableKey, getSupabaseUrl } from "./config";

let browserClient: SupabaseClient | undefined;

export function createBrowserSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient;

  browserClient = createBrowserClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
  );
  return browserClient;
}
