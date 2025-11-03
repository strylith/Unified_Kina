-- ==========================================
-- TEST: Check your bookings table structure
-- ==========================================
-- Run this FIRST to see what columns exist

-- Create kina schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS kina;

-- Set search path to kina schema
SET search_path TO kina, public;

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'kina' AND table_name = 'bookings'
ORDER BY ordinal_position;

-- ==========================================
-- If the above shows missing columns, run this:
-- ==========================================

-- Drop and recreate bookings table with correct structure
DROP TABLE IF EXISTS kina.bookings CASCADE;

CREATE TABLE kina.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255) NOT NULL,
    guest_phone VARCHAR(50),
    room_type VARCHAR(50) NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_by UUID REFERENCES kina.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Disable RLS
ALTER TABLE kina.bookings DISABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bookings_status ON kina.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON kina.bookings(check_in, check_out);

-- Test insert
INSERT INTO kina.bookings (guest_name, guest_email, room_type, check_in, check_out, status)
VALUES ('Test Guest', 'test@example.com', 'standard', CURRENT_DATE, CURRENT_DATE + 1, 'pending')
RETURNING *;

SELECT 'Bookings table is ready!' as message;
