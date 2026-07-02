-- ================================================================
-- RUN THIS ENTIRE SCRIPT IN SUPABASE SQL EDITOR
-- ================================================================

-- ── 1. Fix the NOT NULL constraint that blocks every signup ──────
-- referral_code column exists with NOT NULL — make it nullable
-- (invite_code is the new column; referral_code is legacy)
alter table public.users
  alter column referral_code drop not null;

-- Add all required columns safely
alter table public.users
  add column if not exists invite_code          text,
  add column if not exists inviter_code         text         default null,
  add column if not exists vip_level            integer      default 0,
  add column if not exists total_bets           numeric(15,2) default 0,
  add column if not exists is_agent             boolean      default false,
  add column if not exists agent_id             uuid         references public.users(id),
  add column if not exists main_balance         numeric(15,2) default 0,
  add column if not exists game_balance         numeric(15,2) default 0,
  add column if not exists wagering_required    numeric(15,2) default 0,
  add column if not exists wagering_completed   numeric(15,2) default 0,
  add column if not exists manual_verification  boolean      default false,
  add column if not exists updated_at           timestamptz  default now();

-- Add unique index on invite_code (not a constraint, so it won't block nulls)
create unique index if not exists users_invite_code_unique
  on public.users (invite_code)
  where invite_code is not null;

-- ── 2. Fix transactions table — add missing columns ──────────────
create table if not exists public.transactions (
  id          text        primary key,
  user_id     uuid        references public.users(id) on delete cascade,
  type        text        not null,   -- 'deposit' | 'withdraw'
  amount      numeric(15,2) not null,
  bonus       numeric(15,2) default 0,
  status      text        not null default 'pending',  -- 'pending' | 'completed' | 'failed'
  gateway_ref text        default null,
  created_at  timestamptz default now()
);

-- If table already exists, add missing columns
alter table public.transactions
  add column if not exists bonus       numeric(15,2) default 0,
  add column if not exists status      text          default 'pending',
  add column if not exists gateway_ref text          default null;

create index if not exists idx_transactions_user_id    on public.transactions(user_id);
create index if not exists idx_transactions_type       on public.transactions(type);
create index if not exists idx_transactions_created_at on public.transactions(created_at desc);

-- ── 3. Drop old broken trigger + function ───────────────────────
drop trigger  if exists trg_handle_new_user  on public.users;
drop trigger  if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;

-- ── 4. New handle_new_user — resolves inviter_code → referred_by UUID ──
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_code text;
  code_taken     boolean;
  raw_meta       jsonb;
  p_phone        text;
  p_inviter_code text;
  p_referred_by  uuid := null;
begin
  raw_meta       := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  p_phone        := coalesce(raw_meta->>'phone_number', raw_meta->>'phone', '');
  p_inviter_code := nullif(btrim(coalesce(raw_meta->>'inviter_code', '')), '');

  -- Resolve inviter_code text → referrer UUID
  if p_inviter_code is not null then
    select id into p_referred_by
    from public.users
    where invite_code = p_inviter_code
    limit 1;
  end if;

  -- Generate unique 6-digit invite_code
  loop
    generated_code := lpad(floor(random() * 900000 + 100000)::text, 6, '0');
    select exists(
      select 1 from public.users where invite_code = generated_code
    ) into code_taken;
    exit when not code_taken;
  end loop;

  insert into public.users (
    id, phone_number, invite_code, inviter_code, referred_by,
    vip_level, total_bets, is_agent,
    main_balance, game_balance,
    wagering_required, wagering_completed,
    manual_verification, created_at, updated_at
  ) values (
    new.id,
    nullif(p_phone, ''),
    generated_code,
    p_inviter_code,
    p_referred_by,       -- UUID of the referrer, NULL if no valid invite code
    0, 0, false,
    0, 0,
    0, 0,
    false, now(), now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ── 5. Attach trigger to auth.users ─────────────────────────────
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ── 6. RLS policies ─────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "Users can read own data"       on public.users;
drop policy if exists "Users can update own data"     on public.users;
drop policy if exists "Service role full access"      on public.users;
drop policy if exists select_own_user                 on public.users;
drop policy if exists update_own_user                 on public.users;
drop policy if exists "users_select_own"              on public.users;
drop policy if exists "users_insert_authenticated"    on public.users;
drop policy if exists "users_update_own"              on public.users;
drop policy if exists "users_service_role_all"        on public.users;

create policy "users_select_own"
  on public.users for select using (auth.uid() = id);

create policy "users_insert_authenticated"
  on public.users for insert
  with check (auth.uid() = id or auth.role() = 'service_role');

create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "users_service_role_all"
  on public.users for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Transactions: users see only their own rows
drop policy if exists "transactions_select_own" on public.transactions;
drop policy if exists "transactions_insert_own" on public.transactions;
drop policy if exists "transactions_service_all" on public.transactions;

create policy "transactions_select_own"
  on public.transactions for select using (auth.uid() = user_id);

create policy "transactions_insert_own"
  on public.transactions for insert
  with check (auth.uid() = user_id or auth.role() = 'service_role');

create policy "transactions_service_all"
  on public.transactions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
