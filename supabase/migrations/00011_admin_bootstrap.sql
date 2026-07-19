-- One-time admin bootstrap: allow creating exactly one 'admin' profile via self-signup
-- (for the hidden /admin-setup page), then close the door once an admin exists.
--
-- Pre-existing gap: "Users can insert their own profile" (00004) has no restriction on
-- role, so any self-signup could currently insert role='admin' for themselves. This
-- closes that hole while still allowing the legitimate one-time setup flow.

create or replace function public.admin_exists()
returns boolean as $$
  select exists(select 1 from public.profiles where role = 'admin');
$$ language sql security definer;

grant execute on function public.admin_exists() to anon, authenticated;

create or replace function public.enforce_admin_bootstrap()
returns trigger as $$
begin
    -- auth.uid() is null for direct DB/migration access - never restrict that path.
    if auth.uid() is not null and new.role = 'admin' and public.admin_exists() then
        raise exception 'Admin setup has already been completed';
    end if;
    return new;
end;
$$ language plpgsql security definer;

create trigger enforce_admin_bootstrap
    before insert on public.profiles
    for each row execute function public.enforce_admin_bootstrap();
