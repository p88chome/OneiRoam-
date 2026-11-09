-- 折扣碼改成「付款成功」才計入用量（docs/security-hardening.md P2）。
-- 舊流程在下單（pending）時就 claim +1，有人可以只下單不付款，把限量碼的名額耗光。
--
-- 新流程：create-order 只驗證（不扣），payuni-notify 在 pending→paid 那一次才計數。
--
-- discount_counted：這筆訂單的折扣碼用量是否已經算過。
-- 預設 true → 既有訂單、以及部署過渡期間舊版 create-order 建的訂單（都已在下單時 +1）
-- 不會在付款時被重複計數。新版 create-order 寫入時明確設 false。

alter table orders add column if not exists discount_counted boolean not null default true;

-- 付款後計數：一律 +1（客人已付款，用量就是用了），回傳是否仍在上限內。
-- 超過上限（多張 pending 訂單同時付款）回 false，由 notify 標 needs_review 給店主判斷。
-- 不檢查 active / expires_at：客人下單當下有效即可，付款時碼剛好過期不算違規。
create or replace function public.count_discount_use(p_code text)
returns boolean
language sql as $$
  update discount_codes
  set used_count = used_count + 1
  where code = p_code
  returning (max_uses is null or used_count <= max_uses);
$$;

revoke execute on function public.count_discount_use(text) from public, anon, authenticated;
grant  execute on function public.count_discount_use(text) to service_role;
