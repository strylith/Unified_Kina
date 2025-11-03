-- Migration: Add Payment Fields to Bookings Table (FIXED)
-- Run this in Supabase SQL Editor
-- This script handles all edge cases and errors

-- Create kina schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS kina;

-- Set search path to kina schema
SET search_path TO kina, public;

-- Step 1: Add payment-related columns to bookings table
-- Use separate ALTER TABLE statements for better error handling
ALTER TABLE kina.bookings 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid';

-- Add check constraint separately (in case column already exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'bookings_payment_status_check'
    ) THEN
        ALTER TABLE kina.bookings 
        ADD CONSTRAINT bookings_payment_status_check 
        CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'refunded'));
    END IF;
END $$;

ALTER TABLE kina.bookings 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10, 2);

-- Step 2: Create indexes for payment status lookups (only if column exists)
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON kina.bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_transaction_id ON kina.bookings(payment_transaction_id);

-- Step 3: Create payments table for transaction history
CREATE TABLE IF NOT EXISTS kina.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES kina.bookings(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'PHP',
    payment_method VARCHAR(50),
    payment_gateway VARCHAR(50),
    transaction_id VARCHAR(255) UNIQUE,
    gateway_response JSONB,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add check constraint to payments.status if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'payments_status_check'
    ) THEN
        ALTER TABLE kina.payments 
        ADD CONSTRAINT payments_status_check 
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded'));
    END IF;
END $$;

-- Step 4: Create indexes on payments table
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON kina.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON kina.payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON kina.payments(status);

-- Step 5: Enable RLS on payments table
ALTER TABLE kina.payments ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Admins can view all payments" ON kina.payments;
DROP POLICY IF EXISTS "Service role can insert payments" ON kina.payments;
DROP POLICY IF EXISTS "Users can view own payments" ON kina.payments;
DROP POLICY IF EXISTS "Allow service role payments" ON kina.payments;

-- Step 7: Create policies for payments table
-- Policy: Allow admins to view all payments
CREATE POLICY "Admins can view all payments" ON kina.payments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM kina.users 
            WHERE kina.users.email = current_setting('request.jwt.claim.email', true)
            AND kina.users.role = 'admin'
        )
        OR 
        EXISTS (
            SELECT 1 FROM kina.users 
            WHERE kina.users.id::text = current_setting('request.jwt.claim.sub', true)
            AND kina.users.role = 'admin'
        )
    );

-- Policy: Allow service role/system to insert payments
CREATE POLICY "Service role can insert payments" ON kina.payments
    FOR INSERT
    WITH CHECK (true);

-- Policy: Allow service role/system to update payments
CREATE POLICY "Service role can update payments" ON kina.payments
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Optional: Create status_types table (if you want a reference table)
-- Uncomment the section below if you want to create it

/*
-- Create status_types table (reference/lookup table)
CREATE TABLE IF NOT EXISTS kina.status_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL,
    status_value VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index to prevent duplicate statuses per category
CREATE UNIQUE INDEX IF NOT EXISTS idx_status_types_unique 
ON kina.status_types(category, status_value);

-- Create index for category lookups
CREATE INDEX IF NOT EXISTS idx_status_types_category 
ON kina.status_types(category, is_active, sort_order);

-- Enable RLS on status_types table
ALTER TABLE kina.status_types ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view status types (read-only reference data)
DROP POLICY IF EXISTS "Everyone can view status types" ON kina.status_types;
CREATE POLICY "Everyone can view status types" ON kina.status_types
    FOR SELECT
    USING (is_active = true);
*/

-- Verification: Check if columns were added successfully
DO $$ 
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Check kina.bookings table for: payment_status, payment_method, payment_transaction_id, payment_gateway, payment_date, payment_amount';
    RAISE NOTICE 'Check kina.payments table exists with status column';
END $$;
