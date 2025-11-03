-- Migration to add guest_count and extra_guest_charge fields to bookings table

-- Create kina schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS kina;

-- Set search path to kina schema
SET search_path TO kina, public;

-- Add guest_count column
ALTER TABLE kina.bookings 
ADD COLUMN IF NOT EXISTS guest_count INTEGER DEFAULT 1 NOT NULL;

-- Add extra_guest_charge column
ALTER TABLE kina.bookings 
ADD COLUMN IF NOT EXISTS extra_guest_charge DECIMAL(10, 2) DEFAULT 0 NOT NULL;

-- Add constraint to ensure guest_count is positive
ALTER TABLE kina.bookings 
ADD CONSTRAINT check_guest_count_positive 
CHECK (guest_count > 0);

-- Add constraint to ensure extra_guest_charge is non-negative
ALTER TABLE kina.bookings 
ADD CONSTRAINT check_extra_charge_non_negative 
CHECK (extra_guest_charge >= 0);

