-- 鎖住 RPC 執行權限：Postgres 建 function 預設 grant execute 給 PUBLIC，
-- PostgREST 會把它們開成 /rest/v1/rpc/* 端點，任何人（含 anon key）都能呼叫。
--
-- decrement_stock 是 SECURITY DEFINER（以 owner 身分執行、繞過 RLS），暴露給 anon
-- 等於讓任何人拿 order_id 就能扣任意訂單的庫存（denial-of-inventory）。實測 anon
-- 呼叫回 200 true，確認可打。claim/release_discount_code 非 definer、RLS 會擋，
-- 影響低，但一併收斂：這三個 RPC 只該由 create-order / payuni-notify 的 service role 呼叫。
--
-- 收回 PUBLIC/anon/authenticated 的 execute，只留 service_role。

revoke execute on function public.decrement_stock(uuid)       from public, anon, authenticated;
revoke execute on function public.claim_discount_code(text)   from public, anon, authenticated;
revoke execute on function public.release_discount_code(text) from public, anon, authenticated;

grant execute on function public.decrement_stock(uuid)        to service_role;
grant execute on function public.claim_discount_code(text)    to service_role;
grant execute on function public.release_discount_code(text)  to service_role;
