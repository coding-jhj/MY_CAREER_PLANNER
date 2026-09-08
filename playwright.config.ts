import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const hasSupabaseConfig = Boolean(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) &&
  (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
) || existsSync(".env.local") || existsSync(".env");
const hasE2EConfig = Boolean(
  hasSupabaseConfig &&
  process.env.E2E_USER_EMAIL &&
  process.env.E2E_USER_PASSWORD,
);

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    ...devices["Desktop Chrome"],
  },
  ...(hasE2EConfig ? {
    webServer: {
      command: "npm run dev -- --hostname 127.0.0.1",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: !process.env.CI,
    },
  } : {}),
});
