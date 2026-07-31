-- Add folder_type column to public.folders
alter table public.folders
add column if not exists folder_type file_type;
