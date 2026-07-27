-- Create a function to handle new user signups
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  raw_role text;
  v_role user_role;
  v_status user_status;
begin
  -- Get role from metadata, default to customer
  raw_role := coalesce(new.raw_user_meta_data->>'role', 'customer');
  
  -- Cast to enum
  begin
    v_role := raw_role::user_role;
  exception when invalid_text_representation then
    v_role := 'customer'::user_role;
  end;

  -- Customers are approved immediately, tutors/coaches are pending
  if v_role = 'customer' then
    v_status := 'approved'::user_status;
  else
    v_status := 'pending'::user_status;
  end if;

  -- Insert profile
  insert into public.profiles (id, email, first_name, last_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    v_role,
    v_status
  );

  -- Insert provider_details if role is tutor or coach
  if v_role in ('tutor', 'coach') then
    insert into public.provider_details (profile_id, is_tutor, is_coach)
    values (
      new.id,
      v_role = 'tutor',
      v_role = 'coach'
    );
  end if;

  return new;
end;
$$;

-- Create the trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
