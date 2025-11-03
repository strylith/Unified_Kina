# ❌ Database Tables Missing - Setup Required

## Error Message
```
Could not find the table 'public.users' in the schema cache
```

## Problem
Your Supabase database exists, but the required tables have not been created yet.

## Solution: Run the Database Schema

You need to create the tables in your Supabase project. Follow these steps:

### Step 1: Open Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project (the one matching your `.env` URL)
3. Click on **"SQL Editor"** in the left sidebar

### Step 2: Run the Database Schema

Copy the entire contents of **`setup-supabase.sql`** and paste it into the SQL Editor.

**OR** copy this simplified version:

```sql
-- Create all tables
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'staff')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS bookings (
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
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
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

CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
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

CREATE TABLE IF NOT EXISTS password_reset_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_otps_email ON password_reset_otps(email);
CREATE INDEX IF NOT EXISTS idx_otps_expires ON password_reset_otps(expires_at);

-- Disable RLS for simplicity (enable later for production)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_otps DISABLE ROW LEVEL SECURITY;
```

### Step 3: Click "Run"

Click the **"Run"** button in the SQL Editor.

You should see **"Success. No rows returned"** or **"Success. X rows returned"**.

### Step 4: Verify Tables Were Created

In Supabase Dashboard:
1. Click **"Table Editor"** in the left sidebar
2. You should see these tables:
   - ✅ users
   - ✅ bookings
   - ✅ audit_logs
   - ✅ email_logs
   - ✅ rooms
   - ✅ password_reset_otps

### Step 5: Create a Test User

Run this in the SQL Editor:

```sql
-- Create admin user (password: password123)
INSERT INTO users (email, password, full_name, role, is_active) 
VALUES (
    'admin@kinaresort.com',
    '$2a$10$rSBNp9OWL3HqJ8jKLJ2nJeCqJZK2sXnPZXfUrUOjKb8VpKbCZJQO2',
    'Admin User',
    'admin',
    true
);

-- Create staff user (password: password123)
INSERT INTO users (email, password, full_name, role, is_active) 
VALUES (
    'staff@kinaresort.com',
    '$2a$10$rSBNp9OWL3HqJ8jKLJ2nJeCqJZK2sXnPZXfUrUOjKb8VpKbCZJQO2',
    'Staff User',
    'staff',
    true
);
```

### Step 6: Test the Connection

Restart your server and test:

```bash
# The server should now start without errors
npm run dev
```

You should see:
```
✅ Supabase connection successful
```

### Step 7: Test Login

1. Go to http://localhost:5000/login.html
2. Select **Admin**
3. Login with:
   - Email: `admin@kinaresort.com`
   - Password: `password123`

## Quick Summary

**Problem:** Tables not created in Supabase
**Solution:** Run `setup-supabase.sql` in Supabase SQL Editor
**Time:** 2 minutes

## Need Help?

If you still see errors:
1. Check Supabase Dashboard → Table Editor → verify tables exist
2. Check server logs for specific error messages
3. Verify `.env` has correct `SUPABASE_URL` and `SUPABASE_KEY`
4. Make sure you selected the correct Supabase project

---

**After completing this setup, your application will be ready to use!** 🎉

