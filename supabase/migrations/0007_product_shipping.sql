-- 商品物流旗標：後台可逐一設定「這個商品需不需要物流」。
-- 尾款商品 = true（需物流、貨到付款）；訂金商品 = false（免物流）。
-- 目前僅作資訊/後台管理用，未串接 PAYUNi 物流 API。
alter table products add column if not exists needs_shipping boolean not null default true;
