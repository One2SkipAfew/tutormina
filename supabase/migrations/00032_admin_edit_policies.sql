-- Admins can already view/update public.profiles (00005) and view provider/student details
-- (00010 references is_admin() for provider work history/references; 00018 grants admins
-- select on student_details), but there is no admin UPDATE policy on provider_details or
-- student_details - so an admin edit-any-profile screen would be silently blocked by RLS on
-- everything except name/status/role. Add the missing UPDATE grants, mirroring the existing
-- owner-scoped policies.

create policy "Admins can update provider details"
    on public.provider_details for update
    using (public.is_admin())
    with check (public.is_admin());

create policy "Admins can update student details"
    on public.student_details for update
    using (public.is_admin())
    with check (public.is_admin());
