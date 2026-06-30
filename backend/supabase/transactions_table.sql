-- Transactions ledger for wallet "Move In" (deposits) and "Move Out" (withdrawals).
-- Run this in the Supabase SQL editor.

create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null check (type in ('move_in', 'move_out')),
  amount      numeric(14, 2) not null check (amount >= 0),
  status      text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  gateway_ref text,
  created_at  timestamptz not null default now()
);

create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_created_at_idx on public.transactions (created_at desc);
-- Used to look up a pending deposit by its gateway reference from the webhook.
create unique index if not exists transactions_gateway_ref_key
  on public.transactions (gateway_ref)
  where gateway_ref is not null;

alter table public.transactions enable row level security;

-- A user may read only their own transactions.
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
  on public.transactions
  for select
  using (auth.uid() = user_id);

-- Inserts/updates are performed server-side with the service-role key, which
-- bypasses RLS. We deliberately do NOT grant insert/update to the `authenticated`
-- role so clients can never credit their own wallet ledger directly.
