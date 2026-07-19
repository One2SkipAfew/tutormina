-- Messaging + Notification Centre
-- Tutors, students (role 'customer'), and coaches can message each other,
-- gated on having an existing booking together (or messaging an admin).

-- 1. Helper: do two profiles share a booking (in either customer/provider order)?
create or replace function public.have_booking_together(a uuid, b uuid)
returns boolean as $$
  select exists(
    select 1 from public.bookings
    where (customer_id = a and provider_id = b)
       or (customer_id = b and provider_id = a)
  );
$$ language sql security definer;

-- 2. Conversations (1:1)
create table public.conversations (
    id uuid default uuid_generate_v4() primary key,
    participant_one_id uuid references public.profiles(id) on delete cascade not null,
    participant_two_id uuid references public.profiles(id) on delete cascade not null,
    last_message_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint conversations_distinct_participants check (participant_one_id <> participant_two_id),
    constraint conversations_unique_pair unique (participant_one_id, participant_two_id)
);

create index idx_conversations_participant_one on public.conversations(participant_one_id);
create index idx_conversations_participant_two on public.conversations(participant_two_id);

alter table public.conversations enable row level security;

create policy "Participants can view their conversations"
    on public.conversations for select
    using (auth.uid() = participant_one_id or auth.uid() = participant_two_id);

create policy "Participants can start a conversation if eligible"
    on public.conversations for insert
    with check (
        (auth.uid() = participant_one_id or auth.uid() = participant_two_id)
        and (
            public.have_booking_together(participant_one_id, participant_two_id)
            or exists (select 1 from public.profiles where id = participant_one_id and role = 'admin')
            or exists (select 1 from public.profiles where id = participant_two_id and role = 'admin')
        )
    );

-- 3. Messages
create table public.messages (
    id uuid default uuid_generate_v4() primary key,
    conversation_id uuid references public.conversations(id) on delete cascade not null,
    sender_id uuid references public.profiles(id) on delete cascade not null,
    body text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    read_at timestamp with time zone
);

create index idx_messages_conversation_id on public.messages(conversation_id);
create index idx_messages_created_at on public.messages(created_at);

alter table public.messages enable row level security;

create policy "Participants can view messages in their conversations"
    on public.messages for select
    using (
        exists (
            select 1 from public.conversations c
            where c.id = conversation_id
              and (auth.uid() = c.participant_one_id or auth.uid() = c.participant_two_id)
        )
    );

create policy "Participants can send messages in their conversations"
    on public.messages for insert
    with check (
        sender_id = auth.uid()
        and exists (
            select 1 from public.conversations c
            where c.id = conversation_id
              and (auth.uid() = c.participant_one_id or auth.uid() = c.participant_two_id)
        )
    );

-- 4. Notifications (general purpose - starts with new_message, extensible later)
create table public.notifications (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    type text not null,
    title text,
    body text,
    link text,
    related_id uuid,
    is_read boolean default false not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_notifications_user_id on public.notifications(user_id);
create index idx_notifications_is_read on public.notifications(is_read);

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
    on public.notifications for select
    using (auth.uid() = user_id);

create policy "Users can update their own notifications"
    on public.notifications for update
    using (auth.uid() = user_id);

-- Notifications are only ever created by the trigger below (security definer),
-- so no insert policy is granted to regular users.

-- 5. Trigger: new message -> notify the other participant + bump conversation timestamp
create or replace function public.handle_new_message()
returns trigger as $$
declare
    v_recipient_id uuid;
    v_sender_name text;
begin
    select
        case when c.participant_one_id = new.sender_id then c.participant_two_id else c.participant_one_id end
    into v_recipient_id
    from public.conversations c
    where c.id = new.conversation_id;

    select first_name || ' ' || last_name into v_sender_name
    from public.profiles where id = new.sender_id;

    insert into public.notifications (user_id, type, title, body, link, related_id)
    values (
        v_recipient_id,
        'new_message',
        coalesce(v_sender_name, 'Someone'),
        left(new.body, 140),
        '/dashboard/messages?c=' || new.conversation_id,
        new.conversation_id
    );

    update public.conversations set last_message_at = new.created_at where id = new.conversation_id;

    return new;
end;
$$ language plpgsql security definer;

create trigger on_message_created
    after insert on public.messages
    for each row execute function public.handle_new_message();

-- 6. Profiles: a customer's basic profile (name) isn't visible to a tutor/coach they're
-- messaging under the existing policies (those only cover self, admins, and approved
-- provider profiles) - add a policy scoped to shared conversations so both sides of a
-- conversation can see each other's name.
create policy "Users can view profiles of people they message"
    on public.profiles for select
    using (
        exists (
            select 1 from public.conversations c
            where (c.participant_one_id = auth.uid() and c.participant_two_id = profiles.id)
               or (c.participant_two_id = auth.uid() and c.participant_one_id = profiles.id)
        )
    );

-- 7. Grants (RLS policies alone aren't enough - Postgres also requires table-level grants)
grant select, insert on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant select, update on public.notifications to authenticated;

-- 8. Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
