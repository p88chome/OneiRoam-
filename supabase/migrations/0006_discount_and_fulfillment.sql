-- supabase/migrations/0006_discount_and_fulfillment.sql
-- 折扣碼 + 後台訂單出貨狀態

create table if not exists discount_codes (
  code         text primary key,
  percent_off  int,                          -- 0-100，跟 amount_off 擇一
  amount_off   int,                          -- 台幣固定折抵，跟 percent_off 擇一
  active       boolean not null default true,
  expires_at   timestamptz,
  max_uses     int,                          -- null = 不限次數
  used_count   int not null default 0,
  created_at   timestamptz not null default now()
);
alter table discount_codes enable row level security;
-- 只有 admin 能管理；驗證與套用一律在 create-order（service role）內進行，不開放公開讀取
create policy "admin all discount_codes" on discount_codes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 出貨狀態：admin 後台可標記；客人（own-read）與其餘人一律唯讀
alter table orders add column if not exists fulfillment_status text not null default 'unfulfilled'
  check (fulfillment_status in ('unfulfilled', 'shipped'));
alter table orders add column if not exists discount_code text;

create policy "admin update orders" on orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
