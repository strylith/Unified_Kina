-- Add entrance and cottage fields to bookings table

-- Create kina schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS kina;

-- Set search path to kina schema
SET search_path TO kina, public;

ALTER TABLE kina.bookings
ADD COLUMN IF NOT EXISTS adults INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS kids INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS visit_time VARCHAR(50),
ADD COLUMN IF NOT EXISTS cottage VARCHAR(50),
ADD COLUMN IF NOT EXISTS entrance_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cottage_fee NUMERIC DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN kina.bookings.adults IS 'Number of adult guests';
COMMENT ON COLUMN kina.bookings.kids IS 'Number of kids (1 year old is free)';
COMMENT ON COLUMN kina.bookings.visit_time IS 'Visit time: morning or night';
COMMENT ON COLUMN kina.bookings.cottage IS 'Cottage type: tropahan, barkads, family';
COMMENT ON COLUMN kina.bookings.entrance_fee IS 'Calculated entrance fee based on adults and kids';
COMMENT ON COLUMN kina.bookings.cottage_fee IS 'Cottage fee based on selected cottage type';

