-- ============================================
-- Migration: Add room_types table and update rooms
-- ============================================
-- Run this in Supabase SQL Editor to add room management features

-- Create kina schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS kina;

-- Set search path to kina schema
SET search_path TO kina, public;

-- Step 1: Create room_types table
CREATE TABLE IF NOT EXISTS kina.room_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    base_price DECIMAL(10, 2) NOT NULL,
    description TEXT,
    max_occupancy INTEGER,
    amenities JSONB,
    images JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Add room_type_id column to rooms table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'kina' AND table_name='rooms' AND column_name='room_type_id'
    ) THEN
        ALTER TABLE kina.rooms ADD COLUMN room_type_id UUID REFERENCES kina.room_types(id);
    END IF;
    
    -- Add floor column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'kina' AND table_name='rooms' AND column_name='floor'
    ) THEN
        ALTER TABLE kina.rooms ADD COLUMN floor INTEGER;
    END IF;
    
    -- Add maintenance_notes column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'kina' AND table_name='rooms' AND column_name='maintenance_notes'
    ) THEN
        ALTER TABLE kina.rooms ADD COLUMN maintenance_notes TEXT;
    END IF;
    
    -- Add last_cleaned column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'kina' AND table_name='rooms' AND column_name='last_cleaned'
    ) THEN
        ALTER TABLE kina.rooms ADD COLUMN last_cleaned DATE;
    END IF;
END $$;

-- Step 3: Create index for room_type_id
CREATE INDEX IF NOT EXISTS idx_rooms_room_type_id ON kina.rooms(room_type_id);

-- Step 4: Insert "Standard" room type
INSERT INTO kina.room_types (name, base_price, description, max_occupancy, is_active)
VALUES 
    ('Standard', 650.00, 'Comfortable standard room with 2 beds, perfect for families', 4, true)
ON CONFLICT DO NOTHING;

-- Step 5: Update existing rooms to link to room type
-- This assumes existing rooms have room_type = 'Standard' or similar
UPDATE kina.rooms SET room_type_id = (
    SELECT id FROM kina.room_types WHERE name = 'Standard' LIMIT 1
) WHERE room_type_id IS NULL AND room_type = 'standard';

-- ============================================
-- Done! Your room management is now enabled
-- ============================================
