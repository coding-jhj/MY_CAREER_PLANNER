create extension if not exists pgcrypto;

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  timezone text not null default 'Asia/Seoul',
  created_at timestamptz not null default now()
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  title text not null,
  start_date date not null,
  end_date date not null,
  priority integer not null check (priority between 1 and 5),
  success_criteria text not null,
  estimated_minutes integer not null check (estimated_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (end_date >= start_date)
);

create table plan_revisions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id),
  revision_no integer not null,
  title text not null,
  start_date date not null,
  end_date date not null,
  priority integer not null check (priority between 1 and 5),
  success_criteria text not null,
  estimated_minutes integer not null check (estimated_minutes >= 0),
  saved_at timestamptz not null default now(),
  unique (plan_id, revision_no),
  check (end_date >= start_date)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id),
  title text not null,
  due_date date,
  priority integer not null check (priority between 1 and 5),
  tag text not null,
  estimated_minutes integer not null check (estimated_minutes >= 0),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  blocked_reason text,
  completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table execution_records (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  actual_minutes integer not null check (actual_minutes >= 0),
  missed_reason text,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  check (ended_at >= started_at)
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id),
  correction_text text not null,
  next_plan_id uuid references plans(id),
  created_at timestamptz not null default now()
);

create index plans_workspace_id_idx on plans(workspace_id);
create index plan_revisions_plan_id_idx on plan_revisions(plan_id);
create index tasks_plan_id_idx on tasks(plan_id);
create index tasks_due_date_idx on tasks(due_date);
create index tasks_status_idx on tasks(status);
create index tasks_tag_idx on tasks(tag);
create index execution_records_task_id_idx on execution_records(task_id);
create index reviews_plan_id_idx on reviews(plan_id);
