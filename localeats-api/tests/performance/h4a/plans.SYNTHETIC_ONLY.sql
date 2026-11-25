-- Query shape, reduced projection/schema for isolated benchmark; no live customer records.
\echo H4A_QUERY_customer_history
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) SELECT * FROM orders WHERE user_id='customer-7' AND delivery_type='collection' ORDER BY created_at DESC,id DESC LIMIT 51;
\echo H4A_QUERY_merchant_recent
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) SELECT * FROM orders WHERE shop_id='shop-7' ORDER BY created_at DESC,id DESC LIMIT 50;
\echo H4A_QUERY_menu
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) SELECT id,shop_id,name,price,is_available FROM menu_items WHERE shop_id='shop-7';
\echo H4A_QUERY_ready_inbox
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) SELECT id,order_id,kind,occurred_at FROM pickup_order_events WHERE recipient_uid='customer-7' AND kind='ready' ORDER BY occurred_at DESC,id DESC LIMIT 50;
\echo H4A_PLAN_PASS
