-- supabase/migrations/0016_order_delete_and_cancel.sql
-- 後台訂單管理：
--  1. admin 可刪除「確定不會再付款」的訂單（測試單、放棄的單），已付款訂單一律不可刪
--  2. 已付款訂單改用「已取消」（fulfillment_status = 'cancelled'）；退款與補庫存由店主人工處理
-- 規則同時寫在 order-rules.js（後台顯示按鈕用），兩邊要一致。

-- 1. 可刪除判斷
--    failed / expired                 → 可刪
--    pending 且沒有繳費代碼           → 建立超過 1 小時才可刪（避免客人刷卡途中被刪）
--    pending 且有 ATM / 超商代碼      → 過了繳費期限才可刪（期限內客人隨時可能去繳）
--    paid                             → 不可刪
create or replace function public.order_deletable(
  p_status text, p_pay_no text, p_pay_expire text, p_created_at timestamptz
) returns boolean
language sql stable
set search_path = public
as $$
  select case
    when p_status in ('failed', 'expired') then true
    when p_status = 'pending' and coalesce(p_pay_no, '') = '' then p_created_at < now() - interval '1 hour'
    when p_status = 'pending' then
      -- pay_expire 是 PAYUNi 格式 'YYYY-MM-DD HH:MI:SS'（台灣時間）；格式不對就不給刪
      case when p_pay_expire ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$'
           then (p_pay_expire::timestamp at time zone 'Asia/Taipei') < now()
           else false end
    else false
  end;
$$;

-- 刪訂單時 order_items 會由外鍵 on delete cascade 一起刪除（外鍵動作不受 RLS 影響）
create policy "admin delete unpaid orders" on orders
  for delete to authenticated
  using (public.is_admin() and public.order_deletable(payment_status, pay_no, pay_expire, created_at));

-- 2. 已取消
alter table orders drop constraint if exists orders_fulfillment_status_check;
alter table orders add constraint orders_fulfillment_status_check
  check (fulfillment_status in ('unfulfilled', 'shipped', 'cancelled'));
