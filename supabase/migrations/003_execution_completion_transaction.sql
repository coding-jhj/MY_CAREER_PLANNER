create or replace function public.complete_task_with_execution(
  p_task_id uuid,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_missed_reason text,
  p_idempotency_key uuid
)
returns public.execution_records
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing_execution public.execution_records%rowtype;
  saved_execution public.execution_records%rowtype;
begin
  -- Retries return their original execution before checking mutable task state.
  select * into existing_execution
  from public.execution_records
  where idempotency_key = p_idempotency_key;
  if found then
    if existing_execution.task_id <> p_task_id then
      raise exception 'Idempotency key belongs to a different task'
        using errcode = 'P0001', detail = 'idempotency_key_task_mismatch';
    end if;
    return existing_execution;
  end if;

  if p_ended_at <= p_started_at then
    raise exception 'ended_at must be after started_at' using errcode = '22007';
  end if;

  -- Serialize completion transitions for one task, including the task update below.
  perform 1 from public.tasks where id = p_task_id and deleted_at is null for update;
  if not found then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;

  select * into existing_execution
  from public.execution_records
  where idempotency_key = p_idempotency_key;
  if found then
    if existing_execution.task_id <> p_task_id then
      raise exception 'Idempotency key belongs to a different task'
        using errcode = 'P0001', detail = 'idempotency_key_task_mismatch';
    end if;
    return existing_execution;
  end if;

  begin
    insert into public.execution_records (
      task_id, started_at, ended_at, actual_minutes, missed_reason, idempotency_key
    ) values (
      p_task_id,
      p_started_at,
      p_ended_at,
      floor(extract(epoch from (p_ended_at - p_started_at)) / 60)::integer,
      p_missed_reason,
      p_idempotency_key
    ) returning * into saved_execution;
  exception when unique_violation then
    -- A concurrent request won the globally-unique key race. Its committed row is authoritative.
    select * into saved_execution
    from public.execution_records
    where idempotency_key = p_idempotency_key;
    if not found then
      raise;
    end if;
    if saved_execution.task_id <> p_task_id then
      raise exception 'Idempotency key belongs to a different task'
        using errcode = 'P0001', detail = 'idempotency_key_task_mismatch';
    end if;
    return saved_execution;
  end;

  update public.tasks
  set status = 'done', completed_at = p_ended_at, updated_at = now()
  where id = p_task_id;

  return saved_execution;
end;
$$;

create or replace function public.record_execution_for_active_task(
  p_task_id uuid,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_missed_reason text,
  p_idempotency_key uuid
)
returns public.execution_records
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved_execution public.execution_records%rowtype;
begin
  if p_ended_at <= p_started_at then
    raise exception 'ended_at must be after started_at' using errcode = '22007';
  end if;

  perform 1 from public.tasks where id = p_task_id and deleted_at is null for update;
  if not found then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;

  insert into public.execution_records (
    task_id, started_at, ended_at, actual_minutes, missed_reason, idempotency_key
  ) values (
    p_task_id,
    p_started_at,
    p_ended_at,
    floor(extract(epoch from (p_ended_at - p_started_at)) / 60)::integer,
    p_missed_reason,
    p_idempotency_key
  ) returning * into saved_execution;

  return saved_execution;
end;
$$;
