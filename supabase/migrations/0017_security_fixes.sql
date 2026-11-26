-- supabase/migrations/0017_security_fixes.sql
-- 資安檢查（2026-11-15）修正：
--
-- 1. 待付款、沒有繳費代碼的訂單：1 小時 → 建立 8 天後才可刪。
--    繳費代碼平常靠客人瀏覽器導回才記得到；客人取號後直接關頁面時代碼是空的，
--    但 PAYUNi 已把帳號寄給客人、期限好幾天。太早刪會變成「錢收了、訂單沒了」。
--    規則同時寫在 order-rules.js，兩邊要一致。
create or replace function public.order_deletable(
  p_status text, p_pay_no text, p_pay_expire text, p_created_at timestamptz
) returns boolean
language sql stable
set search_path = public
as $$
  select case
    when p_status in ('failed', 'expired') then true
    when p_status = 'pending' and coalesce(p_pay_no, '') = '' then p_created_at < now() - interval '8 days'
    when p_status = 'pending' then
      case when p_pay_expire ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$'
           then (p_pay_expire::timestamp at time zone 'Asia/Taipei') < now()
           else false end
    else false
  end;
$$;

-- 2. 移除 product-images 的公開 SELECT policy。
--    有這條，任何人都能用 Storage「列出檔案」API 看到所有檔名（含未上架商品的圖）。
--    public bucket 的公開網址（/object/public/...）不經過 RLS，前台與發布時下載圖片不受影響；
--    後台上傳／覆蓋走 0013 的 "admin write storage"。
drop policy if exists "public read images bucket" on storage.objects;
