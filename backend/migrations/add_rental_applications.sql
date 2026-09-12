-- ============================================================
-- Migration: Add Rental Applications Table
-- Run this in your Supabase SQL Editor to create table.
-- ============================================================

-- 1. Create rental_applications table
CREATE TABLE IF NOT EXISTS rental_applications (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                 UUID REFERENCES app_users(id) ON DELETE CASCADE,
    property_id             UUID REFERENCES properties(id) ON DELETE CASCADE,
    listing_id              UUID REFERENCES listings(id) ON DELETE SET NULL,
    owner_id                UUID REFERENCES app_users(id) ON DELETE CASCADE,
    full_name               TEXT NOT NULL,
    email                   TEXT NOT NULL,
    phone                   TEXT NOT NULL,
    address                 TEXT,
    date_of_birth           DATE,
    occupation              TEXT,
    monthly_income          NUMERIC(12,2),
    emergency_contact_name  TEXT,
    emergency_contact_phone TEXT,
    lease_start             DATE NOT NULL,
    lease_end               DATE,
    unit_number             TEXT,
    rent_amount             NUMERIC(10,2) NOT NULL,
    rent_due_day            INTEGER DEFAULT 1 CHECK (rent_due_day >= 1 AND rent_due_day <= 31),
    id_proof_file_name      TEXT NOT NULL,
    id_proof_file_url       TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'Pending' 
        CHECK (status IN ('Pending', 'Under Review', 'Approved', 'Rejected', 'Active', 'Completed', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVE', 'COMPLETED')),
    id_verification_status  TEXT NOT NULL DEFAULT 'Submitted' 
        CHECK (id_verification_status IN ('Not Submitted', 'Submitted', 'Under Review', 'Verified', 'Rejected')),
    rejection_reason        TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rental_applications DISABLE ROW LEVEL SECURITY;

-- 2. Add user_id column to tenants table if missing
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES app_users(id) ON DELETE SET NULL;

-- 3. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_rental_apps_user ON rental_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_rental_apps_owner ON rental_applications(owner_id);
CREATE INDEX IF NOT EXISTS idx_rental_apps_property ON rental_applications(property_id);
CREATE INDEX IF NOT EXISTS idx_rental_apps_status ON rental_applications(status);
CREATE INDEX IF NOT EXISTS idx_tenants_user ON tenants(user_id);
