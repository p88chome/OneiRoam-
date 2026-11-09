# Supabase 待辦（給遠端 agent，2026-11-09）

> 目標：把 repo 裡的 migration / Edge Function 同步到 Supabase 專案 `ywzsjhaqgidgxnjmyyeg`。
> 前端（Cloudflare）已 push 到 staging，**0012 沒跑之前，後台「儲存商品」會失敗**（unknown column `full_price`），所以 0012 最優先。
> Staging 和正式站共用同一個 Supabase，下面每支 migration 都只是新增，對正式站無破壞性。

## 1. 先確認哪些 migration 已經跑過

在 SQL Editor 執行，看每一列的結果：

```sql
select
  -- 0008/0009：折扣碼原子認領 + 鎖 RPC
  exists (select 1 from pg_proc where proname = 'claim_discount_code')            as m0008,
  not has_function_privilege('anon', 'public.decrement_stock(uuid)', 'execute')   as m0009,
  -- 0010：hidden 商品不公開（policy 條件含 hidden）
  exists (select 1 from pg_policies where tablename = 'products'
          and policyname = 'public read products' and qual like '%hidden%')       as m0010,
  -- 0011：折扣碼付款後才計數
  exists (select 1 from information_schema.columns
          where table_name = 'orders' and column_name = 'discount_counted')       as m0011,
  -- 0012：商品全額
  exists (select 1 from information_schema.columns
          where table_name = 'products' and column_name = 'full_price')           as m0012;
```

## 2. 依序執行還沒跑的（false 的那幾支）

檔案都在 `supabase/migrations/`，整份貼進 SQL Editor 執行，**照編號順序**：

| 檔案 | 做什麼 |
|---|---|
| `0008_atomic_discount_claim.sql` | `claim_discount_code` / `release_discount_code` RPC |
| `0009_lock_definer_rpcs.sql` | 收回 anon/authenticated 對 `decrement_stock` 等 RPC 的執行權（**資安重點**：未跑 = 任何人可把庫存扣到 0） |
| `0010_hide_hidden_products.sql` | hidden 商品不再公開讀取 |
| `0011_discount_count_on_paid.sql` | `orders.discount_counted` + `count_discount_use` RPC |
| `0012_product_full_price.sql` | `products.full_price`（前台「全額／訂金」顯示用） |

跑完再執行一次第 1 步，五個都要是 `true`。

## 3. 重新部署 Edge Functions

migration 全部跑完**之後**才部署（新版函式會呼叫 0008/0011 的 RPC，順序反了下單會 500）：

```bash
supabase functions deploy create-order
supabase functions deploy payuni-notify
```

（沒有 CLI → Dashboard → Edge Functions 貼上 `supabase/functions/<name>/index.ts` 與 `_shared/` 內容）

## 4. 檢查 Storage 權限（repo 無法驗證，只能在 Dashboard 看）

`product-images` bucket 的 `storage.objects` policy：insert / update / delete 必須只允許 admin。

```sql
select policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'storage' and tablename = 'objects';
```

- 如果有「authenticated 都能寫」的舊 policy（`qual`/`with_check` 是 `true` 或只檢查 `bucket_id`）→ 刪掉，改成：

```sql
create policy "admin write product-images" on storage.objects
  for all to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());
```

- 公開讀取（select）保留，前台要顯示圖片
- 改完把最終 policy 寫成 `supabase/migrations/0013_storage_policies.sql` commit 進 repo

## 5. 驗證

- [ ] anon key 呼叫 `POST /rest/v1/rpc/decrement_stock` → permission denied
- [ ] anon 讀 `/rest/v1/products?status=eq.hidden` → 空陣列
- [ ] 後台編輯任一商品，填「全額」→ 儲存成功 → 發布到網站 → 卡片顯示「全額 NT$x／訂金 NT$y」
- [ ] 後台上傳多張圖 → 儲存 → 發布 → 商品頁縮圖可切換
- [ ] Sandbox 帶折扣碼下單＋付款：付款前 `used_count` 不變，付款後 +1，訂單轉 `paid`

完成後回報第 1 步的結果和第 4 步的 policy 清單。其餘資安待辦見 `docs/security-hardening.md`。
