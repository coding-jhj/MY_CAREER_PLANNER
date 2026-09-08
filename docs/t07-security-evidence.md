# T07 Security Evidence Checklist

Record the result of each check after applying migrations to the target
Supabase project. Do not place passwords, access tokens, publishable keys with
private context, or service-role keys in this document.

| Check | Expected result |
| --- | --- |
| Unauthenticated `GET /api/dashboard` | HTTP 401 |
| Unauthenticated direct `/` request | Redirects to `/login` |
| Authenticated dashboard | Only the signed-in user's workspace is returned |
| A reads B's plan/task IDs | HTTP 404 or no visible row |
| A updates/deletes B's records | Rejected; B's counts do not change |
| Same password in two accounts | Supabase Auth stores separate salted password hashes |
| Password in application rows/logs/export | Absent |
| Authenticated request before logout | Succeeds |
| Same protected request after logout | HTTP 401 |
| Diary export | Contains diary fields and no secrets |
| Account deletion | Auth user and owned application rows are removed |

The final evidence should contain request method, route, status code, and a
sanitized response shape. It must not contain credentials or copied JWTs.
