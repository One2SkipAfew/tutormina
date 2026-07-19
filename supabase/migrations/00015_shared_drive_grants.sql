-- folders/shared_files/file_access_log/resource_alerts (00002_lms_schema.sql) have had RLS
-- policies since they were created, but were never given the explicit GRANT every other table
-- in this project needs (RLS policies alone don't let a role attempt the query at all - see
-- 00004/00007/00009/00010/00013 for the same fix on other tables). All 4 are dashboard-only
-- (no logged-out access), so authenticated is sufficient - no anon grant needed.
grant select, insert, update, delete on public.folders to authenticated;
grant select, insert, update, delete on public.shared_files to authenticated;
grant select, insert on public.file_access_log to authenticated;
grant select, update on public.resource_alerts to authenticated;
