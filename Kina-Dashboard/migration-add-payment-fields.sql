-- Migration: Add Payment Fields to Bookings Table
-- Run this in Supabase SQL Editor

-- Create kina schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS kina;

-- Set search path to kina schema
SET search_path TO kina, public;

-- Add payment-related columns to bookings table
ALTER TABLE kina.bookings 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid' 
  CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10, 2);

-- Create index for payment status lookups
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON kina.bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_transaction_id ON kina.bookings(payment_transaction_id);

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
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON kina.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON kina.payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON kina.payments(status);

-- Enable RLS on payments table
ALTER TABLE kina.payments ENABLE ROW LEVEL SECURITY;

-- Policy: Allow admins to view all payments
CREATE POLICY "Admins can view all payments" ON kina.payments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM kina.users 
            WHERE kina.users.id::text = current_setting('request.jwt.claim.sub', true)
            AND kina.users.role = 'admin'
        )
    );

-- Policy: Allow system to insert payments (via service role)
CREATE POLICY "Service role can insert payments" ON kina.payments
    FOR INSERT
    WITH CHECK (true);

-- Note: If you need a status_types reference table, run migration-create-status-table.sql

