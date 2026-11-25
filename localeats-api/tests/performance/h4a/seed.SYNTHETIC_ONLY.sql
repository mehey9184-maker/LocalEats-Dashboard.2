TRUNCATE orders,menu_items,pickup_order_events;
INSERT INTO orders SELECT md5('order'||g)::uuid,'shop-'||(g%100),'customer-'||(g%1000),'collection',CASE WHEN g%10=0 THEN 'pending' ELSE 'collected' END,NULL,timestamptz '2026-01-01' + g * interval '1 minute','synthetic-'||g,jsonb_build_array(jsonb_build_object('name','Synthetic Meal','quantity',1,'price',25)) FROM generate_series(1,:n) g;
INSERT INTO menu_items SELECT 'menu-'||g,'shop-'||(g%100),'Synthetic Meal',25,true FROM generate_series(1,:menus) g;
INSERT INTO pickup_order_events SELECT md5('event'||g)::uuid,md5('order'||g)::uuid,'customer-'||(g%1000),'ready',timestamptz '2026-01-01'+g*interval '1 minute' FROM generate_series(1,:n) g;
ANALYZE orders; ANALYZE menu_items; ANALYZE pickup_order_events;
