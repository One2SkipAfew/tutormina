GRANT SELECT ON public.profiles TO anon; GRANT SELECT ON public.provider_details TO anon; create policy "Anon can view provider details" on public.provider_details for select using (true);
