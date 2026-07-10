-- 分類改版 2026-07：dress/bag 舊分類遷到新制
-- 新分類：puff 澎袖 / collar 領片 / set 套裝 / top 上衣 / bottom 下著 / accessory 其他配件 / select 選品
update products set category = 'puff'      where category = 'dress';
update products set category = 'accessory' where category = 'bag';
update products set category = 'set'       where id = 'top-lace-set'; -- 蕾絲花圃套裝本來就是套裝
