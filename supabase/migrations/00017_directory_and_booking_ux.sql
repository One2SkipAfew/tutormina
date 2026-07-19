-- Directory enrichment + booking UX pass: customer avatars, professional qualifications,
-- student topic/note captured at booking time, and a propose-a-different-time flow.

-- 1. Customer/parent avatars - only provider_details had avatar_url before, so customers had
-- no way to have a profile picture at all (needed so professionals can see who's booking).
alter table public.profiles add column if not exists avatar_url text;

-- 2. Professional qualifications (e.g. "BSc Mathematics, PGCE") - parallel free-text field to
-- the existing bio, since nothing like this existed anywhere in provider_details.
alter table public.provider_details add column if not exists qualifications text;

-- 3. Student topic/note captured at booking time, plus a professional's counter-proposal.
-- bookings.status is unconstrained text (no enum/check), so the new 'reschedule_proposed'
-- value needs no schema change here, only application logic.
alter table public.bookings add column if not exists student_topic text;
alter table public.bookings add column if not exists student_note text;
alter table public.bookings add column if not exists proposed_session_date timestamp with time zone;
alter table public.bookings add column if not exists proposed_duration_minutes integer;

-- 4. Extend the booking-status notification (from 00012) to also notify the customer when a
-- professional proposes a different time.
create or replace function public.handle_booking_status_change()
returns trigger as $$
declare
    v_type text;
    v_title text;
    v_provider_name text;
begin
    if new.status is distinct from old.status and new.status in ('confirmed', 'cancelled', 'reschedule_proposed') then
        v_type := case new.status
            when 'confirmed' then 'booking_confirmed'
            when 'cancelled' then 'booking_cancelled'
            else 'booking_reschedule_proposed'
        end;
        v_title := case new.status
            when 'confirmed' then 'Your booking has been confirmed'
            when 'cancelled' then 'Your booking has been cancelled'
            else 'Your tutor proposed a new time'
        end;

        select first_name || ' ' || last_name into v_provider_name
        from public.profiles where id = new.provider_id;

        insert into public.notifications (user_id, type, title, body, link, related_id)
        values (
            new.customer_id,
            v_type,
            v_title,
            coalesce(v_provider_name, 'Your provider') || ' - ' || to_char(
                coalesce(new.proposed_session_date, new.session_date), 'DD Mon YYYY HH24:MI'
            ),
            '/dashboard/bookings',
            new.id
        );
    end if;

    return new;
end;
$$ language plpgsql security definer;

-- 5. New: notify the provider when a booking request first comes in - previously providers had
-- no signal at all that a pending request existed short of manually checking the calendar.
create or replace function public.handle_new_booking_request()
returns trigger as $$
declare
    v_customer_name text;
begin
    select first_name || ' ' || last_name into v_customer_name
    from public.profiles where id = new.customer_id;

    insert into public.notifications (user_id, type, title, body, link, related_id)
    values (
        new.provider_id,
        'new_booking_request',
        'New booking request',
        coalesce(v_customer_name, 'A student') || ' requested a session - ' || to_char(new.session_date, 'DD Mon YYYY HH24:MI'),
        '/dashboard/calendar',
        new.id
    );

    return new;
end;
$$ language plpgsql security definer;

create trigger on_new_booking_request
    after insert on public.bookings
    for each row execute function public.handle_new_booking_request();
