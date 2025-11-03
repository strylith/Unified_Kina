-- Migration: Add time fields to booking_items table for rooms and cottages
-- Run this SQL in your Supabase SQL Editor

-- Add time fields for booking_items table
ALTER TABLE public.booking_items
ADD COLUMN IF NOT EXISTS check_in_time TIME,
ADD COLUMN IF NOT EXISTS check_out_time TIME,
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME,
ADD COLUMN IF NOT EXISTS usage_date DATE;

-- Add comments for documentation
COMMENT ON COLUMN public.booking_items.check_in_time IS 'Check-in time for rooms (e.g., 14:00 for 2:00 PM)';
COMMENT ON COLUMN public.booking_items.check_out_time IS 'Check-out time for rooms (e.g., 12:00 for 12:00 PM)';
COMMENT ON COLUMN public.booking_items.start_time IS 'Start time for cottages and function halls (e.g., 09:00 for 9:00 AM)';
COMMENT ON COLUMN public.booking_items.end_time IS 'End time for cottages and function halls (e.g., 17:00 for 5:00 PM)';
COMMENT ON COLUMN public.booking_items.usage_date IS 'Specific usage date for cottages and function halls (single-day bookings)';

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'booking_items'
AND column_name IN ('check_in_time', 'check_out_time', 'start_time', 'end_time', 'usage_date')
ORDER BY ordinal_position;

