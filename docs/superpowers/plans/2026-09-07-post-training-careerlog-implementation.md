# Post-training CareerLog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, login-free Plan–Do–See diary that records the user's real preparation for a Post-training Research Engineer role and satisfies every T06 acceptance criterion.

**Architecture:** Use one Next.js App Router repository. The browser talks only to Next.js Route Handlers under `app/api`; those handlers validate input, apply domain rules, and write to Supabase PostgreSQL through a server-only client. A single public workspace is used for T06, with no authentication and no client-side database credentials.

**Tech Stack:** TypeScript, Next.js App Router, React, Supabase PostgreSQL, `@supabase/supabase-js`, Zod, Vitest, React Testing Library, Playwright, npm.

**Spec:** `docs/superpowers/specs/2026-09-07-post-training-careerlog-design.md`

## Global Constraints

- The public screen title is exactly `Post-training Research Engineer 지원 준비`; do not display the company name.
- T06 has no login, OAuth, CAPTCHA, or account creation; one public workspace is used.
- The browser never receives database credentials and never writes directly to Supabase.
- The server uses `Asia/Seoul` for date-based aggregation.
- Plan edits preserve the previous snapshot in `plan_revisions` while keeping the same plan ID.
- Task deletion is soft deletion through `deleted_at`; aggregate queries exclude deleted tasks.
- Completion requests use an idempotency key and a database unique constraint; UI button disabling is only an additional UX guard.
- The app stores no passwords, API keys, contact details, private application documents, or other secrets.
- User-entered HTML or script-like text is rendered as text and is never executed.
- Initial execution records must be the user's real activities; do not invent completion times or pretend demo data is personal experience.
- `contracts/pds-schema-v2.json` is part of the final source state.
- Every task ends with a focused test run and a separate Git commit.

## File Map

Create the following focused files. Do not put database queries, validation, metrics, and UI state in one component.

```text
app/
  api/
    dashboard/route.ts
    export/route.ts
    plans/route.ts
    plans/[planId]/route.ts
    plans/[planId]/revisions/route.ts
    tasks/route.ts
    tasks/[taskId]/route.ts
    tasks/[taskId]/complete/route.ts
    tasks/[taskId]/reopen/route.ts
    tasks/[taskId]/executions/route.ts
    reviews/[planId]/route.ts
    reviews/[planId]/corrections/route.ts
  page.tsx
  layout.tsx
  globals.css

components/
  dashboard/Dashboard.tsx
  dashboard/MetricButton.tsx
  plan/PlanPanel.tsx
  plan/PlanRevisionList.tsx
  tasks/TaskPanel.tsx
  tasks/TaskForm.tsx
  tasks/TaskToolbar.tsx
  execution/ExecutionForm.tsx
  review/ReviewPanel.tsx
  review/ReviewDetailList.tsx
  export/ExportButton.tsx
  shared/ErrorMessage.tsx
  shared/LoadingState.tsx
  shared/PublicNotice.tsx

lib/
  domain/types.ts
  domain/validation.ts
  domain/metrics.ts
  domain/serialization.ts
  server/db.ts
  server/errors.ts
  server/repositories/contracts.ts
  server/repositories/plan-repository.ts
  server/repositories/task-repository.ts
  server/repositories/execution-repository.ts
  server/repositories/review-repository.ts
  server/services/plan-service.ts
  server/services/task-service.ts
  server/services/execution-service.ts
  server/services/review-service.ts

supabase/
  migrations/001_initial_schema.sql

contracts/
  pds-schema-v2.json

scripts/
  verify-schema.ts

tests/
  unit/validation.test.ts
  unit/metrics.test.ts
  unit/serialization.test.ts
  unit/plan-service.test.ts
  unit/task-service.test.ts
  unit/execution-service.test.ts
  unit/review-service.test.ts
  api/routes.test.ts
  component/dashboard.test.tsx
  component/execution-review.test.tsx
  e2e/t06.spec.ts
```

