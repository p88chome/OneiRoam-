-- 會員專區：訂單掛帳號。訪客結帳 user_id 為 null（只有 admin 讀得到）。
alter table orders add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists orders_user_idx on orders(user_id) where user_id is not null;

-- 客人只能讀自己的訂單（與 0004 的 admin read 並存，permissive OR）
create policy "own orders select" on orders
  for select to authenticated
  using (user_id is not null and user_id = auth.uid());
create policy "own oitems select" on order_items
  for select to authenticated
  using (exists (select 1 from orders o
                 where o.id = order_items.order_id and o.user_id = auth.uid()));
