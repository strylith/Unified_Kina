# Status Table Setup Guide

## What is the Status Table?

The `status_types` table is a **reference/lookup table** that centralizes all status definitions in your system. This makes it easier to:
- Standardize status values across tables
- Add new statuses without code changes
- Display user-friendly status names
- Maintain consistency

## Quick Setup

### Option 1: Full Setup (Recommended)

Run `migration-create-status-table.sql` in Supabase SQL Editor. This will:
1. Create the `status_types` table
2. Insert all predefined statuses for:
   - Bookings (pending, confirmed, cancelled, checked_in, checked_out, no_show)
   - Payments (unpaid, pending, paid, failed, refunded, processing, completed)
   - Rooms (available, occupied, maintenance, cleaning, reserved)
   - Emails (pending, sent, failed, bounced)
3. Set up security policies
4. Create a helpful view

### Option 2: Just Create Table (Manual Setup)

If you prefer to add statuses manually:

```sql 
-- Create status_types table
CREATE TABLE IF NOT EXISTS status_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL,
    status_value VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_status_types_unique 
ON status_types(category, status_value);

CREATE INDEX IF NOT EXISTS idx_status_types_category 
ON status_types(category, is_active, sort_order);
```

## Status Categories

### Booking Statuses
- `pending` - Pending confirmation
- `confirmed` - Confirmed
- `cancelled` - Cancelled
- `checked_in` - Guest checked in
- `checked_out` - Guest checked out
- `no_show` - Guest didn't arrive

### Payment Statuses
- `unpaid` - Not paid
- `pending` - Processing
- `paid` - Payment completed
- `failed` - Payment failed
- `refunded` - Refunded
- `processing` - Currently processing
- `completed` - Transaction completed

### Room Statuses
- `available` - Available for booking
- `occupied` - Currently occupied
- `maintenance` - Under maintenance
- `cleaning` - Being cleaned
- `reserved` - Reserved

### Email Statuses
- `pending` - Queued for sending
- `sent` - Sent successfully
- `failed` - Failed to send
- `bounced` - Email bounced

## How to Use

### Query All Statuses for a Category

```sql
SELECT * FROM status_types 
WHERE category = 'booking' 
AND is_active = true 
ORDER BY sort_order;
```

### Get Display Name for a Status

```sql
SELECT display_name 
FROM status_types 
WHERE category = 'booking' 
AND status_value = 'pending';
```

### Add a New Status

```sql
INSERT INTO status_types (category, status_value, display_name, description, sort_order)
VALUES ('booking', 'on_hold', 'On Hold', 'Booking is temporarily on hold', 7);
```

## Integration with Existing Tables

Your existing tables (`bookings`, `payments`, `rooms`, `email_logs`) can reference this table:

### Option A: Keep Current Structure (Recommended)
Keep using VARCHAR fields with CHECK constraints (current setup). Use status_types as reference only.

### Option B: Add Foreign Keys (Advanced)
If you want strict referential integrity:

```sql
-- Example: Link bookings.status to status_types
ALTER TABLE bookings 
ADD CONSTRAINT fk_booking_status 
FOREIGN KEY (status) 
REFERENCES status_types(status_value) 
WHERE category = 'booking';
```

## Benefits

1. **Centralized Management** - All statuses in one place
2. **Easy Updates** - Change display names without code changes
3. **Consistency** - Same status values across the system
4. **Flexibility** - Add new statuses dynamically
5. **User-Friendly** - Display names instead of raw values

## View Created

A view `status_lookup` is automatically created for easier queries:

```sql
SELECT * FROM status_lookup WHERE category = 'booking';
```

## Security

- **Read Access**: Everyone can view active statuses
- **Write Access**: Only admins can modify statuses
- Row Level Security (RLS) is enabled

## Troubleshooting

### "Table already exists" error?
- The migration uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times
- If you need to recreate, drop it first: `DROP TABLE IF EXISTS status_types CASCADE;`

### "Duplicate key" error on inserts?
- The migration uses `ON CONFLICT DO NOTHING`, so existing statuses won't cause errors
- Safe to run multiple times

### Want to modify existing statuses?
```sql
UPDATE status_types 
SET display_name = 'New Name', description = 'New Description'
WHERE category = 'booking' AND status_value = 'pending';
```

---

**Ready to use!** Run `migration-create-status-table.sql` in Supabase SQL Editor.



