-- Google 會員登入前置：開放註冊後「任何 authenticated 可寫入」不再安全。
-- ⚠️ 執行順序（詳見 docs/google-login-setup.md）：
--   1. 先把管理員帳號標成 admin（換成實際 admin email）：
--      update auth.users
--        set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
--        where email = 'ADMIN_EMAIL_HERE';
--   2. 再執行本檔。3. admin 後台重新登入（舊 JWT 不帶 role）。
--   4. 重新部署 trigger-deploy function。5. 最後才在 Dashboard 開 Google provider + signups。

-- app_metadata 由伺服器控管，使用者無法自行設定
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

drop policy if exists "auth write products" on products;
drop policy if exists "auth write variants" on product_variants;
drop policy if exists "auth write images"   on product_images;
drop policy if exists "auth write settings" on settings;

create policy "admin write products" on products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write variants" on product_variants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write images" on product_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write settings" on settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 會員資料：一人一筆，只能讀寫自己的
create table if not exists customer_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text not null default '',
  phone      text not null default '',
  social     text not null default '',
  email      text not null default '',
  updated_at timestamptz not null default now()
);
alter table customer_profiles enable row level security;

create policy "own profile select" on customer_profiles
  for select to authenticated using (auth.uid() = user_id);
create policy "own profile insert" on customer_profiles
  for insert to authenticated with check (auth.uid() = user_id);
create policy "own profile update" on customer_profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
