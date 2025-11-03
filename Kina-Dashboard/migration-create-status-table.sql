-- Migration: Create Status Reference Table
-- Run this in Supabase SQL Editor
-- This table centralizes all status definitions for the system

-- Create kina schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS kina;

-- Set search path to kina schema
SET search_path TO kina, public;

-- Create status_types table (reference/lookup table)
CREATE TABLE IF NOT EXISTS kina.status_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL, -- 'booking', 'payment', 'room', 'email'
    status_value VARCHAR(50) NOT NULL, -- 'pending', 'confirmed', 'paid', etc.
    display_name VARCHAR(100) NOT NULL, -- Human-readable name
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

-- Enable RLS on status_types table
ALTER TABLE kina.status_types ENABLE ROW LEVEL SECURITY;

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
            WHERE kina.users.id::text = current_setting('request.jwt.claim.sub', true)
            AND kina.users.role = 'admin'
        )
    );

-- Optional: Create a view for easier status lookups
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
