-- Fingerprint of synthetic order/event/notification chain, no customer details.
SELECT md5(
 (SELECT string_agg(id::text || '|' || idempotency_key::text || '|' || total_minor::text, ',' ORDER BY id::text) FROM public.orders)
 || ':' || (SELECT string_agg(id::text || '|' || order_id::text, ',' ORDER BY id::text) FROM public.pickup_order_events)
 || ':' || (SELECT string_agg(id::text || '|' || event_id::text, ',' ORDER BY id::text) FROM public.pickup_push_outbox)
);
