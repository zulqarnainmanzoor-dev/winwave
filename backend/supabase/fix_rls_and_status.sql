-- ================================================================
-- RUN THIS ENTIRE SCRIPT IN SUPABASE SQL EDITOR
-- ================================================================

-- 1. Add status column to public.users (fixes suspend/ban error)
alter table public.users
  add column if not exists status text not null default 'active';

-- 2. Ensure transactions has all required columns
alter table public.transactions
  add column if not exists type   text default 'deposit',
  add column if not exists bonus  numeric(15,2) default 0,
  add column if not exists status text default 'pending';

-- 3. Ensure withdraw_requests has all required columns
alter table public.withdraw_requests
  add column if not exists bank_name      text,
  add column if not exists account_name   text,
  add column if not exists account_number text,
  add column if not exists reason         text,
  add column if not exists status         text default 'pending';

-- 4. Fix RLS — service_role bypasses RLS by default in Supabase,
--    but we also need authenticated users (admin panel) to read/write.

-- public.users: drop all old policies, recreate clean set
alter table public.users enable row level security;
drop policy if exists "users_select_own"          on public.users;
drop policy if exists "users_insert_authenticated" on public.users;
drop policy if exists "users_update_own"          on public.users;
drop policy if exists "users_service_role_all"    on public.users;
drop policy if exists "Users can read own data"   on public.users;
drop policy if exists "Users can update own data" on public.users;
drop policy if exists "Service role full access"  on public.users;

create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id or auth.role() = 'service_role');

create policy "users_insert_own"
  on public.users for insert
  with check (auth.uid() = id or auth.role() = 'service_role');

create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id or auth.role() = 'service_role')
  with check (auth.uid() = id or auth.role() = 'service_role');

create policy "users_service_all"
  on public.users for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- public.transactions
alter table public.transactions enable row level security;
drop policy if exists "transactions_select_own"    on public.transactions;
drop policy if exists "transactions_insert_own"    on public.transactions;
drop policy if exists "transactions_update_service" on public.transactions;
drop policy if exists "transactions_service_all"   on public.transactions;

create policy "transactions_select_own"
  on public.transactions for select
  using (auth.uid() = user_id or auth.role() = 'service_role');

create policy "transactions_insert_own"
  on public.transactions for insert
  with check (auth.uid() = user_id or auth.role() = 'service_role');

create policy "transactions_service_all"
  on public.transactions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- public.withdraw_requests
alter table public.withdraw_requests enable row level security;
drop policy if exists "wr_select_own"   on public.withdraw_requests;
drop policy if exists "wr_insert_own"   on public.withdraw_requests;
drop policy if exists "wr_update_service" on public.withdraw_requests;
drop policy if exists "wr_service_all"  on public.withdraw_requests;

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

-- public.gift_codes
alter table public.gift_codes enable row level security;
drop policy if exists "gc_user_read"    on public.gift_codes;
drop policy if exists "gc_service_all"  on public.gift_codes;
drop policy if exists "gc_read_active"  on public.gift_codes;
drop policy if exists "gc_authenticated_read"   on public.gift_codes;
drop policy if exists "gc_authenticated_write"  on public.gift_codes;
drop policy if exists "gc_authenticated_update" on public.gift_codes;
drop policy if exists "gc_authenticated_delete" on public.gift_codes;

create policy "gc_user_read"
  on public.gift_codes for select
  using (status = 'active' or auth.role() = 'service_role');

create policy "gc_service_all"
  on public.gift_codes for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- public.gift_code_claims
alter table public.gift_code_claims enable row level security;
drop policy if exists "gcc_own"         on public.gift_code_claims;
drop policy if exists "gcc_service_all" on public.gift_code_claims;

create policy "gcc_own"
  on public.gift_code_claims for all
  using (auth.uid() = user_id or auth.role() = 'service_role')
  with check (auth.uid() = user_id or auth.role() = 'service_role');

-- public.attendance_bonus
alter table public.attendance_bonus enable row level security;
drop policy if exists "ab_own" on public.attendance_bonus;

create policy "ab_own"
  on public.attendance_bonus for all
  using (auth.uid() = user_id or auth.role() = 'service_role')
  with check (auth.uid() = user_id or auth.role() = 'service_role');
