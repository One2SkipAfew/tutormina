-- Professional onboarding (application form), admin review, and account management

-- 1. New account-lifecycle statuses (existing: pending, approved, declined)
alter type user_status add value if not exists 'suspended';
alter type user_status add value if not exists 'blocked';
alter type user_status add value if not exists 'deleted';

-- 2. Profiles: record the admin's decision + reason
alter table public.profiles add column if not exists status_reason text;
alter table public.profiles add column if not exists reviewed_by uuid references public.profiles(id);
alter table public.profiles add column if not exists reviewed_at timestamp with time zone;

-- 3. Provider details: distinguish "still filling out the form" from "submitted, awaiting review"
alter table public.provider_details add column if not exists application_submitted_at timestamp with time zone;

-- 3b. Close a pre-existing hole in "Users can update own profile" (00004): that policy has no
-- WITH CHECK, so any authenticated user could currently set their own status/role to anything,
-- including 'approved' or 'admin', bypassing review entirely. A non-admin may only ever
-- self-transition their own status to 'pending' (submitting/resubmitting an application) -
-- everything else requires public.is_admin().
create or replace function public.enforce_profile_status_transitions()
returns trigger as $$
begin
    -- auth.uid() is null for direct DB access (superuser/service_role/migrations) - only
    -- real end-user requests through the app always carry an authenticated uid, so this
    -- exemption only ever applies to the one-time manual admin-bootstrap step, never to a
    -- logged-in non-admin user.
    if auth.uid() is null or public.is_admin() then
        return new;
    end if;

    if new.status is distinct from old.status then
        if new.status <> 'pending' then
            raise exception 'Only an administrator can set profile status to %', new.status;
        end if;
        new.reviewed_by := null;
        new.reviewed_at := null;
        new.status_reason := null;
    end if;

    if new.role is distinct from old.role then
        raise exception 'Only an administrator can change a profile''s role';
    end if;

    return new;
end;
$$ language plpgsql security definer;

create trigger enforce_profile_status_transitions
    before update on public.profiles
    for each row execute function public.enforce_profile_status_transitions();

-- 4. Work history (repeatable, part of the professional application)
create table public.work_experiences (
    id uuid default uuid_generate_v4() primary key,
    profile_id uuid references public.profiles(id) on delete cascade not null,
    company text not null,
    title text not null,
    start_date date,
    end_date date,
    description text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_work_experiences_profile_id on public.work_experiences(profile_id);

alter table public.work_experiences enable row level security;

create policy "Owners can manage their own work experience"
    on public.work_experiences for all
    using (auth.uid() = profile_id)
    with check (auth.uid() = profile_id);

create policy "Admins can view all work experience"
    on public.work_experiences for select
    using (public.is_admin());

create policy "Anyone can view approved provider work experience"
    on public.work_experiences for select
    using (
        exists (
            select 1 from public.profiles p
            where p.id = work_experiences.profile_id
              and p.role in ('tutor', 'coach')
              and p.status = 'approved'
        )
    );

grant select, insert, update, delete on public.work_experiences to authenticated;
grant select on public.work_experiences to anon;

-- 5. References (repeatable, part of the professional application - vetting material, not public)
create table public.professional_references (
    id uuid default uuid_generate_v4() primary key,
    profile_id uuid references public.profiles(id) on delete cascade not null,
    reference_name text not null,
    relationship text,
    contact_info text,
    comment text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_professional_references_profile_id on public.professional_references(profile_id);

alter table public.professional_references enable row level security;

create policy "Owners can manage their own references"
    on public.professional_references for all
    using (auth.uid() = profile_id)
    with check (auth.uid() = profile_id);

create policy "Admins can view all references"
    on public.professional_references for select
    using (public.is_admin());

grant select, insert, update, delete on public.professional_references to authenticated;

-- The new public "anyone can view approved provider work experience" policy subqueries
-- profiles, which forces Postgres to evaluate ALL of profiles' SELECT policies for the
-- querying role - including the messaging migration's "people they message" policy, which
-- subqueries conversations. Evaluating that policy (even to reject it) requires a base
-- SELECT grant on conversations, which anon never got (only authenticated did, in
-- 00009_messaging_and_notifications.sql) - without it, anon's directory browsing breaks
-- with "permission denied for table conversations" despite never directly querying it.
grant select on public.conversations to anon;

-- References stay private (vetting material, not for public display), but the directory
-- wants to show "N references on file" as a credibility signal without exposing them -
-- a security definer function returns just the count, bypassing the owner/admin-only RLS above.
create or replace function public.get_reference_count(target_profile_id uuid)
returns integer as $$
  select count(*)::integer from public.professional_references where profile_id = target_profile_id;
$$ language sql security definer;

grant execute on function public.get_reference_count(uuid) to authenticated, anon;

-- 6. Trigger: notify the profile owner when an admin changes their status/reason
create or replace function public.handle_profile_status_change()
returns trigger as $$
declare
    v_type text;
    v_title text;
begin
    if new.status is distinct from old.status then
        v_type := case new.status
            when 'approved' then 'application_approved'
            when 'declined' then 'application_declined'
            when 'suspended' then 'account_suspended'
            when 'blocked' then 'account_blocked'
            when 'deleted' then 'account_deleted'
            else 'account_reactivated'
        end;

        v_title := case new.status
            when 'approved' then 'Your application has been approved'
            when 'declined' then 'Your application was declined'
            when 'suspended' then 'Your account has been suspended'
            when 'blocked' then 'Your account has been blocked'
            when 'deleted' then 'Your account has been deactivated'
            else 'Your account is active again'
        end;

        insert into public.notifications (user_id, type, title, body, link)
        values (new.id, v_type, v_title, new.status_reason, '/application-status');
    end if;

    return new;
end;
$$ language plpgsql security definer;

create trigger on_profile_status_change
    after update on public.profiles
    for each row execute function public.handle_profile_status_change();

-- 7. Storage: professional photo uploads (bucket declared in config.toml)
create policy "Owners can upload their own professional photo"
    on storage.objects for insert
    with check (bucket_id = 'professional-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Owners can update their own professional photo"
    on storage.objects for update
    using (bucket_id = 'professional-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Owners can delete their own professional photo"
    on storage.objects for delete
    using (bucket_id = 'professional-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Anyone can view professional photos"
    on storage.objects for select
    using (bucket_id = 'professional-photos');
