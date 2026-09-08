# T07 AI and Human Judgment

## Work delegated to AI

AI helped inspect the existing T06 repository, map the rubric to code paths,
draft the Supabase Auth/RLS structure, and generate automated tests and
documentation scaffolding.

## My judgment

I chose cookie-based Supabase SSR sessions and database-enforced ownership
because the existing service-role-only API did not provide user isolation.
I kept the existing T06 domain services and added diary records instead of
replacing the working plan/task/execution model.

## Decision not to follow

I did not treat generated past-date records as proof of actual five-day use.
The development generator is restricted to non-production environments and
marks its rows as `synthetic_test`, so the source of the data remains clear.
