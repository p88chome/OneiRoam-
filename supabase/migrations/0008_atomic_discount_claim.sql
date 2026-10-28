-- 修正 create-order 折扣碼用量的競態條件（TOCTOU）：
-- 舊流程是先讀 used_count 再另外寫回 +1，併發請求可以同時讀到同一個舊值，
-- 全部通過 max_uses 檢查，讓限量折扣碼被超額使用。改成單一原子 UPDATE，
-- 由資料庫在同一條敘述內完成「檢查上限 + 遞增」，天生不會有這個競態。

create or replace function public.claim_discount_code(p_code text)
returns setof discount_codes
language sql as $$
  update discount_codes
  set used_count = used_count + 1
  where code = p_code
    and active
    and (expires_at is null or expires_at > now())
    and (max_uses is null or used_count < max_uses)
  returning *;
$$;

-- 建單後續步驟失敗時的補償：把 claim 佔用的名額還回去，避免棄單白白吃掉額度
create or replace function public.release_discount_code(p_code text)
returns void
language sql as $$
  update discount_codes
  set used_count = greatest(used_count - 1, 0)
  where code = p_code;
$$;

grant execute on function public.claim_discount_code(text) to service_role;
grant execute on function public.release_discount_code(text) to service_role;
