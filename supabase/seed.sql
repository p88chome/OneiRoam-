-- supabase/seed.sql
insert into products (id,name_zh,name_en,desc_zh,desc_en,category,price,badge_zh,badge_en,status,sort_order) values
('dress-white-lace','花嫁之夢','Bridal Dream','白色蕾絲歐根紗洋裝，澎袖馬甲設計，背後蝴蝶結綁帶。手工刺繡花卉歐根紗，仙氣十足。','White lace organza dress with puff sleeves, corset bodice and back bow tie.','puff',1690,'限量手作','Limited','preorder',1),
('top-mesh-pink','夢雲網紗上衣','Dream Cloud Mesh Top','粉紫水彩暈染長袖網紗上衣，搭配手工草莓刺繡點綴。','Pink purple watercolor long sleeve mesh top.','top',1690,'手染獨款','Hand-dyed','preorder',2),
('top-mesh-blue','夢雲網紗上衣','Dream Cloud Mesh Top','霧藍水彩暈染長袖網紗上衣，朦朧感如夢似幻。','Misty blue watercolor long sleeve mesh top.','top',1690,'手染獨款','Hand-dyed','preorder',3),
('bag-ruffle-white','雲朵荷葉包','Cloud Ruffle Bag','純白歐根紗荷葉手提包，蓬鬆立體的荷葉造型如一朵雲。','Pure white organza ruffle tote bag.','accessory',1690,'限量手作','Limited','preorder',4),
('bag-ruffle-blue','雲朵荷葉包','Cloud Ruffle Bag','霧藍歐根紗荷葉手提包。','Misty blue organza ruffle tote bag.','accessory',1690,'限量手作','Limited','preorder',5),
('top-lace-set','蕾絲花圃套裝','Lace Garden Set','白色蕾絲花卉上衣搭配歐根紗裙。','White lace floral top paired with organza skirt.','top',1690,'限量手作','Limited','preorder',6),
('sea-gcd-short-jelly','海的公因數 · 短袖水母','Sea GCD · Short Sleeve Jellyfish','🫧 印花透膚短袖上衣，水母圖案。','Sheer printed short-sleeve top, jellyfish print.','top',980,'印花透膚','Sheer Print','preorder',7),
('sea-gcd-short-tear','海的公因數 · 短袖眼淚','Sea GCD · Short Sleeve Teardrop','🫧 印花透膚短袖上衣，眼淚圖案。','Sheer printed short-sleeve top, teardrop print.','top',980,'印花透膚','Sheer Print','preorder',8),
('sea-gcd-long-jelly','海的公因數 · 立領長袖水母','Sea GCD · Mock Neck Long Jellyfish','🫧 印花透膚立領長袖上衣，水母圖案。','Sheer printed mock-neck long-sleeve top, jellyfish print.','top',1680,'印花透膚','Sheer Print','preorder',9),
('sea-gcd-long-tear','海的公因數 · 立領長袖眼淚','Sea GCD · Mock Neck Long Teardrop','🫧 印花透膚立領長袖上衣，眼淚圖案。','Sheer printed mock-neck long-sleeve top, teardrop print.','top',1680,'印花透膚','Sheer Print','preorder',10)
on conflict (id) do nothing;

-- 尺寸+庫存（限購一件 → max_qty 1；初始庫存暫設 20，老闆可後台調）
insert into product_variants (product_id,size,stock,max_qty)
select id, unnest(array['S','M','L','XL']), 20, 1 from products where category='puff';
insert into product_variants (product_id,size,stock,max_qty)
select id, unnest(array['S','M','L','XL']), 20, 1 from products where id in ('top-mesh-pink','top-mesh-blue','top-lace-set');
insert into product_variants (product_id,size,stock,max_qty)
select id, 'F', 20, 1 from products where category='accessory';
insert into product_variants (product_id,size,stock,max_qty)
select id, unnest(array['小碼','大碼']), 20, 1 from products where id like 'sea-gcd-%';

-- 圖片（沿用 repo 既有路徑；海的公因數共用 jelly/tear 兩張）
insert into product_images (product_id,url,sort_order) values
('dress-white-lace','/images/products/dress-white-lace.jpg',0),
('top-mesh-pink','/images/products/top-mesh-pink.jpg',0),
('top-mesh-blue','/images/products/top-mesh-blue.jpg',0),
('bag-ruffle-white','/images/products/bag-ruffle-white.jpg',0),
('bag-ruffle-blue','/images/products/bag-ruffle-blue.jpg',0),
('top-lace-set','/images/products/top-lace-set.jpg',0),
('sea-gcd-short-jelly','/images/products/sea-gcd-jelly.jpg',0),
('sea-gcd-short-tear','/images/products/sea-gcd-tear.jpg',0),
('sea-gcd-long-jelly','/images/products/sea-gcd-jelly.jpg',0),
('sea-gcd-long-tear','/images/products/sea-gcd-tear.jpg',0);

-- 設定（戶名先留空，老闆後台填）
insert into settings (key,value) values
('bank_name','玉山銀行'),('bank_code','808'),('bank_account','0831976040688'),
('bank_holder',''),('preorder_start','2026-06-23'),('preorder_end','2026-06-30'),
('deposit_rate','0.5')
on conflict (key) do nothing;
