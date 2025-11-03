# 🏨 Room Management Setup Guide

## ✅ What Has Been Updated

The code has been updated to work with your actual database schema:
- `rooms` table with `room_type_id`, `status` enum, `floor`, etc.
- `room_types` table with `base_price`, `name`, `description`, `max_occupancy`, etc.
- Mapping between `bookings.room_type` (string) and `room_types.name`

---

## 📋 Step-by-Step Setup Instructions

### Step 1: Verify Your Database Tables

Make sure these tables exist in your Supabase database:

1. **`rooms` table** ✅ (You have this)
   - Must have columns: `id`, `room_number`, `room_type_id`, `status`, `floor`, etc.
   
2. **`room_types` table** ✅ (You have this)
   - Must have columns: `id`, `name`, `base_price`, `description`, `max_occupancy`, `amenities`, `images`, `is_active`

3. **`bookings` table** ✅ (Should already exist)
   - Must have `room_type` column (as TEXT/VARCHAR string)

---

### Step 2: Verify or Insert Room Type

Go to Supabase SQL Editor and check if "Standard" room type exists:

```sql
-- Check existing room types
SELECT * FROM room_types WHERE name = 'Standard';
```

If it doesn't exist, insert it:

```sql
-- Insert Standard room type
INSERT INTO room_types (name, base_price, description, max_occupancy, is_active)
VALUES 
  ('Standard', 650.00, 'Comfortable standard room with 2 beds, perfect for families', 4, true);
```

**Note:** Adjust the price and description to match your Standard room pricing and details.

---

### Step 3: Insert Standard Rooms (if not done)

```sql
-- Insert Standard rooms (adjust room numbers and floor as needed)
-- Example: Insert 4 Standard rooms
INSERT INTO rooms (room_number, room_type_id, floor, status)
SELECT 
  '101', id, 1, 'available'
FROM room_types WHERE name = 'Standard' LIMIT 1;

INSERT INTO rooms (room_number, room_type_id, floor, status)
SELECT 
  '102', id, 1, 'available'
FROM room_types WHERE name = 'Standard' LIMIT 1;

INSERT INTO rooms (room_number, room_type_id, floor, status)
SELECT 
  '103', id, 1, 'available'
FROM room_types WHERE name = 'Standard' LIMIT 1;

INSERT INTO rooms (room_number, room_type_id, floor, status)
SELECT 
  '104', id, 1, 'available'
FROM room_types WHERE name = 'Standard' LIMIT 1;

-- Add more Standard rooms as needed (105, 106, etc.)
```

**Note:** Adjust the number of rooms and room numbers based on how many Standard rooms you actually have.

---

### Step 4: Verify Bookings Table

Ensure your `bookings` table has `room_type` as a TEXT/VARCHAR column that stores "Standard".

**Important:** The `bookings.room_type` value must be "Standard" (case-insensitive matching).

Check existing bookings:
```sql
SELECT DISTINCT room_type FROM bookings;
```

All bookings should have `room_type = 'Standard'`. If not, update them:
```sql
-- Ensure all bookings use 'Standard'
UPDATE bookings SET room_type = 'Standard' WHERE LOWER(room_type) IN ('standard', 'std', 'room');
```

---

### Step 5: Restart Your Server

1. **Stop the server** (Ctrl+C in the terminal where it's running)
2. **Start it again:**
   ```bash
   npm run dev
   ```
   Or:
   ```bash
   npm start
   ```

---

### Step 6: Test the Features

#### Test Room Management View:
1. Open: `http://localhost:3000`
2. Login as Admin
3. Click "Rooms" in the navigation
4. You should see:
   - All rooms grouped by type
   - Availability status (Available/Occupied)
   - Room numbers, floors, prices, descriptions
   - Count of available vs total rooms

#### Test Booking Form:
1. Click "Bookings" → "Add Booking"
2. Select check-in and check-out dates
3. The "Room Type" dropdown should:
   - Show "Standard (X of Y available)" where X = available, Y = total Standard rooms
   - Show "Standard (Fully Booked - Y rooms)" if all Standard rooms are booked
   - Update automatically when you change dates

---

## 🔍 Troubleshooting

### Problem: "No rooms found" in Room Management

**Solution:**
1. Check if rooms exist: `SELECT * FROM rooms;`
2. Check if rooms have `status = 'available'`
3. Check if rooms have valid `room_type_id` that exists in `room_types` table

### Problem: Room Type dropdown shows no availability

**Solution:**
1. Make sure `bookings.room_type` matches `room_types.name` (case-insensitive)
2. Check the browser console (F12) for errors
3. Verify dates are selected in check-in/check-out fields

### Problem: Rooms show as "Occupied" when they're not

**Solution:**
1. Check bookings table: `SELECT * FROM bookings WHERE status IN ('confirmed', 'pending');`
2. Verify booking dates overlap with today
3. Check if bookings have correct `room_type` values

---

## ✅ Verification Checklist

- [ ] `room_types` table has data
- [ ] `rooms` table has data with valid `room_type_id` references
- [ ] Rooms have `status = 'available'`
- [ ] `bookings.room_type` values match `room_types.name` (case-insensitive)
- [ ] Server restarted after code changes
- [ ] No errors in browser console (F12)
- [ ] Room Management view shows rooms
- [ ] Booking form shows availability when dates are selected

---

## 🎯 Expected Results

### Room Management View:
- Shows all Standard rooms from database
- Grouped under "Standard Rooms" category
- Each room shows:
  - Room number
  - Floor (if set)
  - Price (from room_types.base_price)
  - Description (from room_types.description)
  - Max occupancy
  - Availability status (green = available, red = occupied)
  - Maintenance notes (if any)

### Booking Form:
- Room Type dropdown shows only "Standard" with:
  - "Standard (X of Y available)" when rooms are available (e.g., "Standard (3 of 4 available)")
  - "Standard (Fully Booked - Y rooms)" when all rooms are booked (e.g., "Standard (Fully Booked - 4 rooms)")
  - Updates in real-time when dates change

---

## 📞 Need Help?

If something doesn't work:

1. **Check Server Console** - Look for error messages
2. **Check Browser Console** (F12) - Look for JavaScript errors
3. **Check Database** - Verify tables and data exist
4. **Share Error Messages** - Copy the exact error message

---

**You're all set!** The system should now show real rooms from your database and update availability dynamically! 🎉

