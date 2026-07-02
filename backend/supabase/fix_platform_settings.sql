-- ================================================================
-- FIX platform_settings: drop & recreate with correct schema
-- Run this in Supabase SQL Editor
-- ================================================================

drop table if exists public.platform_settings cascade;

create table public.platform_settings (
  id                    text primary key,
  platform_name         text          default 'WinWave',
  maintenance_mode      boolean       default false,
  min_withdrawal        numeric(15,2) default 1000,
  max_withdrawal        numeric(15,2) default 500000,
  withdrawal_fee        numeric(5,2)  default 2.5,
  deposit_bonus         numeric(5,2)  default 50,
  referral_commission   numeric(5,2)  default 10,
  max_bet_per_round     numeric(15,2) default 500000,
  min_bet_per_round     numeric(15,2) default 100,
  platform_margin_target numeric(5,2) default 8.5,
  game_control_enabled  boolean       default true,
  smart_risk_default    boolean       default false,
  notifications_enabled boolean       default true,
  auto_approve_deposit  boolean       default false
);

-- Insert the single default row
insert into public.platform_settings (id) values ('default');

-- RLS
alter table public.platform_settings enable row level security;

create policy "ps_authenticated_all"
  on public.platform_settings for all
  using (auth.role() = 'authenticated' or auth.role() = 'service_role')
  with check (auth.role() = 'authenticated' or auth.role() = 'service_role');
