-- Step 1: Add missing columns to public.users (run once)
alter table public.users
  add column if not exists inviter_code text default null,
  add column if not exists referral_code text unique;

-- Step 2: Drop the old broken trigger (targeted at non-existent public.profiles)
drop trigger if exists trg_validate_invitation_code on public.profiles;
drop function if exists public.validate_invitation_code();

-- Step 3: Read referral/inviter codes from auth.users raw metadata only
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb;
  v_referral_code text;
  v_inviter_code text;
begin
  v_meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_referral_code := upper(trim(v_meta->>'referral_code'));
  v_inviter_code := nullif(btrim(coalesce(v_meta->>'inviter_code', '')), '');

  if v_referral_code is not null and btrim(v_referral_code) = '' then
    v_referral_code := null;
  end if;

  if v_referral_code is not null or v_inviter_code is not null then
    insert into public.users (id, referral_code, inviter_code)
    values (new.id, v_referral_code, v_inviter_code)
    on conflict (id) do update
      set referral_code = excluded.referral_code,
          inviter_code = excluded.inviter_code;
  end if;

  return new;
end;
$$;

-- Step 4: Attach trigger to auth.users AFTER INSERT
drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
after insert on auth.users
for each row
execute function public.handle_new_user();
