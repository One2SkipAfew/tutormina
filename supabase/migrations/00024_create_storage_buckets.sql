insert into storage.buckets (id, name, public)
values
  ('professional-photos', 'professional-photos', true),
  ('shared-drive', 'shared-drive', true)
on conflict (id) do nothing;