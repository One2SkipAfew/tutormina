create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  raw_role text;
  v_role user_role;
  v_status user_status;
  v_first_name text;
  v_last_name text;
  v_full_name text;
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

  -- Handle Google OAuth name mapping
  v_first_name := new.raw_user_meta_data->>'first_name';
  v_last_name := new.raw_user_meta_data->>'last_name';
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name');

  if v_first_name is null and v_full_name is not null then
    -- Split full_name at the first space
    v_first_name := split_part(v_full_name, ' ', 1);
    v_last_name := right(v_full_name, length(v_full_name) - length(v_first_name) - 1);
  end if;

  -- Insert profile
  insert into public.profiles (
    id, 
    email, 
    first_name, 
    last_name, 
    role, 
    status,
    avatar_url
  )
  values (
    new.id,
    new.email,
    coalesce(v_first_name, ''),
    coalesce(v_last_name, ''),
    v_role,
    v_status,
    new.raw_user_meta_data->>'avatar_url'
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
