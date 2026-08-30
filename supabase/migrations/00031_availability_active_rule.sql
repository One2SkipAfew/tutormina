-- Lets a professional switch between several saved recurring availability patterns instead of
-- always having all of them union together. New column defaults to false so a provider who
-- already has rules keeps today's "everything is on" behaviour unchanged until they explicitly
-- pick one via the new radio control (backfilled to true below) - only brand-new rules added
-- after this migration start dormant.

alter table public.provider_availability_rules add column if not exists is_active boolean not null default false;

update public.provider_availability_rules set is_active = true;

-- Enforce "at most one active rule per provider": whenever a row is marked active, deactivate
-- every other rule belonging to the same provider.
create or replace function public.enforce_single_active_availability_rule()
returns trigger as $$
begin
    if new.is_active then
        update public.provider_availability_rules
        set is_active = false
        where provider_id = new.provider_id and id <> new.id and is_active = true;
    end if;
    return new;
end;
$$ language plpgsql security definer;

create trigger trg_single_active_availability_rule
    after insert or update of is_active on public.provider_availability_rules
    for each row
    when (new.is_active)
    execute function public.enforce_single_active_availability_rule();

-- Ensure a provider is never left with zero active rules: if their newly-inserted rule is the
-- only one they have, activate it automatically (matches the pre-radio-button experience for a
-- provider adding their first-ever rule).
create or replace function public.default_activate_first_availability_rule()
returns trigger as $$
begin
    if not new.is_active then
        if (select count(*) from public.provider_availability_rules where provider_id = new.provider_id) = 1 then
            update public.provider_availability_rules set is_active = true where id = new.id;
        end if;
    end if;
    return new;
end;
$$ language plpgsql security definer;

create trigger trg_default_activate_first_availability_rule
    after insert on public.provider_availability_rules
    for each row
    execute function public.default_activate_first_availability_rule();
