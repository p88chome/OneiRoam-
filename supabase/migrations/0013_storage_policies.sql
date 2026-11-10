-- supabase/migrations/0013_storage_policies.sql
-- product-images bucket 的 storage.objects policy 收進 repo（原本是 Dashboard 手動建的）。
--
-- 修正：舊的 "auth upload images" 允許任何 authenticated 使用者 INSERT。
-- 開了 Google 登入後，任何客人都能直接呼叫 Storage API 往 bucket 塞檔案
-- （公開可讀 → 等於拿我們的空間散布檔案、塞爆額度）。
-- policy 是 OR 合併，所以只要這條在，admin-only 那條就擋不住上傳。
--
-- 最終狀態：讀取公開（前台顯示圖片）；寫入（上傳／覆蓋／刪除）只限 admin。

drop policy if exists "auth upload images" on storage.objects;

drop policy if exists "admin write storage" on storage.objects;
create policy "admin write storage" on storage.objects
  for all to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "public read images bucket" on storage.objects;
create policy "public read images bucket" on storage.objects
  for select to public
  using (bucket_id = 'product-images');
