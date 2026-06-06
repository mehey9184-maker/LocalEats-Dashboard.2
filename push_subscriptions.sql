-- Table for Web Push Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- 'merchant', 'rider', 'client'
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON push_subscriptions;
CREATE POLICY "Users can insert their own subscriptions"
ON push_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own subscriptions" ON push_subscriptions;
CREATE POLICY "Users can update their own subscriptions"
ON push_subscriptions FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own subscriptions" ON push_subscriptions;
CREATE POLICY "Users can view their own subscriptions"
ON push_subscriptions FOR SELECT
USING (auth.uid() = user_id);

-- Optional: DB function to trigger an edge function or save a notification
