-- ============================================
-- ⚡ QUICK SETUP - COPY & RUN THIS IN SUPABASE SQL EDITOR
-- ============================================
-- This will create everything you need!

-- Create kina schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS kina;

-- Set search path to kina schema
SET search_path TO kina, public;

-- Step 1: Create Tables
CREATE TABLE IF NOT EXISTS kina.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'staff')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS kina.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255) NOT NULL,
    guest_phone VARCHAR(50),
    room_type VARCHAR(50) NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    booking_time VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    guest_count INTEGER DEFAULT 1,
    extra_guest_charge DECIMAL(10, 2) DEFAULT 0,
    adults INTEGER DEFAULT 0,
    kids INTEGER DEFAULT 0,
    visit_time VARCHAR(20) CHECK (visit_time IN ('morning', 'night')),
    cottage VARCHAR(50) CHECK (cottage IN ('tropahan', 'barkads', 'family')),
    entrance_fee DECIMAL(10, 2) DEFAULT 0,
    cottage_fee DECIMAL(10, 2) DEFAULT 0,
    created_by UUID REFERENCES kina.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kina.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES kina.users(id),
    user_role VARCHAR(50),
    action VARCHAR(255) NOT NULL,
    details TEXT,
    table_name VARCHAR(100),
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    record_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kina.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kina.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_number VARCHAR(50) NOT NULL,
    room_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
    price DECIMAL(10, 2),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kina.password_reset_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Create Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON kina.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON kina.users(role);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON kina.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON kina.bookings(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON kina.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON kina.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON kina.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_otps_email ON kina.password_reset_otps(email);
CREATE INDEX IF NOT EXISTS idx_otps_expires ON kina.password_reset_otps(expires_at);

-- Step 3: Disable RLS (Row Level Security) for simplicity
ALTER TABLE kina.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE kina.bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE kina.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE kina.email_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE kina.rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE kina.password_reset_otps DISABLE ROW LEVEL SECURITY;

-- Step 4: Create Test Users
-- Admin user (password: password123)
INSERT INTO kina.users (email, password, full_name, role, is_active) 
VALUES (
    'admin@kinaresort.com',
    '$2a$10$rSBNp9OWL3HqJ8jKLJ2nJeCqJZK2sXnPZXfUrUOjKb8VpKbCZJQO2',
    'Admin User',
    'admin',
    true
)
ON CONFLICT (email) DO NOTHING;

-- Staff user (password: password123)
INSERT INTO kina.users (email, password, full_name, role, is_active) 
VALUES (
    'staff@kinaresort.com',
    '$2a$10$rSBNp9OWL3HqJ8jKLJ2nJeCqJZK2sXnPZXfUrUOjKb8VpKbCZJQO2',
    'Staff User',
    'staff',
    true
)
ON CONFLICT (email) DO NOTHING;

-- Step 5: Insert Sample Rooms (optional)
-- Add some test rooms so you can see the Rooms view working
INSERT INTO kina.rooms (room_number, room_type, status, price, description, is_active) 
VALUES 
    ('101', 'Standard', 'available', 650.00, 'Comfortable standard room with 2 beds, perfect for families', true),
    ('102', 'Standard', 'available', 650.00, 'Comfortable standard room with 2 beds, perfect for families', true),
    ('103', 'Standard', 'available', 650.00, 'Comfortable standard room with 2 beds, perfect for families', true),
    ('104', 'Standard', 'available', 650.00, 'Comfortable standard room with 2 beds, perfect for families', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- ✅ DONE! Your database is ready!
-- ============================================
-- 
-- Test credentials:
-- Admin: admin@kinaresort.com / password123
-- Staff: staff@kinaresort.com / password123
-- 
-- Now restart your server: npm run dev
-- ============================================
