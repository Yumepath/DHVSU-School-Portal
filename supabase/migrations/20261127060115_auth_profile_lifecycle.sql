create or replace function portal_private.add_auth_profile() returns trigger language plpgsql security definer
set search_path = '' as $$
declare
  assigned_role public.portal_role := (new.raw_app_meta_data ->> 'portal_role')::public.portal_role;
  actor uuid := (new.raw_app_meta_data ->> 'portal_provisioner')::uuid;
begin
  if assigned_role is null or exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;
  if actor is not null and not exists (
    select 1 from public.profiles where id = actor and active and role = 'admin'
  ) then raise exception 'Provisioning requires an active administrator'; end if;
  insert into public.profiles(id, full_name, email, role)
    values (new.id,new.raw_app_meta_data ->> 'portal_name',new.email,assigned_role);
  if assigned_role = 'student' then insert into public.students(id) values(new.id);
  elsif assigned_role = 'faculty' then insert into public.faculty(id) values(new.id); end if;
  if actor is not null then
    insert into public.audit_logs(actor_id,entity,entity_id,action)
      values(actor,'profiles',new.id,'PROVISION');
  end if;
  return new;
end
$$;

-- Auth Admin may attach trusted app metadata after inserting the auth user.
create trigger portal_auth_metadata after update of raw_app_meta_data on auth.users
for each row execute function portal_private.add_auth_profile();
