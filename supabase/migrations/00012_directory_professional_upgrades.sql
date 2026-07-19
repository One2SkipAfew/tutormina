-- Directory/professional profile upgrades: optional rate field, AI session notes, booking reminders

-- 1. Optional professional rate (amount, currency, visibility toggle)
alter table public.provider_details add column if not exists rate_amount numeric;
alter table public.provider_details add column if not exists rate_currency text default 'ZAR';
alter table public.provider_details add column if not exists rate_visible boolean default false not null;

alter table public.provider_details drop constraint if exists provider_details_rate_currency_check;
alter table public.provider_details add constraint provider_details_rate_currency_check
    check (rate_currency in ('USD', 'EUR', 'ZAR'));

-- 2. AI session notes (a saved transcript + AI summary/insights for a session, not tied to a
-- specific shared_file - private to the owner, matching a personal notes model)
create table public.ai_session_notes (
    id uuid default uuid_generate_v4() primary key,
    profile_id uuid references public.profiles(id) on delete cascade not null,
    title text not null,
    transcript text,
    summary text,
    insights text[],
    key_topics text[],
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_ai_session_notes_profile_id on public.ai_session_notes(profile_id);

alter table public.ai_session_notes enable row level security;

create policy "Owners can manage their own session notes"
    on public.ai_session_notes for all
    using (auth.uid() = profile_id)
    with check (auth.uid() = profile_id);

create policy "Admins can view all session notes"
    on public.ai_session_notes for select
    using (public.is_admin());

grant select, insert, update, delete on public.ai_session_notes to authenticated;

-- 3. Booking status change -> notify the customer (the "reminder" mechanism: a persistent
-- notification + visible record in My Bookings, not a scheduled time-before-session alert)
create or replace function public.handle_booking_status_change()
returns trigger as $$
declare
    v_type text;
    v_title text;
    v_provider_name text;
begin
    if new.status is distinct from old.status and new.status in ('confirmed', 'cancelled') then
        v_type := case new.status when 'confirmed' then 'booking_confirmed' else 'booking_cancelled' end;
        v_title := case new.status
            when 'confirmed' then 'Your booking has been confirmed'
            else 'Your booking has been cancelled'
        end;

        select first_name || ' ' || last_name into v_provider_name
        from public.profiles where id = new.provider_id;

        insert into public.notifications (user_id, type, title, body, link, related_id)
        values (
            new.customer_id,
            v_type,
            v_title,
            coalesce(v_provider_name, 'Your provider') || ' - ' || to_char(new.session_date, 'DD Mon YYYY HH24:MI'),
            '/dashboard/bookings',
            new.id
        );
    end if;

    return new;
end;
$$ language plpgsql security definer;

create trigger on_booking_status_change
    after update on public.bookings
    for each row execute function public.handle_booking_status_change();
