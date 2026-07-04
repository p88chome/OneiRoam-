-- supabase/migrations/0002_orders.sql
create table if not exists orders (
  id             uuid primary key default gen_random_uuid(),
  order_no       text unique not null,
  name           text not null default '',
  phone          text not null default '',
  social         text not null default '',
  email          text not null default '',
  notes          text not null default '',
  amount_type    text not null check (amount_type in ('deposit','full')),
  subtotal       int  not null default 0,
  discount       int  not null default 0,
  total          int  not null default 0,
  pay_amount     int  not null default 0,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed')),
  gateway_trade_no text not null default '',
  payment_method text not null default '',
  needs_review   bool not null default false,
  paid_at        timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  product_id  text not null,
  variant_id  uuid,
  name        text not null default '',
  size        text not null default '',
  price       int  not null default 0,
  qty         int  not null default 1
);

alter table orders      enable row level security;
alter table order_items enable row level security;
-- 只有登入者（後台）可讀；anon 一律不可（寫入只經 Edge Function 的 service role，繞過 RLS）
create policy "auth read orders"  on orders      for select to authenticated using (true);
create policy "auth read oitems"  on order_items for select to authenticated using (true);

-- 原子扣庫存：逐 item 扣對應 variant；不足則回 false（呼叫端標 needs_review）
create or replace function decrement_stock(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  it record;
  ok boolean := true;
begin
  for it in
    select oi.product_id, oi.size, oi.qty
    from order_items oi where oi.order_id = p_order_id
  loop
    update product_variants v
      set stock = v.stock - it.qty
      where v.product_id = it.product_id and v.size = it.size and v.stock >= it.qty;
    if not found then ok := false; end if;
  end loop;
  return ok;
end;
$$;
