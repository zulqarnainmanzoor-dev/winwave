-- Supabase SQL for public.users table schema
-- Apply this in the Supabase SQL Editor to ensure proper columns exist

-- The public.users table stores all user profile data
-- It mirrors the auth.users id but adds app-specific columns
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  phone_number text unique,
  referral_code text unique,
  referred_by uuid references public.users(id),
  withdrawal_pin text,
  bank_details jsonb default '{}'::jsonb,
  vip_level integer default 0,
  wagered_amount numeric(15,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add indexes for performance
create index if not exists idx_users_phone_number on public.users(phone_number);
create index if not exists idx_users_referral_code on public.users(referral_code);
create index if not exists idx_users_referred_by on public.users(referred_by);

-- Enable Row Level Security
alter table public.users enable row level security;

-- Policies
create policy "Users can read own data"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own data"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Service role can do all operations (used by backend)
create policy "Service role full access"
  on public.users for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');