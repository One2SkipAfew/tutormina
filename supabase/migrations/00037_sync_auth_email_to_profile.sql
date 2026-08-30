-- Trigger to sync auth.users updates (specifically email) to public.profiles

create or replace function public.handle_updated_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Only update if the email actually changed
  if new.email is distinct from old.email then
    update public.profiles
    set 
      email = new.email,
      updated_at = timezone('utc'::text, now())
    where id = new.id;
  end if;

  return new;
end;
$$;

-- Drop trigger if it exists to ensure idempotency
drop trigger if exists on_auth_user_updated on auth.users;

-- Create the trigger
create trigger on_auth_user_updated
  after update of email on auth.users
  for each row execute procedure public.handle_updated_user();
