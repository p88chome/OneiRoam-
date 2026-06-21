-- supabase/migrations/0001_init.sql
create table if not exists products (
  id          text primary key,
  name_zh     text not null,
  name_en     text not null default '',
  desc_zh     text not null default '',
  desc_en     text not null default '',
  category    text not null default 'top',
  price       int  not null check (price >= 0),
  badge_zh    text not null default '',
  badge_en    text not null default '',
  status      text not null default 'preorder'
              check (status in ('preorder','active','sold_out','hidden')),
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  text not null references products(id) on delete cascade,
  size        text not null,
  stock       int  not null default 0 check (stock >= 0),
  max_qty     int  not null default 1 check (max_qty >= 1)
);

create table if not exists product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  text not null references products(id) on delete cascade,
  url         text not null,
  sort_order  int  not null default 0
);

create table if not exists settings (
  key         text primary key,
  value       text not null default ''
);

alter table products         enable row level security;
alter table product_variants enable row level security;
alter table product_images   enable row level security;
alter table settings         enable row level security;

-- 公開讀
create policy "public read products"  on products         for select using (true);
create policy "public read variants"  on product_variants for select using (true);
create policy "public read images"    on product_images   for select using (true);
create policy "public read settings"  on settings         for select using (true);

-- 登入才能寫
create policy "auth write products"   on products         for all to authenticated using (true) with check (true);
create policy "auth write variants"   on product_variants for all to authenticated using (true) with check (true);
create policy "auth write images"     on product_images   for all to authenticated using (true) with check (true);
create policy "auth write settings"   on settings         for all to authenticated using (true) with check (true);
