-- supabase/migrations/0018_paid_flow_hardening.sql
-- OWASP 檢查（2026-11-26）修正：付款後流程「錢收到了、系統沒跟上、沒人知道」。

-- 1. mark_order_paid：認領已付款＋計折扣碼＋扣庫存＋標 needs_review 放在同一個交易。
--    以前是 notify 分好幾次呼叫，認領成功後才出錯的話，PAYUNi 重送時會因為「已認領」直接略過，
--    庫存沒扣、折扣碼沒計、也沒標人工核對。現在任何一步出錯整筆 rollback，回 500 讓 PAYUNi 重送即可。
--
--    也接受 failed / expired → paid：刷卡失敗後重試成功、或 ATM 在期限邊緣繳費而失效通知先到，
--    錢是真的收到了，必須記成已付款（並標 needs_review 讓店主確認）。
--
--    回傳 { claimed, prev_status, review: [原因…] }；claimed=false 代表早已是 paid（重送），或查無訂單。
create or replace function public.mark_order_paid(p_order_id uuid, p_trade_no text, p_method text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orders%rowtype;
  reasons text[] := '{}';
begin
  select * into o from orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('claimed', false, 'prev_status', null, 'review', '[]'::jsonb);
  end if;
  if o.payment_status = 'paid' then
    return jsonb_build_object('claimed', false, 'prev_status', 'paid', 'review', '[]'::jsonb);
  end if;

  update orders
     set payment_status = 'paid',
         gateway_trade_no = coalesce(p_trade_no, ''),
         payment_method = coalesce(p_method, ''),
         paid_at = now()
   where id = p_order_id;

  if o.payment_status <> 'pending' then
    reasons := reasons || ('paid_after_' || o.payment_status);
  end if;

  -- 折扣碼用量在付款這一刻 +1（0011）；discount_counted=true 是 0011 之前已在下單時計過的舊單
  if coalesce(o.discount_code, '') <> '' and not o.discount_counted then
    -- 碼已刪除時 count_discount_use 回 null → 視同超量，交給店主判斷
    if not coalesce(public.count_discount_use(o.discount_code), false) then
      reasons := reasons || 'discount_over_limit'::text;
    end if;
    update orders set discount_counted = true where id = p_order_id;
  end if;

  if not public.decrement_stock(p_order_id) then
    reasons := reasons || 'stock_short'::text;
  end if;

  if cardinality(reasons) > 0 then
    update orders set needs_review = true where id = p_order_id;
  end if;

  return jsonb_build_object('claimed', true, 'prev_status', o.payment_status, 'review', to_jsonb(reasons));
end;
$$;

revoke execute on function public.mark_order_paid(uuid, text, text) from public, anon, authenticated;
grant  execute on function public.mark_order_paid(uuid, text, text) to service_role;

-- 2. 付款失敗的訂單：建立滿 1 天才可刪（客人可能用同一筆訂單重試付款）。
--    已失效（ATM / 超商期限已過）維持立即可刪；萬一刪掉後才收到付款，notify 會寄信通知店主。
--    規則同時寫在 order-rules.js，兩邊要一致。
create or replace function public.order_deletable(
  p_status text, p_pay_no text, p_pay_expire text, p_created_at timestamptz
) returns boolean
language sql stable
set search_path = public
as $$
  select case
    when p_status = 'expired' then true
    when p_status = 'failed' then p_created_at < now() - interval '1 day'
    when p_status = 'pending' and coalesce(p_pay_no, '') = '' then p_created_at < now() - interval '8 days'
    when p_status = 'pending' then
      case when p_pay_expire ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$'
           then (p_pay_expire::timestamp at time zone 'Asia/Taipei') < now()
           else false end
    else false
  end;
$$;

-- 3. 後台（authenticated）只能改出貨狀態與「已核對」標記；付款狀態、金額、付款時間只有
--    service role（payuni-notify）能寫。避免 admin 帳號被盜時「先改成付款失敗再刪除」或竄改金額。
--    RLS policy 管「哪幾列」，欄位權限管「哪幾欄」，兩者都要過。
revoke update on orders from anon, authenticated;
grant update (fulfillment_status, needs_review) on orders to authenticated;
revoke update on order_items from anon, authenticated;

-- 4. 折扣碼數值範圍（以前只靠後台表單 min/max）。not valid：只檢查之後的寫入，不因舊資料擋住 migration
alter table discount_codes drop constraint if exists discount_codes_percent_off_range;
alter table discount_codes add constraint discount_codes_percent_off_range
  check (percent_off is null or percent_off between 1 and 100) not valid;
alter table discount_codes drop constraint if exists discount_codes_amount_off_positive;
alter table discount_codes add constraint discount_codes_amount_off_positive
  check (amount_off is null or amount_off > 0) not valid;