## Task 1: Scaffold the Next.js repository and test commands

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`

**Interfaces:**
- Produces the npm scripts and TypeScript path alias used by every later task.

- [ ] **Step 1: Scaffold the App Router project**

Run from the repository root:

```bash
npm init -y
npm install next react react-dom @supabase/supabase-js zod
npm install -D typescript @types/node @types/react @types/react-dom eslint eslint-config-next vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test
npx playwright install chromium
```

Create `app/layout.tsx` with `lang="ko"`, a descriptive page title, and a body wrapper. Create `app/page.tsx` with a temporary heading only; no application behavior belongs in this task.

- [ ] **Step 2: Add deterministic scripts**

Set these scripts in `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "verify": "npm run typecheck && npm run lint && npm test && npm run build"
  }
}
```

- [ ] **Step 3: Add environment and test configuration**

Create `.env.example` with names only:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PUBLIC_WORKSPACE_SLUG=public
APP_TIMEZONE=Asia/Seoul
```

The service-role key must never use a `NEXT_PUBLIC_` prefix. Configure Vitest for TypeScript and `jsdom`; configure Playwright to start `npm run dev` and use the local base URL.

- [ ] **Step 4: Run the baseline checks**

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Expected: all commands pass with the temporary page.

- [ ] **Step 5: Commit the scaffold**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts app .env.example .gitignore vitest.config.ts playwright.config.ts
git commit -m "chore: scaffold careerlog app"
```

## Task 2: Define the domain types, database migration, and schema contract

**Files:**
- Create: `lib/domain/types.ts`
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `contracts/pds-schema-v2.json`
- Create: `scripts/verify-schema.ts`
- Create: `tests/unit/validation.test.ts`

**Interfaces:**
- Produces `Plan`, `PlanRevision`, `Task`, `ExecutionRecord`, `Review`, `ReviewMetrics`, and `DashboardData` types.
- Produces the PostgreSQL tables and constraints consumed by all repositories.

- [ ] **Step 1: Write the domain type contract**

Define these exact unions and fields in `lib/domain/types.ts`:

```ts
export type TaskStatus = "todo" | "in_progress" | "done";
export type SortKey = "priority" | "due_date" | "estimated_minutes" | "created_at";

