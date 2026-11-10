-- supabase/migrations/0014_order_pay_code.sql
-- ATM 虛擬帳號 / 超商代碼的取號資訊。
-- PAYUNi 取號成功後用 ReturnURL 把客人導回來（TradeStatus=0），資訊在加密的 EncryptInfo 裡；
-- payuni-return 驗章解密後寫進這裡，讓店主在後台對帳。實際付款完成仍以 payuni-notify 為準。
alter table orders add column if not exists pay_bank text;    -- 銀行代碼（ATM 才有）
alter table orders add column if not exists pay_no text;      -- 虛擬帳號 / 繳費代碼
alter table orders add column if not exists pay_expire text;  -- 繳費截止時間（PAYUNi 格式 YYYY-MM-DD HH:II:SS）
