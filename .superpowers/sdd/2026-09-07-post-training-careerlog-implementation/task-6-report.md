# Task 6 report — execution records, completion idempotency, and reopen

## Scope completed

Implemented the execution service and these POST endpoints:

- `/api/tasks/:taskId/executions`
- `/api/tasks/:taskId/complete`
- `/api/tasks/:taskId/reopen`

The service requires a non-empty task ID, explicit ISO timestamps with a UTC offset, `endedAt > startedAt`, and a UUID-shaped idempotency key. Duration is derived only from `endedAt - startedAt`; no execution time is taken from request handling time. Seoul remains a UI aggregation/display concern and is not used to alter stored instants.

## Files changed

- `lib/server/services/execution-service.ts`
- `lib/server/repositories/contracts.ts`
- `lib/server/repositories/execution-repository.ts`
- `supabase/migrations/003_execution_completion_transaction.sql`
- `app/api/tasks/[taskId]/executions/route.ts`
- `app/api/tasks/[taskId]/complete/route.ts`
- `app/api/tasks/[taskId]/reopen/route.ts`
- `tests/unit/execution-service.test.ts`
- `tests/api/routes.test.ts`

## Transaction and idempotency design

`SupabaseExecutionRepository.completeWithExecution` calls the scoped PostgreSQL RPC `complete_task_with_execution`.

The RPC first returns any existing execution for the globally unique idempotency key. For a new key, it validates strict timestamp ordering, locks the target non-deleted task with `FOR UPDATE`, rechecks the key, inserts exactly one `execution_records` row, and then updates that same task to `status = 'done'` with `completed_at = p_ended_at`. The execution row and task update occur in one database function transaction.

`actual_minutes` is calculated in SQL with UTC-aware `timestamptz` arithmetic: `floor(extract(epoch from (p_ended_at - p_started_at)) / 60)::integer`. The unique-key exception handler selects and returns the authoritative row when a concurrent request wins the key race, so a retry does not run the task transition or create another record. `reopenTask` only changes the task to `in_progress` and clears `completed_at`; it never deletes execution rows.

The public Task CRUD schema from Task 5 remains unable to set `done` or `completedAt`; only the completion RPC path used by the execution service performs that transition.

## Verification

Commands run from `/workspace/scratch/4117742285fb/.worktrees/post-training-careerlog`:

| Command | Result |
| --- | --- |
| `npm test -- tests/unit/execution-service.test.ts` before implementation | Expected red failure: module `execution-service` did not exist. |
| `npm test -- tests/unit/execution-service.test.ts tests/api/routes.test.ts` | Passed: 2 files, 21 tests. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed. |
| `git diff --check` | Passed with no whitespace errors. |
| `rg -n "status: \\"done\\"|completedAt:" lib app tests -g '*.ts' -g '*.tsx'` | No public CRUD code path found that sets `done` or `completedAt`; completion is in the SQL RPC. |

Self-review covered the service validation boundary, repository RPC delegation, task-completion exclusivity, atomic RPC ordering, unique-key race handling, reopen preservation, and all changed routes.

## Concerns / limitations

No live Supabase credentials were provided or required, so migration `003_execution_completion_transaction.sql` was not applied to a live database and the concurrent unique-key behavior was verified structurally/unit-test level only. Apply the migration to the target Supabase PostgreSQL project before exercising the completion route against live data.

## Focused review fix round

Addressed the Task 6 review findings without expanding into Task 7/UI work:

- `completeTask` now preflights `getByIdempotencyKey`. A same-task retry returns the stored execution without invoking the completion RPC again; a key owned by another task throws `ConflictError` before the RPC call.
- The completion RPC now rejects cross-task key reuse in both existing-row checks and its `unique_violation` race handler. It raises `P0001` with `idempotency_key_task_mismatch`, which `translateSupabaseError` maps to `ConflictError`.
- Added `record_execution_for_active_task`, a scoped RPC that validates timestamp order, locks/checks the task is not soft-deleted, calculates duration from supplied `timestamptz` values, and inserts the ordinary execution record. `ExecutionRepository.insert` now calls it instead of directly inserting into `execution_records`.
- The ordinary execution and completion route handlers map `ConflictError` to HTTP 409.

Focused fix-round verification:

| Command | Result |
| --- | --- |
| `npm test -- tests/unit/execution-service.test.ts tests/api/routes.test.ts` | Passed: 2 files, 25 tests. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed. |
| `git diff --check` | Passed. |

The live migration limitation above remains: the new RPCs need to be applied to the target Supabase database before live requests can use them.
