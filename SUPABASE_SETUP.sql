-- ── UNIOSUNTH Nursing Research Tool — Supabase Setup ──────────────────────
-- Run this entire script once in: Supabase Dashboard → SQL Editor → New Query

-- Drop and recreate cleanly (safe to re-run)
drop table if exists assessment_records;

create table assessment_records (
  id                 text        primary key,
  submitted_at       timestamptz default now(),
  nurse_code         text        not null,
  ward               text        not null,
  shift              text        not null,
  qualification      text        not null,
  years_experience   text        not null,
  patient_load       text        not null,
  assessment_date    text        not null,
  workload_score     integer     not null,
  ipc_score          integer     not null,
  workload_category  text        not null,
  ipc_category       text        not null,
  subscore_workload  jsonb       not null default '{}',
  subscore_ipc       jsonb       not null default '{}',
  workload_responses jsonb       not null default '{}',
  ipc_responses      jsonb       not null default '{}'
);

-- Enable Row Level Security
alter table assessment_records enable row level security;

-- Nurses (anonymous users) can INSERT their own records
create policy "nurses_insert"
  on assessment_records for insert
  to anon
  with check (true);

-- Anyone with the anon key can SELECT all records (coordinator access)
-- To restrict: require a coordinator login via Supabase Auth instead
create policy "coordinator_select"
  on assessment_records for select
  to anon
  using (true);

-- ── Optional: view for quick reporting ─────────────────────────────────────
create or replace view assessment_summary as
select
  id,
  submitted_at,
  nurse_code,
  ward,
  shift,
  qualification,
  years_experience::integer as years_experience,
  patient_load::integer     as patient_load,
  workload_score,
  ipc_score,
  workload_category,
  ipc_category
from assessment_records
order by submitted_at desc;
