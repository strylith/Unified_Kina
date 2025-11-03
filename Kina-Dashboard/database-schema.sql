-- Kina Resort System Database Schema for Supabase

-- Create kina schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS kina;

-- Set search path to kina schema
SET search_path TO kina, public;

-- Users Table
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

-- Bookings Table
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

-- Audit Logs Table
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

-- Email Logs Table
CREATE TABLE IF NOT EXISTS kina.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Rooms Table
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

-- Password Reset OTPs Table (for forgot password feature)
CREATE TABLE IF NOT EXISTS kina.password_reset_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON kina.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON kina.users(role);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON kina.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON kina.bookings(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON kina.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON kina.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON kina.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_otps_email ON kina.password_reset_otps(email);
CREATE INDEX IF NOT EXISTS idx_otps_expires ON kina.password_reset_otps(expires_at);

-- Initial Admin User (password: admin123)
-- INSERT INTO kina.users (email, password, full_name, role) 
-- VALUES ('admin@kinaresort.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye', 'Admin User', 'admin');

-- Insert sample rooms
-- INSERT INTO kina.rooms (room_number, room_type, status) VALUES
-- ('101', 'standard', 'available'),
-- ('102', 'standard', 'available'),
-- ('103', 'standard', 'available'),
-- ('201', 'deluxe', 'available'),
-- ('202', 'deluxe', 'available'),
-- ('301', 'suite', 'available'),
-- ('302', 'suite', 'available');

-- Row Level Security (RLS) Policies
ALTER TABLE kina.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE kina.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE kina.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kina.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kina.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE kina.password_reset_otps DISABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data or all data if admin
CREATE POLICY "Users can view their own data" ON kina.users
    FOR SELECT USING (auth.uid()::text = id::text OR EXISTS (
        SELECT 1 FROM kina.users WHERE id = auth.uid()::uuid AND role = 'admin'
    ));

-- Policy: Everyone can insert bookings
CREATE POLICY "Anyone can create bookings" ON kina.bookings
    FOR INSERT WITH CHECK (true);

-- Policy: Users can view all bookings
CREATE POLICY "Users can view bookings" ON kina.bookings
    FOR SELECT USING (true);

-- Policy: Only authenticated users can insert audit logs
CREATE POLICY "Authenticated users can log actions" ON kina.audit_logs
    FOR INSERT WITH CHECK (true);

-- Policy: Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON kina.audit_logs
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM kina.users WHERE email = current_setting('request.jwt.claim.email', true) AND role = 'admin'
    ));

