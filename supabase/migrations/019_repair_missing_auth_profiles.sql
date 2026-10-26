-- Restore profile creation on signup and repair accounts created while the
-- profile trigger was missing or not functioning.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_role_id uuid;
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email
  )
  on conflict (id) do nothing;

  select id into v_student_role_id
  from public.roles
  where name = 'STUDENT';

  if v_student_role_id is not null then
    insert into public.user_roles (user_id, role_id)
    values (new.id, v_student_role_id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, full_name, email)
select
  users.id,
  coalesce(
    nullif(trim(users.raw_user_meta_data->>'full_name'), ''),
    split_part(users.email, '@', 1)
  ),
  users.email
from auth.users users
where users.email is not null
  and not exists (
    select 1
    from public.profiles profiles
    where profiles.id = users.id
  )
on conflict (id) do nothing;

insert into public.user_roles (user_id, role_id)
select profiles.id, roles.id
from public.profiles profiles
cross join public.roles roles
where roles.name = 'STUDENT'
  and not exists (
    select 1
    from public.user_roles user_roles
    where user_roles.user_id = profiles.id
  )
on conflict do nothing;
