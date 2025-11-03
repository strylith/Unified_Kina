-- ============================================================================
-- COMPLETE MIGRATION: Payment Fields + Status Table
-- Run this entire script in Supabase SQL Editor
-- This includes both payment fields and status_types table
-- ============================================================================

-- Create kina schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS kina;

-- Set search path to kina schema
SET search_path TO kina, public;

-- ============================================================================
-- PART 1: Add Payment Fields to Bookings Table
-- ============================================================================

-- Add payment-related columns to bookings table
ALTER TABLE kina.bookings 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10, 2);

-- Add check constraint for payment_status (handle if constraint already exists)
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

-- Create indexes for payment status lookups
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON kina.bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_transaction_id ON kina.bookings(payment_transaction_id);

-- ============================================================================
-- PART 2: Create Payments Table
-- ============================================================================

-- Create payments table for transaction history
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

-- Add check constraint for payments.status
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

-- Create indexes on payments table
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON kina.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON kina.payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON kina.payments(status);

-- ============================================================================
-- PART 3: Set Up RLS Policies for Payments
-- ============================================================================

-- Enable RLS on payments table
ALTER TABLE kina.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Admins can view all payments" ON kina.payments;
DROP POLICY IF EXISTS "Service role can insert payments" ON kina.payments;
DROP POLICY IF EXISTS "Service role can update payments" ON kina.payments;
DROP POLICY IF EXISTS "Users can view own payments" ON kina.payments;
DROP POLICY IF EXISTS "Allow service role payments" ON kina.payments;

-- Policy: Allow admins to view all payments
CREATE POLICY "Admins can view all payments" ON kina.payments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM kina.users 
            WHERE (kina.users.email = current_setting('request.jwt.claim.email', true)
                   OR kina.users.id::text = current_setting('request.jwt.claim.sub', true))
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

-- ============================================================================
-- PART 4: Create Status Types Reference Table
-- ============================================================================

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

-- Insert Booking Statuses
INSERT INTO kina.status_types (category, status_value, display_name, description, sort_order) VALUES
('booking', 'pending', 'Pending', 'Booking is pending confirmation', 1),
('booking', 'confirmed', 'Confirmed', 'Booking has been confirmed', 2),
('booking', 'cancelled', 'Cancelled', 'Booking has been cancelled', 3),
('booking', 'checked_in', 'Checked In', 'Guest has checked in', 4),
('booking', 'checked_out', 'Checked Out', 'Guest has checked out', 5),
('booking', 'no_show', 'No Show', 'Guest did not arrive', 6)
ON CONFLICT (category, status_value) DO NOTHING;

-- Insert Payment Statuses
INSERT INTO kina.status_types (category, status_value, display_name, description, sort_order) VALUES
('payment', 'unpaid', 'Unpaid', 'Payment has not been made', 1),
('payment', 'pending', 'Pending', 'Payment is being processed', 2),
('payment', 'paid', 'Paid', 'Payment has been completed', 3),
('payment', 'failed', 'Failed', 'Payment processing failed', 4),
('payment', 'refunded', 'Refunded', 'Payment has been refunded', 5),
('payment', 'processing', 'Processing', 'Payment is currently being processed', 6),
('payment', 'completed', 'Completed', 'Payment transaction completed successfully', 7)
ON CONFLICT (category, status_value) DO NOTHING;

-- Insert Room Statuses
INSERT INTO kina.status_types (category, status_value, display_name, description, sort_order) VALUES
('room', 'available', 'Available', 'Room is available for booking', 1),
('room', 'occupied', 'Occupied', 'Room is currently occupied', 2),
('room', 'maintenance', 'Maintenance', 'Room is under maintenance', 3),
('room', 'cleaning', 'Cleaning', 'Room is being cleaned', 4),
('room', 'reserved', 'Reserved', 'Room is reserved for upcoming booking', 5)
ON CONFLICT (category, status_value) DO NOTHING;

-- Insert Email Statuses
INSERT INTO kina.status_types (category, status_value, display_name, description, sort_order) VALUES
('email', 'pending', 'Pending', 'Email is queued for sending', 1),
('email', 'sent', 'Sent', 'Email has been sent successfully', 2),
('email', 'failed', 'Failed', 'Email sending failed', 3),
('email', 'bounced', 'Bounced', 'Email bounced back', 4)
ON CONFLICT (category, status_value) DO NOTHING;

-- ============================================================================
-- PART 5: Set Up RLS Policies for Status Types
-- ============================================================================

-- Enable RLS on status_types table
ALTER TABLE kina.status_types ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Everyone can view status types" ON kina.status_types;
DROP POLICY IF EXISTS "Admins can modify status types" ON kina.status_types;

-- Policy: Everyone can view status types (read-only reference data)
CREATE POLICY "Everyone can view status types" ON kina.status_types
    FOR SELECT
    USING (is_active = true);

-- Policy: Only admins can modify status types
CREATE POLICY "Admins can modify status types" ON kina.status_types
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM kina.users 
            WHERE (kina.users.email = current_setting('request.jwt.claim.email', true)
                   OR kina.users.id::text = current_setting('request.jwt.claim.sub', true))
            AND kina.users.role = 'admin'
        )
    );

-- ============================================================================
-- PART 6: Create Helper View
-- ============================================================================

-- Create a view for easier status lookups
CREATE OR REPLACE VIEW kina.status_lookup AS
SELECT 
    category,
    status_value,
    display_name,
    description,
    sort_order
FROM kina.status_types
WHERE is_active = true
ORDER BY category, sort_order;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Final verification message
DO $$ 
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Created/Updated:';
    RAISE NOTICE '  - bookings table: Added payment fields';
    RAISE NOTICE '  - payments table: Created with status column';
    RAISE NOTICE '  - status_types table: Created with all statuses';
    RAISE NOTICE '  - status_lookup view: Created for easy queries';
    RAISE NOTICE '========================================';
END $$;



