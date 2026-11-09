-- =====================================================================
-- Theo dõi thay tủ mát WCM — schema Supabase
-- Chạy 1 lần trong Supabase > SQL Editor. Người đăng ký ĐẦU TIÊN tự thành Admin.
-- =====================================================================

-- 1. Người dùng & vai trò ------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text default '',
  role text not null default 'pending'
    check (role in ('pending','admin','doi_truong','nha_thau','viewer')),
  scope text default '',          -- Đội trưởng: tên/SĐT trong cột "Đội trưởng KTKV"; Nhà thầu: tên trong cột Nhà thầu
  created_at timestamptz default now()
);

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() $$;

create or replace function public.my_scope() returns text
language sql stable security definer set search_path = public as
$$ select coalesce(scope,'') from profiles where id = auth.uid() $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'admin' from profiles where id = auth.uid()), false) $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''),
          case when exists (select 1 from profiles where role = 'admin') then 'pending' else 'admin' end);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated
  using (public.is_admin());

-- 2. Cửa hàng ------------------------------------------------------------
create table if not exists public.stores (
  site text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  updated_by uuid
);

create table if not exists public.audit_log (
  id bigserial primary key,
  site text not null,
  at timestamptz not null default now(),
  user_id uuid,
  user_email text,
  action text,
  changes jsonb
);
create index if not exists audit_log_site_idx on public.audit_log (site, at desc);

-- Chặn sửa ngoài phạm vi trường được phép + đóng dấu ngày cập nhật
create or replace function public.stores_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text; k text; allowed text[];
begin
  if auth.uid() is not null then
    r := my_role();
    if r is distinct from 'admin' then
      if tg_op <> 'UPDATE' then raise exception 'Không có quyền thêm cửa hàng'; end if;
      allowed := case r
        when 'nha_thau' then array['vc_tt','lap_tt','serial_tt','trang_thai','anh','ghi_chu']
        when 'doi_truong' then array['vc_tt','lap_tt','serial_tt','trang_thai','anh','ghi_chu',
             'vc_dk','lap_dk','ktkv','nt_lap','nt_vc','km','cht','sdt_cht','hien_trang','link','ma_ts','_pending']
        else array[]::text[] end;
      for k in select key from jsonb_each(new.data) union select key from jsonb_each(old.data) loop
        if k <> 'ngay_cn' and (new.data->k) is distinct from (old.data->k) and not (k = any(allowed)) then
          raise exception 'Không có quyền sửa trường %', k;
        end if;
      end loop;
      if r = 'nha_thau' and new.data->>'trang_thai' = 'Đã nghiệm thu'
         and (old.data->>'trang_thai') is distinct from 'Đã nghiệm thu' then
        raise exception 'Nhà thầu không được chuyển trạng thái Đã nghiệm thu';
      end if;
    end if;
    new.updated_by := auth.uid();
  end if;
  new.updated_at := now();
  new.data := jsonb_set(new.data, '{ngay_cn}',
     to_jsonb(to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')));
  return new;
end $$;

drop trigger if exists stores_guard on public.stores;
create trigger stores_guard before insert or update on public.stores
  for each row execute function public.stores_guard();

-- Ghi lịch sử thay đổi (audit log)
create or replace function public.stores_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare ch jsonb := '{}'::jsonb; k text; em text; act text;
begin
  select email into em from profiles where id = auth.uid();
  act := coalesce(nullif(current_setting('app.action', true), ''), case when tg_op = 'INSERT' then 'Tạo mới' else 'Cập nhật' end);
  if tg_op = 'INSERT' then
    insert into audit_log (site, user_id, user_email, action, changes) values (new.site, auth.uid(), em, act, null);
    return new;
  end if;
  for k in select key from jsonb_each(new.data) union select key from jsonb_each(old.data) loop
    if k <> 'ngay_cn' and (new.data->k) is distinct from (old.data->k) then
      ch := ch || jsonb_build_object(k, jsonb_build_object('old', old.data->k, 'new', new.data->k));
    end if;
  end loop;
  if ch <> '{}'::jsonb then
    insert into audit_log (site, user_id, user_email, action, changes) values (new.site, auth.uid(), em, act, ch);
  end if;
  return new;
end $$;

drop trigger if exists stores_audit on public.stores;
create trigger stores_audit after insert or update on public.stores
  for each row execute function public.stores_audit();

alter table public.stores enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists stores_select on public.stores;
create policy stores_select on public.stores for select to authenticated
  using (public.my_role() in ('admin','doi_truong','nha_thau','viewer'));
drop policy if exists stores_insert on public.stores;
create policy stores_insert on public.stores for insert to authenticated
  with check (public.is_admin());
drop policy if exists stores_delete on public.stores;
create policy stores_delete on public.stores for delete to authenticated
  using (public.is_admin());
drop policy if exists stores_update on public.stores;
create policy stores_update on public.stores for update to authenticated
  using (
    public.is_admin()
    or (public.my_role() = 'doi_truong' and public.my_scope() <> ''
        and coalesce(data->>'doi_truong','') ilike '%' || public.my_scope() || '%')
    or (public.my_role() = 'nha_thau' and public.my_scope() <> ''
        and (coalesce(data->>'nt_lap','') || ' | ' || coalesce(data->>'nt_vc','')) ilike '%' || public.my_scope() || '%')
  ) with check (true);

drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated
  using (public.my_role() in ('admin','doi_truong','nha_thau','viewer'));

-- Cập nhật một phần (gộp trường) — chạy với quyền người gọi, RLS áp dụng
create or replace function public.patch_store(p_site text, p_patch jsonb) returns public.stores
language plpgsql security invoker set search_path = public as $$
declare r stores;
begin
  update stores set data = data || p_patch where site = p_site returning * into r;
  if not found then raise exception 'Không có quyền cập nhật cửa hàng %', p_site; end if;
  return r;
end $$;

-- Import Excel (chỉ Admin): giá trị trống trong file không ghi đè dữ liệu đã có
create or replace function public.import_stores(p_rows jsonb) returns integer
language plpgsql security invoker set search_path = public as $$
declare n int := 0; x jsonb;
begin
  if not is_admin() then raise exception 'Chỉ Admin được import'; end if;
  perform set_config('app.action', 'Import Excel', true);
  for x in select * from jsonb_array_elements(p_rows) loop
    insert into stores (site, data) values (x->>'site', jsonb_strip_nulls(x))
    on conflict (site) do update set data = stores.data || excluded.data;
    n := n + 1;
  end loop;
  return n;
end $$;

-- 3. Ảnh (Storage, riêng tư) --------------------------------------------
insert into storage.buckets (id, name, public) values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists photos_read on storage.objects;
create policy photos_read on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.my_role() in ('admin','doi_truong','nha_thau','viewer'));
drop policy if exists photos_write on storage.objects;
create policy photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.my_role() in ('admin','doi_truong','nha_thau'));

-- 4. Realtime: mọi máy thấy cập nhật ngay
do $$ begin
  alter publication supabase_realtime add table public.stores;
exception when others then null; end $$;
