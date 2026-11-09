-- supabase/migrations/0012_product_full_price.sql
-- 預購商品「全額」顯示用（選填）。結帳金額仍是 products.price（訂金）；
-- full_price 有填且大於 price 時，前台顯示「全額 NT$x / 訂金 NT$y」。
alter table products add column if not exists full_price int
  check (full_price is null or full_price >= 0);
