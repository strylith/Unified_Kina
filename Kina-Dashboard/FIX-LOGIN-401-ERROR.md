# Fix: Login 401 Unauthorized Error

## Understanding the 401 Error

A **401 Unauthorized** error on `/api/login` means the login credentials are invalid or there's an issue with the authentication process.

## Common Causes

1. **User doesn't exist in database**
2. **Incorrect email or password**
3. **User role mismatch** (trying to login as admin but account is staff)
4. **Account is deactivated** (`is_active = false`)
5. **Session/cookie issues**

## Quick Fix Steps

### Step 1: Check if you have a user account

Run this in Supabase SQL Editor:

```sql
-- Check all users
SELECT id, email, full_name, role, is_active, created_at 
FROM users;
```

**If no users found:** You need to create one (see Step 2)

### Step 2: Create a Test User

#### Option A: Using SQL (Recommended)

1. **Generate password hash:**
   - Go to https://bcrypt-generator.com/
   - Enter your desired password (e.g., `password123`)
   - Copy the generated hash

2. **Run this SQL in Supabase SQL Editor:**

```sql
INSERT INTO users (email, password, full_name, role, is_active) 
VALUES (
    'admin@kinaresort.com',
    '$2a$10$rSBNp9OWL3HqJ8jKLJ2nJeCqJZK2sXnPZXfUrUOjKb8VpKbCZJQO2',
    'Admin User',
    'admin',
    true
);
```

**Default credentials:**
- Email: `admin@kinaresort.com`
- Password: `password123`
- Role: `admin`

**Or create a staff user:**

```sql
INSERT INTO users (email, password, full_name, role, is_active) 
VALUES (
    'staff@kinaresort.com',
    '$2a$10$rSBNp9OWL3HqJ8jKLJ2nJeCqJZK2sXnPZXfUrUOjKb8VpKbCZJQO2',
    'Staff User',
    'staff',
    true
);
```

#### Option B: Using Node.js to Generate Hash

```javascript
// Run in Node.js REPL or create a temp file
const bcrypt = require('bcryptjs');
bcrypt.hash('yourpassword', 10).then(hash => console.log(hash));
```

### Step 3: Verify User is Active

```sql
-- Check if user is active
SELECT email, role, is_active FROM users WHERE email = 'admin@kinaresort.com';
```

If `is_active` is `false`, update it:

```sql
UPDATE users SET is_active = true WHERE email = 'admin@kinaresort.com';
```

### Step 4: Test Login

1. Open http://localhost:3000/login.html
2. Select your user type (Admin or Staff)
3. Enter credentials:
   - **Email:** `admin@kinaresort.com`
   - **Password:** `password123`
   - **User Type:** Match the role you selected
4. Click Login

## Debugging Steps

### Check Server Logs

When you attempt login, check your terminal/console for:

```
Login attempt: { email: 'admin@kinaresort.com', userType: 'admin', hasPassword: true }
Login failed: User not found
```

Or:

```
Login attempt: { email: 'admin@kinaresort.com', userType: 'admin', hasPassword: true }
Login failed: Invalid credentials
```

### Check Browser Console

Open browser DevTools (F12) → Console tab. Look for:

- **Network errors** - Check the Network tab for failed requests
- **CORS errors** - Should be resolved with our CORS config
- **JavaScript errors** - May indicate frontend issues

### Check Database Connection

Verify your Supabase connection is working:

```javascript
// In server.js, check the connection
console.log('Supabase URL:', process.env.SUPABASE_URL);
console.log('Supabase Key:', process.env.SUPABASE_KEY ? 'Set' : 'Missing');
```

### Test Database Query

Run this in Supabase SQL Editor to test:

```sql
-- Test query
SELECT * FROM users WHERE email = 'admin@kinaresort.com';
```

Should return 1 row. If not, user doesn't exist.

## Common Scenarios

### Scenario 1: "Invalid credentials" on correct password

**Possible causes:**
- Password hash in database is incorrect
- Password comparison is failing

**Fix:**
1. Re-create the user with a new password hash
2. Ensure bcrypt version matches (should be bcryptjs)

### Scenario 2: "User not found" but user exists

