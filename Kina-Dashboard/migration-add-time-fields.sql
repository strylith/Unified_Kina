-- Add start_time and end_time fields to bookings table

-- Create kina schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS kina;

-- Set search path to kina schema
SET search_path TO kina, public;

ALTER TABLE kina.bookings
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME;

-- Add comments for documentation
COMMENT ON COLUMN kina.bookings.start_time IS 'Start time for the booking';
COMMENT ON COLUMN kina.bookings.end_time IS 'End time for the booking';

