-- Student profiles (Scholar/Student/Professional), a Learning Zone planner, scoped file
-- submissions, and cancellation reasons on bookings.

-- 1. Student details - mirrors provider_details' pattern for the customer role, so a tutor/
-- coach can see relevant context (school/institution/occupation) about who they're teaching.
create table public.student_details (
    profile_id uuid references public.profiles(id) on delete cascade primary key,
    student_type text check (student_type in ('scholar', 'student', 'professional')),
    age integer,
    location text,
    -- Scholar (school-going)
    school_name text,
    grade text,
    teacher_name text,
    -- Student (university/tertiary)
    institution_name text,
    course_of_study text,
    year_of_study text,
    -- Shared by scholar + student
    subjects text[],
    current_results text,
    -- Professional
    occupation text,
    employer text,
    years_experience integer,
    goals text,
    -- Uploaded Report (scholar) or Transcript (student) + AI's best-effort extraction
    document_url text,
    document_extracted_summary text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.student_details enable row level security;

create policy "Students manage own details"
    on public.student_details for all
    using (auth.uid() = profile_id)
    with check (auth.uid() = profile_id);

-- Mirrors 00013's "Users can view profiles of people they've booked with" - a provider needs
-- to read their own students' details to see school/occupation context on a booking card.
create policy "Providers can view details of students they've booked with"
    on public.student_details for select
    using (
        exists (
            select 1 from public.bookings b
            where b.provider_id = auth.uid() and b.customer_id = student_details.profile_id
        )
    );

create policy "Admins can view all student details"
    on public.student_details for select
    using (public.is_admin());

grant select, insert, update, delete on public.student_details to authenticated;

-- 2. Learning Zone planner: benchmarks, deadlines, submissions, test/exam dates + results.
create table public.learning_events (
    id uuid default uuid_generate_v4() primary key,
    student_id uuid references public.profiles(id) on delete cascade not null,
    event_type text not null check (event_type in ('benchmark', 'deadline', 'submission', 'test', 'exam')),
    title text not null,
    description text,
    event_date date,
    status text not null default 'upcoming' check (status in ('upcoming', 'completed')),
    result_text text,
    result_file_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_learning_events_student_id on public.learning_events(student_id);

alter table public.learning_events enable row level security;

create policy "Students manage own learning events"
    on public.learning_events for all
    using (auth.uid() = student_id)
    with check (auth.uid() = student_id);

grant select, insert, update, delete on public.learning_events to authenticated;

-- 3. Scoped file submissions: a student submitting work to one specific tutor shouldn't be
-- governed by the public/students_only/tutors_coaches_only visibility levels already used for
-- tutor-shared resources - this is a private one-to-one grant layered on top.
alter table public.shared_files add column if not exists shared_with_id uuid references public.profiles(id);

create policy "Recipients can view files shared directly with them"
    on public.shared_files for select
    using (auth.uid() = shared_with_id);

-- 4. Cancellation reason on bookings.
alter table public.bookings add column if not exists cancellation_reason text;
