# 📋 How the Bookings View Works

## Overview
The **Bookings View** is where you manage all reservations and see real-time room availability. It's your central hub for handling guest bookings.

---

## 🎯 Main Features

### 1. **View All Bookings**
   - See all reservations in one table
   - Filter by status: All, Pending, Confirmed, Cancelled
   - View guest details, room types, dates, and booking status

### 2. **Add New Booking**
   - Click **"Add Booking"** button
   - Fill in guest information
   - **Automatic Room Availability Check:**
     - Select check-in and check-out dates
     - System automatically checks which rooms are available
     - Room Type dropdown updates to show:
       - `Standard (3 of 4 available)` - 3 rooms free, 4 total
       - `Standard (Fully Booked - 4 rooms)` - All 4 booked
     - Only shows room types that have availability

### 3. **Real-Time Availability**
   - When you change check-in/check-out dates:
     - System queries `/api/rooms/availability`
     - Checks existing bookings for those dates
     - Calculates how many rooms are free
     - Updates dropdown instantly

### 4. **Manage Existing Bookings**
   - **View** - See full booking details
   - **Edit** - Modify booking information
   - **Approve** - Change status from Pending to Confirmed
   - **Delete** - Remove booking (if needed)

---

## 🔄 How Availability Checking Works

### Step-by-Step Process:

1. **You Select Dates**
   ```
   Check-in: January 15, 2024
   Check-out: January 18, 2024
   ```

2. **System Queries Database**
   - Gets all rooms from database
   - Gets all bookings with overlapping dates
   - Calculates conflicts

3. **Availability Calculation**
   ```javascript
   For each room type:
   - Total rooms = Count from database
   - Occupied rooms = Count bookings on those dates
   - Available = Total - Occupied
   ```

4. **Dropdown Updates Automatically**
   - Shows: "Standard (2 of 4 available)"
   - Shows: "Deluxe (Fully Booked - 3 rooms)"
   - Disables fully booked options

---

## 📊 Booking Table Columns

| Column | Description |
|--------|-------------|
| **Guest Name** | Customer's full name |
| **Contact** | Email and phone number |
| **Room Type** | Standard, Deluxe, Suite, etc. |
| **Guests** | Number of guests (with extra charges if any) |
| **Check-in** | Arrival date |
| **Check-out** | Departure date |
| **Status** | Pending, Confirmed, or Cancelled |
| **Actions** | View, Edit, Approve, Delete buttons |

---

## 🎨 Status Colors

- **Pending** (Yellow) - New booking, waiting for confirmation
- **Confirmed** (Green) - Approved and confirmed booking
- **Cancelled** (Red) - Cancelled reservation

---

## 📝 Creating a Booking - Walkthrough

### Step 1: Open Booking Form
1. Click **"Add Booking"** button (top right of Bookings view)
2. Modal window opens with booking form

### Step 2: Enter Guest Information
- Guest Name
- Guest Email
- Guest Phone
- Number of Adults/Kids

### Step 3: Select Dates
- **Check-in Date** - Guest arrival
- **Check-out Date** - Guest departure
- **Room Type dropdown updates automatically** ✅

### Step 4: Choose Room Type
- Dropdown shows available rooms
- Example: `Standard (3 of 4 available)`
- Fully booked options are disabled

### Step 5: Additional Details
- Visit time (Morning/Night)
- Cottage type (if applicable)
- Booking time
- Status (Pending/Confirmed)

### Step 6: Submit
- Click **"Create Booking"**
- System creates booking in database
- Table refreshes to show new booking

---

## 🔍 How to See Room Availability

### Method 1: Create New Booking
1. Go to Bookings view
2. Click "Add Booking"
3. Select dates
4. Room Type dropdown shows availability

### Method 2: Edit Existing Booking
1. Find booking in table
2. Click "Edit" button
3. Change dates to see availability for new dates

### Method 3: View All Bookings
1. Bookings table shows all reservations
2. You can see which dates are booked
3. Filter by status to see confirmed vs pending

---

## 💡 Pro Tips

1. **Check Availability First**
   - Always check availability before confirming bookings
   - System prevents double-booking automatically

2. **Use Filters**
   - Filter by status to see pending bookings
   - Filter to see confirmed bookings only

3. **View Details**
   - Click "View" to see full booking information
   - Includes all charges, guest count, etc.

4. **Approve Quickly**
   - Pending bookings need approval
   - Click "Approve" to confirm them

5. **Edit When Needed**
   - Change dates if guest requests modification
   - System recalculates availability

---

## 🔧 Technical Details

### API Endpoints Used:
- `/api/bookings` - Get all bookings
- `/api/rooms/availability?check_in=...&check_out=...` - Get availability
- `/api/bookings` (POST) - Create new booking
- `/api/bookings/:id` (PUT) - Update booking
- `/api/bookings/:id` (DELETE) - Delete booking

### Automatic Updates:
- Room availability updates when dates change
- No manual refresh needed
- Real-time calculation based on existing bookings

---

## ❓ Common Questions

**Q: Can I see all rooms at once?**
A: Currently, room availability is shown in the booking form dropdown. The Rooms view shows a placeholder message.

**Q: What if dates overlap?**
A: System counts how many bookings exist for those dates and subtracts from total rooms.

**Q: Can I book the same room twice?**
A: No, the system prevents this by checking existing bookings for overlapping dates.

**Q: How does it know which rooms are available?**
A: It checks:
- Total rooms in database
- Bookings on the selected dates
- Room status (available/occupied/maintenance)

---

## ✅ Summary

The **Bookings View** is your complete reservation management system:
- ✅ View all bookings
- ✅ Create new bookings with automatic availability checking
- ✅ Edit existing bookings
- ✅ See real-time room availability
- ✅ Filter and manage booking status
- ✅ Full booking details and actions

**You manage rooms through bookings - each booking represents a room reservation!**