export interface Plan {
  id: string;
  workspaceId: string;
  title: string;
  startDate: string;
  endDate: string;
  priority: number;
  successCriteria: string;
  estimatedMinutes: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface PlanRevision extends Omit<Plan, "createdAt" | "updatedAt" | "archivedAt"> {
  revisionNo: number;
  savedAt: string;
}

export interface Task {
  id: string;
  planId: string;
  title: string;
  dueDate: string | null;
  priority: number;
  tag: string;
  estimatedMinutes: number;
  status: TaskStatus;
  blockedReason: string | null;
  completedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionRecord {
  id: string;
  taskId: string;
  startedAt: string;
  endedAt: string;
  actualMinutes: number;
  missedReason: string | null;
  idempotencyKey: string;
  createdAt: string;
}
```

Add input types for create/update operations and the following metrics shape:

```ts
export interface ReviewMetrics {
  planTaskCount: number;
  completedCount: number;
  delayedCount: number;
  blockedCount: number;
  expectedMinutes: number;
  actualMinutes: number;
  differenceMinutes: number;
  taskIdsByMetric: Record<"plan" | "completed" | "delayed" | "blocked", string[]>;
}
```

- [ ] **Step 2: Write the SQL migration**

Create `workspaces`, `plans`, `plan_revisions`, `tasks`, `execution_records`, and `reviews`. Apply these constraints:

```sql
check (priority between 1 and 5)
check (estimated_minutes >= 0)
check (end_date >= start_date)
check (status in ('todo', 'in_progress', 'done'))
unique (slug)
unique (plan_id, revision_no)
unique (idempotency_key)
```

Use UUID primary keys, `timestamptz` timestamps, `deleted_at` soft deletion, foreign keys, and indexes for `plan_id`, `task_id`, `due_date`, `status`, and `tag`. Do not add a user or auth table.

- [ ] **Step 3: Write the schema contract**

Create `contracts/pds-schema-v2.json` with a JSON object containing:

```json
{
  "schemaVersion": "pds-schema-v2",
  "timezone": "Asia/Seoul",
  "tables": [
    "workspaces",
    "plans",
    "plan_revisions",
    "tasks",
    "execution_records",
    "reviews"
  ],
  "relations": [
    "workspaces 1:N plans",
    "plans 1:N plan_revisions",
    "plans 1:N tasks",
    "tasks 1:N execution_records",
    "plans 1:N reviews",
    "reviews 0:1 plans(next_plan_id)"
  ]
}
```

Extend the file with every field, type, nullability rule, status value, and aggregation rule from the approved design. `scripts/verify-schema.ts` must parse the file and fail if any required table or relation is missing.

- [ ] **Step 4: Test the contract**

In `tests/unit/validation.test.ts`, assert that priorities are limited to 1–5, times are non-negative, dates are ordered, and status values are limited to the three domain values. Run:

```bash
npm test -- tests/unit/validation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the schema layer**

```bash
git add lib/domain/types.ts supabase/migrations/001_initial_schema.sql contracts/pds-schema-v2.json scripts/verify-schema.ts tests/unit/validation.test.ts
git commit -m "feat: define careerlog data contract"
```

## Task 3: Add the server database client and repository contracts

**Files:**
- Create: `lib/server/db.ts`
- Create: `lib/server/errors.ts`
- Create: `lib/server/repositories/contracts.ts`
- Create: `lib/server/repositories/plan-repository.ts`
- Create: `lib/server/repositories/task-repository.ts`
- Create: `lib/server/repositories/execution-repository.ts`
- Create: `lib/server/repositories/review-repository.ts`
- Create: `tests/api/routes.test.ts`

**Interfaces:**
- Consumes the domain types from Task 2.
- Produces repository methods that return camelCase domain objects and hide Supabase row names from services.

- [ ] **Step 1: Write the server-only database client**

Create `lib/server/db.ts` with a server-only Supabase client. It must read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, throw a configuration error if either is missing, disable session persistence, and never export the key to a client component.

- [ ] **Step 2: Define repository interfaces**

Define exact contracts such as:

```ts
export interface PlanRepository {
  getCurrent(workspaceId: string): Promise<Plan | null>;
  insert(workspaceId: string, input: CreatePlanInput): Promise<Plan>;
  updateWithRevision(planId: string, input: UpdatePlanInput): Promise<Plan>;
  listRevisions(planId: string): Promise<PlanRevision[]>;
}

export interface TaskRepository {
  list(planId: string, query: TaskQuery): Promise<Task[]>;
  insert(planId: string, input: CreateTaskInput): Promise<Task>;
  update(taskId: string, input: UpdateTaskInput): Promise<Task>;
  softDelete(taskId: string): Promise<void>;
}
```

Define equivalent contracts for execution and review operations. Every repository method must accept IDs explicitly and return a typed domain value or a typed repository error.

- [ ] **Step 3: Implement row mapping**

Map database snake_case fields to domain camelCase fields in one place per repository. Reject malformed rows instead of silently returning partial objects.

- [ ] **Step 4: Add repository error translation**

Create `NotFoundError`, `ValidationError`, `ConflictError`, and `DatabaseError` in `lib/server/errors.ts`. Convert unique-constraint failures for `idempotency_key` into `ConflictError` so the service can return the existing record.

- [ ] **Step 5: Run type and route contract checks**

```bash
npm run typecheck
npm test -- tests/api/routes.test.ts
```

Expected: the repository interfaces compile; route tests may contain only configuration and error translation tests at this stage.

- [ ] **Step 6: Commit the server foundation**

```bash
git add lib/server/db.ts lib/server/errors.ts lib/server/repositories tests/api/routes.test.ts
git commit -m "feat: add server database foundation"
```

## Task 4: Implement plan creation, editing, and revision history

**Files:**
- Create: `lib/domain/validation.ts`
- Create: `lib/server/services/plan-service.ts`
- Create: `app/api/plans/route.ts`
- Create: `app/api/plans/[planId]/route.ts`
- Create: `app/api/plans/[planId]/revisions/route.ts`
- Create: `tests/unit/plan-service.test.ts`

**Interfaces:**
- Consumes `PlanRepository` from Task 3.
- Produces `createPlan`, `updatePlan`, `getPlan`, and `listPlanRevisions` service functions.

- [ ] **Step 1: Write failing plan tests**

Cover these cases:

```ts
it("stores all required plan fields", async () => {
  const plan = await service.createPlan(validInput);
  expect(plan.priority).toBe(1);
  expect(plan.estimatedMinutes).toBe(120);
});

it("creates a revision before changing the current plan", async () => {
  await service.updatePlan(planId, changedInput);
  expect(repository.insertRevision).toHaveBeenCalledWith(
    expect.objectContaining({ planId, title: original.title })
  );
});
```

Run:

```bash
npm test -- tests/unit/plan-service.test.ts
```

Expected: FAIL before the service exists.

- [ ] **Step 2: Implement Zod plan validation**

Validate non-empty title and success criteria, ISO dates, `endDate >= startDate`, priority 1–5, and non-negative integer minutes. Return field-specific validation errors.

- [ ] **Step 3: Implement the plan service**

`updatePlan` must call the repository transaction that snapshots the current row and updates the same plan ID. It must not update tasks or execution records.

- [ ] **Step 4: Add Route Handlers**

Implement:

```text
POST  /api/plans
PATCH /api/plans/:planId
GET   /api/plans/:planId/revisions
```

Return `201` for creation, `200` for reads and updates, `400` for validation, `404` for unknown IDs, and `500` only for sanitized server errors.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- tests/unit/plan-service.test.ts
npm run typecheck
git add lib/domain/validation.ts lib/server/services/plan-service.ts app/api/plans tests/unit/plan-service.test.ts
git commit -m "feat: add plan revision workflow"
```

## Task 5: Implement task CRUD, search, filter, and deterministic sorting

**Files:**
- Create: `lib/server/services/task-service.ts`
- Create: `app/api/tasks/route.ts`
- Create: `app/api/tasks/[taskId]/route.ts`
- Create: `tests/unit/task-service.test.ts`

**Interfaces:**
- Consumes `TaskRepository` and validation from earlier tasks.
- Produces `createTask`, `updateTask`, `deleteTask`, and `listTasks`.

- [ ] **Step 1: Write failing task tests**

Test creation, update, done/in-progress transitions, soft deletion, title search, tag/status/priority filters, and tie-breaking sort:

```ts
it("uses id as a stable tie breaker", async () => {
  const result = await service.listTasks(planId, {
    sort: "priority",
    direction: "asc"
  });
  expect(result.map(task => task.id)).toEqual(["a", "b", "c"]);
});

it("does not return soft-deleted tasks", async () => {
  await service.deleteTask(taskId);
  expect(repository.list).toHaveBeenCalledWith(
    planId,
    expect.objectContaining({ includeDeleted: false })
  );
});
```

- [ ] **Step 2: Implement task validation and service methods**

Validate title, priority, tag, due date, non-negative estimated minutes, and the three allowed statuses. A delete operation sets `deleted_at`; it never removes the row.

- [ ] **Step 3: Implement task queries**

Build server-side query conditions for `q`, `status`, `tag`, `priority`, and the four approved sort keys. Always append `id ASC` as the final tie breaker.

- [ ] **Step 4: Add Route Handlers**

Implement:

```text
GET    /api/tasks?planId=&q=&status=&tag=&priority=&sort=&direction=
POST   /api/tasks
PATCH  /api/tasks/:taskId
DELETE /api/tasks/:taskId
```

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- tests/unit/task-service.test.ts
npm run typecheck
git add lib/server/services/task-service.ts app/api/tasks tests/unit/task-service.test.ts
git commit -m "feat: add task management and sorting"
```

## Task 6: Implement execution records, completion idempotency, and reopen

**Files:**
- Create: `lib/server/services/execution-service.ts`
- Create: `app/api/tasks/[taskId]/executions/route.ts`
- Create: `app/api/tasks/[taskId]/complete/route.ts`
- Create: `app/api/tasks/[taskId]/reopen/route.ts`
- Create: `tests/unit/execution-service.test.ts`

**Interfaces:**
- Consumes task and execution repositories.
- Produces `recordExecution`, `completeTask`, and `reopenTask`.

- [ ] **Step 1: Write failing execution tests**

Cover duration calculation, invalid time order, plan immutability, duplicate completion, and reopen:

```ts
it("calculates and stores actual minutes from start and end", async () => {
  const record = await service.recordExecution(taskId, {
    startedAt: "2026-09-07T09:00:00+09:00",
    endedAt: "2026-09-07T10:30:00+09:00",
    idempotencyKey: "00000000-0000-0000-0000-000000000001",
    missedReason: null
  });
  expect(record.actualMinutes).toBe(90);
});

it("returns the existing completion on a repeated key", async () => {
  const first = await service.completeTask(taskId, input);
  const second = await service.completeTask(taskId, input);
  expect(second.id).toBe(first.id);
  expect(repository.insert).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Implement duration and input validation**

Require valid timestamps, `endedAt > startedAt`, a UUID idempotency key, and non-empty task ID. Compute integer minutes on the server using UTC timestamp arithmetic; display in the configured Seoul timezone only at the UI boundary.

- [ ] **Step 3: Implement idempotent completion**

Within one transaction: look up the idempotency key, return the existing record if found, otherwise insert one execution record and set the task to `done` with `completed_at`. A repeated request must not increment any metric twice.

- [ ] **Step 4: Implement reopen**

Set the task to `in_progress` and clear `completed_at`. Do not delete prior execution records. A later deliberate completion can use a new idempotency key.

- [ ] **Step 5: Add Route Handlers and run tests**

Implement:

```text
POST /api/tasks/:taskId/executions
POST /api/tasks/:taskId/complete
POST /api/tasks/:taskId/reopen
```

Run:

```bash
npm test -- tests/unit/execution-service.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit the execution layer**

```bash
git add lib/server/services/execution-service.ts app/api/tasks tests/unit/execution-service.test.ts
git commit -m "feat: add execution records and idempotent completion"
```

## Task 7: Implement review metrics, correction carry-forward, and export

**Files:**
- Create: `lib/domain/metrics.ts`
- Create: `lib/domain/serialization.ts`
- Create: `lib/server/services/review-service.ts`
- Create: `app/api/reviews/[planId]/route.ts`
- Create: `app/api/reviews/[planId]/corrections/route.ts`
- Create: `app/api/dashboard/route.ts`
- Create: `app/api/export/route.ts`
- Create: `tests/unit/metrics.test.ts`
- Create: `tests/unit/serialization.test.ts`
- Create: `tests/unit/review-service.test.ts`

**Interfaces:**
- Consumes plans, tasks, execution records, and reviews.
- Produces `calculateReviewMetrics`, `getDashboardData`, `saveCorrection`, and `serializeExport`.

- [ ] **Step 1: Write metric tests from fixed examples**

Use an in-memory fixture with one deleted task, one completed task, one overdue incomplete task, one blocked task, and execution records with known durations. Assert:

```ts
expect(metrics.planTaskCount).toBe(4);
expect(metrics.completedCount).toBe(1);
expect(metrics.delayedCount).toBe(1);
expect(metrics.blockedCount).toBe(1);
expect(metrics.expectedMinutes).toBe(240);
expect(metrics.actualMinutes).toBe(210);
expect(metrics.differenceMinutes).toBe(-30);
```

Also assert that a completed task with an old due date is not counted as delayed and that every metric returns its source task IDs.

- [ ] **Step 2: Implement metrics as pure functions**

Keep `lib/domain/metrics.ts` independent of Supabase. Accept tasks, execution records, the current Seoul date, and return `ReviewMetrics`. This makes the aggregation testable without a live database.

- [ ] **Step 3: Implement review correction carry-forward**

Save one non-empty `correction_text` and either create a next plan or connect to an explicitly selected next plan. Store `next_plan_id` and preserve the originating review ID.

- [ ] **Step 4: Implement dashboard and review routes**

`GET /api/dashboard` returns the current plan, tasks, metrics, and recent execution records. `GET /api/reviews/:planId` returns metrics plus source IDs. `POST /api/reviews/:planId/corrections` stores the correction and next-plan link.

- [ ] **Step 5: Implement allowlisted JSON export**

`lib/domain/serialization.ts` must construct a new object from allowed fields only. Do not serialize environment variables, raw Supabase rows, request headers, or unknown input keys.

`GET /api/export` returns:

```text
Content-Type: application/json; charset=utf-8
Content-Disposition: attachment; filename="pds-export-v2.json"
```

- [ ] **Step 6: Test and commit**

```bash
npm test -- tests/unit/metrics.test.ts tests/unit/serialization.test.ts tests/unit/review-service.test.ts
npm run typecheck
git add lib/domain/metrics.ts lib/domain/serialization.ts lib/server/services/review-service.ts app/api/dashboard app/api/reviews app/api/export tests/unit
git commit -m "feat: add review metrics and export"
```

## Task 8: Build the public dashboard and plan/task management UI

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Create: `components/dashboard/Dashboard.tsx`
- Create: `components/dashboard/MetricButton.tsx`
- Create: `components/shared/PublicNotice.tsx`
- Create: `components/shared/ErrorMessage.tsx`
- Create: `components/shared/LoadingState.tsx`
- Create: `components/plan/PlanPanel.tsx`
- Create: `components/plan/PlanRevisionList.tsx`
- Create: `components/tasks/TaskPanel.tsx`
- Create: `components/tasks/TaskForm.tsx`
- Create: `components/tasks/TaskToolbar.tsx`
- Create: `tests/component/dashboard.test.tsx`

**Interfaces:**
- Consumes `/api/dashboard`, plan routes, and task routes.
- Produces an accessible public screen with working Plan and task workflows.

- [ ] **Step 1: Write component tests for the public warning and metrics**

Assert that the first screen renders:

```ts
expect(screen.getByText(/로그인 기능이 없습니다/)).toBeInTheDocument();
expect(screen.getByRole("button", { name: /완료/ })).toBeInTheDocument();
expect(screen.getByRole("button", { name: /지연/ })).toBeInTheDocument();
```

Use accessible labels for every form field and button. A metric is a real button, not a non-interactive number.

- [ ] **Step 2: Implement the dashboard fetch and loading/error states**

Fetch `/api/dashboard` on the client, show `LoadingState` during the request, and show `ErrorMessage` with a retry action on failure. Do not render secrets or raw database errors.

- [ ] **Step 3: Implement plan editing and revision display**

Render the current plan fields, submit a `PATCH` request, then refetch the plan and revisions. Show the current value separately from the previous revision values.

- [ ] **Step 4: Implement task forms and task toolbar**

Support create, edit, soft delete, status transition, search, filters, and the four deterministic sort keys. After each successful mutation, refetch from the server instead of mutating a stale local copy.

- [ ] **Step 5: Add visual hierarchy and responsive layout**

Use one clear public notice, one current-plan area, one task list, and one review area. Keep body text readable, make the Plan–Do–See sequence visible, and ensure the desktop layout collapses to a single column without horizontal scrolling.

- [ ] **Step 6: Run component checks and commit**

```bash
npm test -- tests/component/dashboard.test.tsx
npm run typecheck
git add app/page.tsx app/globals.css components/dashboard components/shared components/plan components/tasks tests/component/dashboard.test.tsx
git commit -m "feat: add public dashboard and task UI"
```

## Task 9: Build execution, review, drill-down, and export UI

**Files:**
- Create: `components/execution/ExecutionForm.tsx`
- Create: `components/review/ReviewPanel.tsx`
- Create: `components/review/ReviewDetailList.tsx`
- Create: `components/export/ExportButton.tsx`
- Create: `tests/component/execution-review.test.tsx`
- Modify: `components/tasks/TaskPanel.tsx`
- Modify: `components/dashboard/Dashboard.tsx`

**Interfaces:**
- Consumes execution, review, dashboard, and export routes from Tasks 6–7.
- Produces the complete Plan–Do–See interaction.

- [ ] **Step 1: Write the execution component test**

Assert that submitting the same completion action twice sends the same idempotency key and displays one saved result. The test must verify the API call payload, not only that a button becomes disabled.

- [ ] **Step 2: Implement execution recording**

Provide task selection, start and end datetime controls, a missed-reason field, and a server-calculated duration display. Show validation errors without clearing the other fields.

- [ ] **Step 3: Implement complete/reopen controls**

Generate one UUID when a deliberate completion action begins, reuse it for retries, and clear it only after the request finishes. Provide a separate reopen action that does not delete past execution records.

- [ ] **Step 4: Implement review metrics and drill-down**

Render plan, completed, delayed, blocked, expected, actual, and difference values. Clicking a metric requests the source task IDs and highlights or filters the related tasks.

- [ ] **Step 5: Implement correction carry-forward**

Require non-empty correction text, save it through the review route, and show the resulting next-plan link. Do not claim that a correction was carried forward until the server response succeeds.

- [ ] **Step 6: Implement export download**

Use the server response headers to download `pds-export-v2.json`. Show a failure message if the response is not successful.

- [ ] **Step 7: Run UI tests and commit**

```bash
npm test -- tests/component/execution-review.test.tsx tests/unit
npm run typecheck
git add components app/page.tsx tests/component/execution-review.test.tsx
git commit -m "feat: complete plan-do-see workflow UI"
```

## Task 10: Add real-data seeding, script safety, and schema verification

**Files:**
- Create: `supabase/seed.sql`
- Create: `tests/unit/serialization.test.ts` additions
- Create: `tests/e2e/t06.spec.ts`
- Modify: `contracts/pds-schema-v2.json`
- Modify: `scripts/verify-schema.ts`

**Interfaces:**
- Consumes all routes and components.
- Produces repeatable local and deployed verification of T06 behavior.

- [ ] **Step 1: Seed only safe plan and task content**

Seed one `public` workspace, one plan, and the seven preparation task titles from the approved design. Do not seed fabricated execution times or mark a task complete on behalf of the user.

- [ ] **Step 2: Add the real-data entry checklist to the UI**

Show a small setup checklist indicating whether the current workspace has at least one plan, five tasks, and three execution records. The checklist must reflect database state and must not fabricate completion.

- [ ] **Step 3: Add script-like text coverage**

In `tests/e2e/t06.spec.ts`, create a task with title `<script>alert(1)</script>` and assert the rendered page contains the literal text and no dialog appears.

- [ ] **Step 4: Add end-to-end T06 coverage**

The Playwright flow must:

1. Open `/` without login.
2. Edit a plan and confirm a revision.
3. Create five tasks and exercise search, filter, and sort.
4. Complete one task with a repeated request and verify one record.
5. Reopen it and verify the count changes once.
6. Open review metrics and drill down to source tasks.
7. Save one correction to a next plan.
8. Refresh and confirm IDs and values persist.
9. Download the JSON export.

- [ ] **Step 5: Run the full local verification**

```bash
npm run verify
npm run test:e2e
```

Expected: typecheck, lint, unit tests, production build, and Playwright tests pass.

- [ ] **Step 6: Commit verification assets**

```bash
git add supabase/seed.sql contracts/pds-schema-v2.json scripts/verify-schema.ts tests/e2e/t06.spec.ts tests/unit/serialization.test.ts
git commit -m "test: verify T06 persistence and safety"
```

## Task 11: Deploy the app and prepare the submission evidence

**Files:**
- Modify: `README.md`
- Create: `docs/t06-reproduction.md`
- Create: `docs/t06-ai-judgment.md`
- Create: `.env.example` additions only if a non-secret variable is missing

**Interfaces:**
- Consumes the exact passing commit from Task 10.
- Produces the public result URL, exact full commit URL, and submission text.

- [ ] **Step 1: Confirm deployment prerequisites**

Confirm that a Supabase project exists and that production environment variables are configured outside the repository:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
PUBLIC_WORKSPACE_SLUG=public
APP_TIMEZONE=Asia/Seoul
```

Do not commit the service-role key. If no GitHub remote exists, stop before pushing and ask the user for the target repository URL; do not invent one.

- [ ] **Step 2: Apply the migration and seed workspace data**

Apply `supabase/migrations/001_initial_schema.sql`. Insert the public workspace and safe task content. Enter the user's real execution records through the app and confirm there are at least three before submission.

- [ ] **Step 3: Deploy the exact tested commit**

Run the production build from the same commit that passed Task 10. Set server-only environment variables in the deployment platform. Open the production URL in a new incognito window and confirm no login, OAuth, CAPTCHA, or account creation is required.

- [ ] **Step 4: Write the four-step reproduction guide**

`docs/t06-reproduction.md` must contain exactly four short steps using this shape:

```text
1. 어디로 가나요: 공개 결과 URL
2. 무엇을 하나요: 계획 수정 → 할 일 완료 → 돌아보기 이동
3. 무엇이 보이면 통과인가요: 수정 이력·실행 기록·집계와 상세 기록이 보임
4. 안 될 때 무엇이 보이나요: 화면의 오류 문구와 재시도 방법
```

Use the real deployed URL and the actual visible labels.

- [ ] **Step 5: Write the AI and personal judgment three lines**

`docs/t06-ai-judgment.md` must contain three separate lines:

```text
AI에게 맡긴 일: 요구사항 분해, 데이터 구조 초안, 검증 시나리오 정리
내가 직접 판단한 일: 공개 화면에 회사명을 표시하지 않고 목표 직무명만 사용하기로 결정
AI 말을 따르지 않은 일: 허구의 실행 기록을 demo 데이터로 넣지 않기로 결정 — 실제 기록만 제출해야 하기 때문
```

Adjust the first line only if the actual division of work differs.

- [ ] **Step 6: Capture final evidence and commit submission docs**

Confirm the result URL, full 40-character or 64-character lowercase commit URL, and selected evidence file. Then run:

```bash
git add README.md docs/t06-reproduction.md docs/t06-ai-judgment.md
git commit -m "docs: prepare T06 submission"
git rev-parse HEAD
```

Use the exact output of `git rev-parse HEAD` in the source URL; never use a branch URL or abbreviated hash.

## Execution Order and Checkpoints

Implement Tasks 1–3 first and stop for a checkpoint. The project should typecheck, have the database contract, and have server-only DB access before feature work begins. Then implement Tasks 4–7 as the backend vertical slice, run unit tests, and stop for a checkpoint. Then implement Tasks 8–10 as the UI and verification slice. Deploy only after the local `npm run verify` and `npm run test:e2e` both pass.

## Plan Self-Review

- Spec coverage: T06 plan fields and revision history are Task 4; task CRUD/search/filter/sort are Task 5; execution and idempotency are Task 6; metrics, drill-down, correction, and export are Task 7; public UI is Tasks 8–9; persistence, XSS, real-data constraints, and evidence are Tasks 10–11.
- Placeholder scan: no unresolved placeholder marker or unspecified implementation step is required.
- Type consistency: all services consume repository contracts and return the domain types from `lib/domain/types.ts`; API paths match the approved design and component calls.
- Scope check: the plan covers one independent T06 application. AI-assisted resume writing, multi-user auth, and automated job submission are explicitly excluded.
