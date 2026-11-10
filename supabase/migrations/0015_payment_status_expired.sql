-- supabase/migrations/0015_payment_status_expired.sql
-- ATM / 超商代碼過了繳費期限，PAYUNi 會送「訂單失效」Notify（TradeStatus=4）。
-- 新增 expired 狀態，讓這類訂單不再永遠卡在 pending。
alter table orders drop constraint if exists orders_payment_status_check;
alter table orders add constraint orders_payment_status_check
  check (payment_status in ('pending', 'paid', 'failed', 'expired'));
