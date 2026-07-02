-- Step 1: Add missing columns to public.users (run once)
alter table public.users
  add column if not exists inviter_code text default null,
  add column if not exists referral_code text unique;

-- Step 2: Drop the old broken trigger (targeted at non-existent public.profiles)
drop trigger if exists trg_validate_invitation_code on public.profiles;
drop function if exists public.validate_invitation_code();

-- Step 3: Function to auto-generate a unique 6-digit referral_code on insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  new_code text;
  code_exists boolean;
begin
  -- Generate unique 6-digit referral_code
  loop
    new_code := lpad(floor(random() * 900000 + 100000)::text, 6, '0');
    select exists(select 1 from public.users where referral_code = new_code) into code_exists;
    exit when not code_exists;
  end loop;

  new.referral_code := new_code;

  -- inviter_code: only keep if it was explicitly passed, otherwise force NULL
  if new.inviter_code is not null and btrim(new.inviter_code) = '' then
    new.inviter_code := null;
  end if;

  return new;
end;
$$;

-- Step 4: Attach trigger to public.users BEFORE INSERT
drop trigger if exists trg_handle_new_user on public.users;
create trigger trg_handle_new_user
before insert on public.users
for each row
execute function public.handle_new_user();
