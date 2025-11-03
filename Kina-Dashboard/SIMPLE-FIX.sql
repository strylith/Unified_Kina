-- ==========================================
-- SIMPLE FIX - Run this in Supabase
-- ==========================================
-- Copy this entire code and paste in Supabase SQL Editor

-- Create kina schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS kina;

-- Set search path to kina schema
SET search_path TO kina, public;

-- First, let's see what columns your bookings table has
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'kina' AND table_name = 'bookings';

-- Disable RLS completely
ALTER TABLE kina.bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE kina.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE kina.audit_logs DISABLE ROW LEVEL SECURITY;

-- Now check if the bookings table has the right structure
-- The server expects these columns:
-- id, guest_name, guest_email, guest_phone, room_type, check_in, check_out, status, created_by, created_at, updated_at
