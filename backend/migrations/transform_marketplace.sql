-- ============================================================
-- Migration: Transform RentFlow into Multi-Admin Marketplace
-- Run this in your Supabase SQL Editor to apply database updates.
-- ============================================================

-- 1. Update app_users table
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS company_or_agency TEXT;

-- Drop existing role constraint and add updated one
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check 
    CHECK (role IN ('admin', 'owner', 'manager', 'user', 'viewer', 'ADMIN', 'OWNER', 'MANAGER', 'USER', 'VIEWER'));

-- 2. Update properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS listing_type TEXT DEFAULT 'RENT' CHECK (listing_type IN ('RENT', 'SALE', 'BOTH'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12,2) DEFAULT NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'RENTED', 'SOLD'));

-- 3. Create listing_categories table
CREATE TABLE IF NOT EXISTS listing_categories (
    id   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT
);
ALTER TABLE listing_categories DISABLE ROW LEVEL SECURITY;

-- 4. Create listings table
CREATE TABLE IF NOT EXISTS listings (
    id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id      UUID REFERENCES app_users(id) ON DELETE CASCADE,
    category_id    UUID REFERENCES listing_categories(id) ON DELETE SET NULL,
    title          TEXT NOT NULL,
    description    TEXT,
    listing_type   TEXT NOT NULL CHECK (listing_type IN ('RENT', 'SALE')),
    price          NUMERIC(12,2) NOT NULL,
    rent_frequency TEXT DEFAULT 'monthly',
    city           TEXT NOT NULL,
    locality       TEXT,
    images         TEXT[] DEFAULT ARRAY[]::TEXT[],
    status         TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RENTED', 'SOLD')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE listings DISABLE ROW LEVEL SECURITY;

-- 5. Create chat_conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
    buyer_id   UUID REFERENCES app_users(id) ON DELETE CASCADE,
    seller_id  UUID REFERENCES app_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (listing_id, buyer_id, seller_id)
);
ALTER TABLE chat_conversations DISABLE ROW LEVEL SECURITY;

-- 6. Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_id       UUID REFERENCES app_users(id) ON DELETE CASCADE,
    message         TEXT,
    offer_amount    NUMERIC(12,2) DEFAULT NULL,
    offer_status    TEXT NOT NULL DEFAULT 'NONE' CHECK (offer_status IN ('NONE', 'PENDING', 'ACCEPTED', 'REJECTED')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

-- 7. Create visit_bookings table
CREATE TABLE IF NOT EXISTS visit_bookings (
    id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    listing_id     UUID REFERENCES listings(id) ON DELETE CASCADE,
    buyer_id       UUID REFERENCES app_users(id) ON DELETE CASCADE,
    seller_id      UUID REFERENCES app_users(id) ON DELETE CASCADE,
    preferred_date DATE NOT NULL,
    preferred_slot TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE visit_bookings DISABLE ROW LEVEL SECURITY;

-- 8. Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id                 UUID REFERENCES app_users(id) ON DELETE CASCADE,
    buyer_id                  UUID REFERENCES app_users(id) ON DELETE CASCADE,
    item_type                 TEXT NOT NULL CHECK (item_type IN ('PROPERTY', 'LISTING')),
    item_id                   UUID NOT NULL,
    transaction_type          TEXT NOT NULL CHECK (transaction_type IN ('RENT', 'BUY')),
    amount                    NUMERIC(12,2) NOT NULL,
    payment_gateway_order_id  TEXT,
    payment_id                TEXT,
    payment_status            TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED')),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

-- Seed listing categories if empty
INSERT INTO listing_categories (name, slug, icon) VALUES
('Apartments', 'apartments', 'BuildingOfficeIcon'),
('Houses & Villas', 'houses-villas', 'HomeIcon'),
('PG & Co-Living', 'pg-coliving', 'UserGroupIcon'),
('Commercial Properties', 'commercial', 'BriefcaseIcon'),
('Land & Plots', 'land-plots', 'MapIcon'),
('Furniture & Appliances', 'furniture-appliances', 'SparklesIcon'),
('Electronics', 'electronics', 'DevicePhoneMobileIcon')
ON CONFLICT (slug) DO NOTHING;
