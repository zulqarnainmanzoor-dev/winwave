-- Supabase SQL for enforcing invitation code validation before profile creation.
-- Apply this in the Supabase SQL Editor.

create or replace function public.validate_invitation_code()
returns trigger
language plpgsql
as $$
declare
  ref_exists boolean;
begin
  if new.invitation_code is null or btrim(new.invitation_code) = '' then
    raise exception 'Invalid Invitation Code';
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.referral_code = btrim(new.invitation_code)
  ) into ref_exists;

  if not ref_exists then
    raise exception 'Invalid Invitation Code';
  end if;

  return new;
end;
$$;

create or replace trigger trg_validate_invitation_code
before insert on public.profiles
for each row
execute function public.validate_invitation_code();