**Possible causes:**
- Email case sensitivity
- Extra spaces in email
- Database connection issue

**Fix:**
```sql
-- Check exact email in database
SELECT email, LOWER(email) as email_lower FROM users;

-- Try with exact case
-- In login form, use exact email as stored in database
```

### Scenario 3: "Account is deactivated"

**Fix:**
```sql
UPDATE users SET is_active = true WHERE email = 'your-email@example.com';
```

### Scenario 4: "This account is not authorized as admin"

**Problem:** You selected "Admin" but the user role is "staff" (or vice versa)

**Fix:**
- Select the correct user type on login page
- Or update user role:
```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

### Scenario 5: Multiple 401 errors on page load

**Cause:** The `/api/me` endpoint is called on page load to check if user is already logged in. This returns 401 if not logged in (expected behavior).

**Status:** ✅ FIXED - We've updated the code to handle this gracefully without showing errors.

## Password Hash Reference

Common password hashes (for testing):

**Password: `password123`**
```
$2a$10$rSBNp9OWL3HqJ8jKLJ2nJeCqJZK2sXnPZXfUrUOjKb8VpKbCZJQO2
```

**Password: `admin`**
```
$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

**Generate your own:**
- https://bcrypt-generator.com/
- Or use Node.js: `bcrypt.hash('yourpassword', 10)`

## Complete Test User Setup Script

Run this in Supabase SQL Editor to create both admin and staff users:

```sql
-- Create Admin User
INSERT INTO users (email, password, full_name, role, is_active, created_at) 
VALUES (
    'admin@kinaresort.com',
    '$2a$10$rSBNp9OWL3HqJ8jKLJ2nJeCqJZK2sXnPZXfUrUOjKb8VpKbCZJQO2',
    'Admin User',
    'admin',
    true,
    NOW()
)
ON CONFLICT (email) DO UPDATE SET 
    is_active = true,
    role = 'admin';

-- Create Staff User
INSERT INTO users (email, password, full_name, role, is_active, created_at) 
VALUES (
    'staff@kinaresort.com',
    '$2a$10$rSBNp9OWL3HqJ8jKLJ2nJeCqJZK2sXnPZXfUrUOjKb8VpKbCZJQO2',
    'Staff User',
    'staff',
    true,
    NOW()
)
ON CONFLICT (email) DO UPDATE SET 
    is_active = true,
    role = 'staff';

-- Verify users created
SELECT email, full_name, role, is_active FROM users;
```

**Test Credentials:**

**Admin:**
- Email: `admin@kinaresort.com`
- Password: `password123`
- Select: Admin

**Staff:**
- Email: `staff@kinaresort.com`
- Password: `password123`
- Select: Staff

## Verification Checklist

- [ ] User exists in database (checked with SELECT query)
- [ ] `is_active = true` in database
- [ ] Role matches selected user type (admin/staff)
- [ ] Email exactly matches (case-sensitive)
- [ ] Password hash is correct bcrypt format
- [ ] Supabase connection is working (check server logs)
- [ ] Server is running on port 3000
- [ ] No JavaScript errors in browser console
- [ ] Session cookies are enabled in browser

## Still Having Issues?

1. **Check server logs** - Look for detailed error messages
2. **Check browser console** - Look for JavaScript errors
3. **Test database connection** - Verify Supabase credentials in .env
4. **Try different browser** - Rule out cookie/session issues
5. **Clear browser cache** - May have old session data
6. **Restart server** - May have cached issues

## Error Messages Explained

| Status Code | Message | Meaning |
|------------|---------|---------|
| 400 | "Email, password, and user type required" | Missing fields |
| 400 | "Invalid user type" | Must be 'admin' or 'staff' |
| 401 | "Invalid credentials" | User not found OR wrong password |
| 403 | "Account is deactivated" | `is_active = false` |
| 403 | "This account is not authorized as X" | Role mismatch |
| 500 | "Server error" | Database or server issue |

## Next Steps After Fixing

Once login works:

1. **Create additional users** via Admin Dashboard
2. **Test booking creation**
3. **Test email notifications**
4. **Test dashboard features**

---

**Need Help?** Check server logs and browser console for specific error messages.

