-- supabase/migrations/0010_hide_hidden_products.sql
-- OWASP A01：hidden 商品原本 public read using (true)，未上架品項/價格/圖片可從 /rest/v1 直接讀到。
-- 改成只公開非 hidden；admin 透過 0004 的 "admin write *"（for all）政策仍可讀全部。
-- （decrement_stock 權限與折扣碼原子認領已由 0008/0009 處理）

drop policy if exists "public read products" on products;
drop policy if exists "public read variants" on product_variants;
drop policy if exists "public read images"   on product_images;

create policy "public read products" on products
  for select using (status <> 'hidden');
create policy "public read variants" on product_variants
  for select using (exists (select 1 from products p where p.id = product_id and p.status <> 'hidden'));
create policy "public read images" on product_images
  for select using (exists (select 1 from products p where p.id = product_id and p.status <> 'hidden'));
