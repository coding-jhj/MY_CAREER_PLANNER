# T07 Reproduction

1. Configure the Supabase URL, publishable key, and server-only service-role key
   in the local environment.
2. Apply migrations `001` through `005`, start the Next.js application, and
   open `/login`.
3. Create an account, sign in, and confirm that the dashboard API returns only
   that account's workspace.
4. Add diary entries on five distinct Asia/Seoul dates, keeping one metric,
   unit, and calculation rule; change the plan rule once after day 2 and before
   day 3.

For local QA only, set `ALLOW_SYNTHETIC_DIARY=true` in a non-production
environment and use the dashboard's test-data button. The generated records
are explicitly marked `synthetic_test` and are not evidence of five days of
actual use.

## Security checks

- Open `/` without a session: it redirects to `/login`.
- Call `/api/dashboard` without a session: it returns `401`.
- Create accounts A and B, then attempt to use A's plan/task IDs while signed
  in as B: reads return no row and writes return `404` or an RLS denial.
- Log out, replay a protected request, and confirm `401`.
- Export the signed-in workspace and verify that diary entries are included but
  passwords, tokens, and server secrets are absent.

For the live Playwright checks, provide a dedicated test account through
`E2E_USER_EMAIL` and `E2E_USER_PASSWORD` and run `npm run test:e2e`. The
Supabase browser variables may be exported in the shell or kept in the local
`.env.local`; the tests are skipped when a test account is not configured.
