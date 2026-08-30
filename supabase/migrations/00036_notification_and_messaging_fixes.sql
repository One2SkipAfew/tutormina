-- ============================================
-- Migration: 00036_notification_and_messaging_fixes.sql
-- Production readiness pass. Fixes three defects:
--   1. 00035 narrowed have_booking_together() to confirmed/completed bookings. That function's
--      only remaining consumer is the conversations INSERT policy (00009), because 00035 replaced
--      every resource policy that used to depend on it with the explicit student_resource_access
--      grant model. The net effect was purely collateral: a student who submits a booking request
--      (status 'pending') could no longer open a conversation with that professional, so the
--      "message on booking request" flow failed silently. Restore the original any-status match.
--   2. Sharing resources with a student produced no in-app notification.
--   3. Direct 1:1 file shares (shared_files.shared_with_id) produced no notification either.
-- ============================================

-- 1. Restore any-status booking match for messaging eligibility.
--    Resource access is NOT gated on this any more (see 00035's student_resource_access model),
--    so widening it back has no effect on who can see a professional's files.
create or replace function public.have_booking_together(a uuid, b uuid)
returns boolean as $$
  select exists(
    select 1 from public.bookings
    where (customer_id = a and provider_id = b)
       or (customer_id = b and provider_id = a)
  );
$$ language sql security definer;

-- 2. Notify a student when a professional grants them access to resources.
--    notifications is intentionally trigger-only (no INSERT grant to authenticated), so this has
--    to be a SECURITY DEFINER trigger rather than a client-side insert.
create or replace function public.handle_resource_access_granted()
returns trigger as $$
declare
    v_provider_name text;
    v_file_title text;
    v_body text;
begin
    select first_name || ' ' || last_name into v_provider_name
    from public.profiles where id = new.provider_id;

    if new.grant_all then
        v_body := coalesce(v_provider_name, 'Your professional') || ' shared their resource library with you.';
    else
        select title into v_file_title from public.shared_files where id = new.file_id;
        v_body := coalesce(v_provider_name, 'Your professional') || ' shared "'
                  || coalesce(v_file_title, 'a resource') || '" with you.';
    end if;

    insert into public.notifications (user_id, type, title, body, link, related_id)
    values (
        new.student_id,
        'file_added',
        'New resource shared with you',
        v_body,
        '/dashboard/shared-drive',
        new.file_id
    );

    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_resource_access_granted on public.student_resource_access;
create trigger on_resource_access_granted
    after insert on public.student_resource_access
    for each row execute function public.handle_resource_access_granted();

-- 3. Notify a recipient when a file is shared directly with them (the shared_with_id path,
--    used for 1:1 submissions/hand-backs, which bypasses student_resource_access entirely).
create or replace function public.handle_direct_file_share()
returns trigger as $$
declare
    v_sender_name text;
begin
    if new.shared_with_id is null or new.shared_with_id = new.uploaded_by then
        return new;
    end if;

    -- Only fire when the recipient actually changes, so ordinary metadata edits stay silent.
    -- OLD only exists on UPDATE, so it must be referenced inside a TG_OP-guarded block.
    if tg_op = 'UPDATE' then
        if old.shared_with_id is not distinct from new.shared_with_id then
            return new;
        end if;
    end if;

    select first_name || ' ' || last_name into v_sender_name
    from public.profiles where id = new.uploaded_by;

    insert into public.notifications (user_id, type, title, body, link, related_id)
    values (
        new.shared_with_id,
        'file_added',
        'A file was shared with you',
        coalesce(v_sender_name, 'Someone') || ' shared "' || new.title || '" with you.',
        '/dashboard/shared-drive',
        new.id
    );

    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_direct_file_share on public.shared_files;
create trigger on_direct_file_share
    after insert or update of shared_with_id on public.shared_files
    for each row execute function public.handle_direct_file_share();

-- 4. Booking requests notified only the provider. The student got an email but nothing in their
--    dashboard/Recent Activity, so extend the existing trigger to confirm the request to them too.
create or replace function public.handle_new_booking_request()
returns trigger as $$
declare
    v_customer_name text;
    v_provider_name text;
    v_kind text;
begin
    select first_name || ' ' || last_name into v_customer_name
    from public.profiles where id = new.customer_id;

    select first_name || ' ' || last_name into v_provider_name
    from public.profiles where id = new.provider_id;

    v_kind := case when new.booking_type = 'intro_call' then 'intro call' else 'session' end;

    -- Provider: a new request needs their action.
    insert into public.notifications (user_id, type, title, body, link, related_id)
    values (
        new.provider_id,
        'new_booking_request',
        'New ' || v_kind || ' request',
        coalesce(v_customer_name, 'A student') || ' requested a ' || v_kind || ' - '
            || to_char(new.session_date, 'DD Mon YYYY HH24:MI'),
        '/dashboard/calendar',
        new.id
    );

    -- Student: confirmation that the request went out.
    insert into public.notifications (user_id, type, title, body, link, related_id)
    values (
        new.customer_id,
        'booking_update',
        v_kind || ' request sent',
        'Your ' || v_kind || ' request to ' || coalesce(v_provider_name, 'your professional')
            || ' for ' || to_char(new.session_date, 'DD Mon YYYY HH24:MI') || ' is awaiting confirmation.',
        '/dashboard/bookings',
        new.id
    );

    return new;
end;
$$ language plpgsql security definer;

-- 5. messages.read_at was never writable: 00009 granted only select+insert and created no UPDATE
--    policy, so the unread-message badge could only ever grow. Allow a participant to mark
--    messages addressed to them as read (they must not be able to touch their own sent messages'
--    read state, nor anything in a conversation they aren't part of).
drop policy if exists "Recipients can mark messages read" on public.messages;
create policy "Recipients can mark messages read"
    on public.messages for update
    using (
        sender_id <> auth.uid()
        and exists (
            select 1 from public.conversations c
            where c.id = messages.conversation_id
              and (auth.uid() = c.participant_one_id or auth.uid() = c.participant_two_id)
        )
    )
    with check (
        sender_id <> auth.uid()
        and exists (
            select 1 from public.conversations c
            where c.id = messages.conversation_id
              and (auth.uid() = c.participant_one_id or auth.uid() = c.participant_two_id)
        )
    );

grant update (read_at) on public.messages to authenticated;

create index if not exists idx_messages_unread on public.messages(conversation_id, sender_id, read_at);

-- 6. Index supporting the provider's pending-request badge (getPendingBookingsCount) and the
--    reminder cron's due-booking scan, both of which filter bookings by status.
create index if not exists idx_bookings_provider_status on public.bookings(provider_id, status);
create index if not exists idx_bookings_status_session_date on public.bookings(status, session_date);
