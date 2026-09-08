# T07 Authentication and Data Ownership

## Selected approach

The application uses Supabase Auth with email and password, `@supabase/ssr`,
HTTP-only cookie session handling, and PostgreSQL Row Level Security (RLS).
The existing T06 application used a single public workspace and a server-side
service-role client. T07 changes request handlers to use the authenticated
cookie client so ordinary reads and writes are evaluated by RLS.

## Why this approach

- Supabase Auth provides password hashing and session lifecycle management.
- `@supabase/ssr` keeps browser and server session handling aligned in Next.js.
- RLS enforces ownership at the database boundary instead of trusting a URL or
  request body workspace ID.
- Existing T06 plan, task, execution, and review APIs can keep their domain
  services while using a user-scoped Supabase client.

## Where the implementation lives

| Concern | Location |
| --- | --- |
| Browser Auth client | `lib/supabase/client.ts` |
| Server cookie client | `lib/supabase/server.ts` |
| Session refresh | `proxy.ts` |
| Authenticated request context | `lib/server/auth.ts` |
| Login/signup pages | `app/login/page.tsx`, `app/signup/page.tsx` |
| Logout and account deletion | `app/api/auth/logout/route.ts`, `app/api/auth/account/route.ts` |
| Ownership and RLS | `supabase/migrations/005_t07_auth_ownership_and_diary.sql` |

## Password handling

The application never receives or stores a password in its own tables. The
password is submitted to Supabase Auth over HTTPS. Supabase stores the Auth
password representation, not plaintext. No password field is included in the
application API response or export allowlist.

## Session and logout handling

The server verifies claims with `auth.getClaims()`. The `session_id` claim is
registered in `app_sessions`. A logout marks the application session as
revoked, then signs out the Supabase session. Protected requests reject a
revoked application session. This additional check is intentional because a
previously issued access token can remain cryptographically valid until its
expiry even after sign-out.

## Ownership rules

`workspaces.owner_id` references `auth.users(id)`. Every application table is
protected by an ownership policy that follows its foreign-key path back to the
workspace. UPDATE policies include both `USING` and `WITH CHECK`, preventing a
row from being reassigned to another workspace.

The legacy T06 `public` workspace is claimed by the first newly created user in
the Auth trigger. Later users receive a new empty workspace with the same slug,
which is safe because uniqueness is now scoped per owner and RLS hides other
owners' rows.

## Account deletion

`DELETE /api/auth/account` requires a JSON body of `{ "confirmation": "DELETE" }`.
The route revokes the current application session, signs out the user, and
deletes the Auth user with the server-only service-role client. Foreign keys
from the user to workspace and from workspace to application records use
cascade behavior.

## Security notes

- `SUPABASE_SECRET_KEY` is the preferred server-only key and must never use a
  `NEXT_PUBLIC_` prefix. `SUPABASE_SERVICE_ROLE_KEY` remains a legacy fallback.
- Browser code uses the publishable key with RLS.
- No authorization decision uses editable `user_metadata`.
- Anonymous access is not granted to application tables or transaction RPCs.
