-- ==============================================================================
-- 05: MISSING FOREIGN KEY INDEXES & PERFORMANCE HARDENING
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON public.orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON public.orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_shop_id ON public.menu_items(shop_id);
CREATE INDEX IF NOT EXISTS idx_announcements_shop_id ON public.announcements(shop_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_shop_id ON public.chat_messages(shop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_shop_id ON public.reviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_rider_connections_shop_id ON public.rider_connections(shop_id);
CREATE INDEX IF NOT EXISTS idx_rider_connections_rider_id ON public.rider_connections(rider_id);
CREATE INDEX IF NOT EXISTS idx_shop_followers_user_id ON public.shop_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_followers_shop_id ON public.shop_followers(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_shop_id ON public.payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_coupons_shop_id ON public.coupons(shop_id);
CREATE INDEX IF NOT EXISTS idx_rider_notifications_rider_id ON public.rider_notifications(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_notifications_shop_id ON public.rider_notifications(shop_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON public.notification_logs(user_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id)';
  END IF;
END $$;

SELECT '05_foreign_key_indexes.sql applied successfully' AS status;
