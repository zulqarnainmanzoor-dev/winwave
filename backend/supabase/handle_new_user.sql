-- Auto-provision app records when a new auth user is created.
--
-- WHY: the frontend registers users with supabase.auth.signUp(), which only
-- creates a row in auth.users. Without this trigger the matching rows in
-- public.users / public.profiles / public.wallets are never written, so logged
-- in accounts have no profile, balance, or wallet ("accounts aren't saving").
--
-- This trigger runs in the SAME transaction as the auth user insert, so the
-- profile/wallet creation is synchronous and atomic with sign-up.
--
-- Identity model: auth.users.id is the single source of truth and is reused as
-- the primary key of both public.users and public.profiles. The 6-digit numeric
-- code is the user-facing display id and doubles as the invite/referral code.
--
-- Run this once in the Supabase SQL editor.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone   text;
  v_code    text;
  v_inviter uuid;
  v_raw_invite text;
begin
  -- Phone comes from sign-up metadata, falling back to the email local part.
  v_phone := coalesce(
    nullif(new.raw_user_meta_data->>'phone', ''),
    split_part(new.email, '@', 1)
  );

  -- Generate a unique 6-digit numeric code (e.g. "634079").
  loop
    v_code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    exit when not exists (select 1 from public.profiles where invite_code = v_code)
          and not exists (select 1 from public.users where referral_code = v_code);
  end loop;

  -- Resolve an optional inviter from the invitation code (numeric or raw).
  v_raw_invite := regexp_replace(coalesce(new.raw_user_meta_data->>'invitation_code', ''), '\D', '', 'g');
  if v_raw_invite <> '' then
    select id into v_inviter
    from public.profiles
    where invite_code = left(v_raw_invite, 6)
    limit 1;
  end if;

  insert into public.users (id, phone_number, password_hash, referral_code, referred_by, vip_level, is_active)
  values (new.id, v_phone, 'supabase_auth', v_code, v_inviter, 0, true)
  on conflict (id) do nothing;

  insert into public.profiles (id, phone, username, vip_level, balance, invite_code, inviter_id, last_active)
  values (new.id, v_phone, 'MEMBER_' || right(v_phone, 4), 0, 0, v_code, v_inviter, now())
  on conflict (id) do nothing;

  insert into public.wallets (user_id, main_balance, wagering_required, wagering_completed, total_recharged, total_withdrawn)
  values (new.id, 0, 0, 0, 0, 0);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
