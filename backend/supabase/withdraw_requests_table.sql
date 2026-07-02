-- Run in Supabase SQL Editor

create table if not exists public.withdraw_requests (
  id             text         primary key default ('WD-' || extract(epoch from now())::bigint || '-' || floor(random()*9000+1000)::int),
  user_id        uuid         references public.users(id) on delete cascade,
  amount         numeric(15,2) not null check (amount > 0),
  bank_name      text,
  account_name   text,
  account_number text,
  status         text         not null default 'pending',  -- pending | approved | rejected
  reason         text,
  created_at     timestamptz  default now()
);

alter table public.withdraw_requests
  add column if not exists reason text;

create index if not exists idx_withdraw_requests_user_id    on public.withdraw_requests(user_id);
create index if not exists idx_withdraw_requests_status     on public.withdraw_requests(status);
create index if not exists idx_withdraw_requests_created_at on public.withdraw_requests(created_at desc);

-- RLS
alter table public.withdraw_requests enable row level security;

drop policy if exists "wr_select_own"      on public.withdraw_requests;
drop policy if exists "wr_insert_own"      on public.withdraw_requests;
drop policy if exists "wr_service_all"     on public.withdraw_requests;

create policy "wr_select_own"
  on public.withdraw_requests for select
  using (auth.uid() = user_id or auth.role() = 'service_role');

create policy "wr_insert_own"
  on public.withdraw_requests for insert
  with check (auth.uid() = user_id or auth.role() = 'service_role');

create policy "wr_service_all"
  on public.withdraw_requests for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
