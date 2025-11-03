const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { parse } = require('json2csv');
const { Paymongo } = require('paymongo');
require('dotenv').config();

const app = express();
const PORT = process.env.ADMIN_PORT || process.env.PORT || 3000;
const HOST = process.env.SERVER_HOST || '0.0.0.0';

// Initialize Supabase client
// Configured to use 'kina' schema to match Guest system structure
// Using SERVICE_ROLE_KEY for admin operations (full database access)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'kina_v2'
  }
});

// Initialize PayMongo client (if API key is provided)
let paymongo = null;
if (process.env.PAYMONGO_SECRET_KEY) {
  try {
    paymongo = new Paymongo(process.env.PAYMONGO_SECRET_KEY);
    console.log('PayMongo initialized successfully');
  } catch (error) {
    console.error('PayMongo initialization error:', error);
  }
}

// HTTPS Enforcement (Production only)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Check if request is secure (HTTPS) or forwarded from HTTPS proxy
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });
}

// Middleware
// Configure CORS based on environment
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*'
    : true, // In development, allow all origins (needed for localhost with credentials)
  credentials: true, // Required for cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie']
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'kina.sid', // Explicit session cookie name
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // Required for modern browsers
  }
}));

// Configure Nodemailer for email notifications
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

// Email utility functions
async function sendEmail({ to, subject, text, html }) {
  try {
    const mailOptions = {
      from: `"Kina Resort" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    // Log email in database
    await supabase
      .from('email_logs')
      .insert({
        recipient: to,
        subject,
        status: 'sent',
        sent_at: new Date().toISOString()
      });
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email error:', error);
    
    // Log failed email
    await supabase
      .from('email_logs')
      .insert({
        recipient: to,
        subject,
        status: 'failed',
        error_message: error.message,
        sent_at: new Date().toISOString()
      });
    
    return { success: false, error: error.message };
  }
}

// Payment link signing helpers
function generatePaymentToken(bookingId, email) {
  const secret = process.env.SESSION_SECRET || 'kina-default-secret';
  const payload = `${bookingId}.${email}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function buildPaymentLink(req, booking) {
  const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const token = generatePaymentToken(booking.id, booking.guest_email);
  return `${baseUrl}/pay/${booking.id}?t=${token}`;
}

function verifyPaymentToken(bookingId, email, token) {
  const expected = generatePaymentToken(bookingId, email);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token || ''));
}

// Log audit trail
async function logAudit({ userId, action, details, userRole, req }) {
  try {
    // Determine table name from action
    let tableName = 'users';
    if (action.includes('booking')) {
      tableName = 'bookings';
    } else if (action.includes('user')) {
      tableName = 'users';
    }
    
    const auditData = {
        user_id: userId,
        action,
      table_name: tableName,
        created_at: new Date().toISOString()
    };
    
    // Add optional fields if available
    if (details) {
      auditData.new_values = { details, role: userRole };
    }
    
    if (req) {
      // Extract IP address and convert to INET format if needed
      const ipAddr = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      // Remove '::ffff:' prefix if present (IPv4-mapped IPv6)
      const cleanIp = ipAddr ? ipAddr.replace(/^::ffff:/, '') : null;
      if (cleanIp) {
        auditData.ip_address = cleanIp;
      }
      auditData.user_agent = req.get('user-agent');
    }
    
    // Extract record_id from details if present (e.g., "Created booking <id>")
    const idMatch = details.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
    if (idMatch) {
      auditData.record_id = idMatch[0];
    }
    
    const { data, error } = await supabase
      .from('audit_logs')
      .insert(auditData)
      .select();
    
    if (error) {
      console.error('Audit logging error:', error.message, error.details || '');
    } else {
      console.log('Audit log created:', action, 'by user:', userId);
    }
  } catch (error) {
    console.error('Audit logging exception:', error.message, error);
  }
  
  // Always return, don't block the main request
  return;
}

// Authentication middleware
function requireAuth(req, res, next) {
  // Debug: Log session info in development
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Auth Debug] Session ID:', req.sessionID);
    console.log('[Auth Debug] Session user:', req.session.user ? 'exists' : 'missing');
    console.log('[Auth Debug] Cookies:', req.headers.cookie ? 'present' : 'missing');
  }
  
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized', details: 'No session found. Please login.' });
  }
  next();
}

// Check role middleware
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.session.user || !allowedRoles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// ==================== AUTHENTICATION ROUTES ====================

// Register new user
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, full_name, role = 'staff' } = req.body;
    
    // Validate inputs
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user into database
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email,
        password: hashedPassword,
        full_name,
        role: role === 'admin' ? 'admin' : 'staff',
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      return res.status(500).json({ error: 'Registration failed' });
    }
    
    // Log audit
    await logAudit({
      userId: user.id,
      action: 'user_register',
      details: `New ${role} user registered`,
      userRole: role,
      req
    });
    
    res.status(201).json({ message: 'Registration successful', userId: user.id });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password, userType } = req.body;
    
    // Log login attempt (for debugging - remove sensitive data in production)
    console.log('Login attempt:', { email, userType, hasPassword: !!password });
    
    if (!email || !password || !userType) {
      console.log('Login failed: Missing required fields');
      return res.status(400).json({ error: 'Email, password, and user type required' });
    }
    
    // Validate user type
    if (userType !== 'admin' && userType !== 'staff') {
      console.log('Login failed: Invalid user type');
      return res.status(400).json({ error: 'Invalid user type' });
    }
    
    // Find user - explicitly select columns (password might be restricted)
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password, full_name, first_name, last_name, role, is_active, created_at, last_login')
      .eq('email', email)
      .single();
    
    if (error) {
      console.error('[Login Debug] Database error during login:', error);
      console.error('[Login Debug] Error details:', JSON.stringify(error, null, 2));
      
      // If it's a "not found" error (PGRST116), that's expected for invalid email
      if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
        console.log('[Login Debug] User not found in database');
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // For other database errors, return 500
      return res.status(500).json({ error: 'Database error during login', details: error.message });
    }
    
    if (!user) {
      console.log('[Login Debug] User not found (no data returned)');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log('[Login Debug] User found:', { id: user.id, email: user.email, role: user.role, is_active: user.is_active });
    
    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }
    
    // Verify user type matches
    if (user.role !== userType) {
      console.log('[Login Debug] Role mismatch:', { userRole: user.role, requestedType: userType });
      return res.status(403).json({ error: `This account is not authorized as ${userType}` });
    }
    
    // Verify password
    console.log('[Login Debug] Verifying password...');
    if (!user.password) {
      console.error('[Login Debug] User has no password hash!');
      return res.status(500).json({ error: 'User account configuration error' });
    }
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log('[Login Debug] Password verification failed');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    console.log('[Login Debug] Password verified successfully');
    
    // Create session
    req.session.user = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role
    };
    
    // Debug: Log session creation in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Login Debug] Session created for user:', user.email);
      console.log('[Login Debug] Session ID:', req.sessionID);
      console.log('[Login Debug] Cookie will be sent:', req.session.cookie);
    }
    
    // Explicitly save session to ensure cookie is set
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
      }
    });
    
    // Log audit
    await logAudit({
      userId: user.id,
      action: 'user_login',
      details: `User logged in from ${req.ip}`,
      userRole: user.role,
      req
    });
    
    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);
    
    res.json({
      message: 'Login successful',
      user: req.session.user
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout
app.post('/api/logout', requireAuth, async (req, res) => {
  try {
    // Log audit
    await logAudit({
      userId: req.session.user.id,
      action: 'user_logout',
      details: 'User logged out',
      userRole: req.session.user.role,
      req
    });
    
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ message: 'Logout successful' });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test Supabase connection with a simple query
    const { count, error } = await supabase.from('users').select('*', { count: 'exact', head: true });
    if (error) {
      console.error('Supabase health check error:', error);
      return res.status(503).json({ 
        status: 'error', 
        database: 'disconnected',
        error: error.message 
      });
    }
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      server: 'running',
      users: count || 0
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({ 
      status: 'error', 
      database: 'error',
      error: error.message 
    });
  }
});

// ==================== BOOKINGS ROUTES ====================

// Get all bookings
app.get('/api/bookings', requireAuth, async (req, res) => {
  try {
    const { status, packageId, limit = 100, offset = 0 } = req.query;
    
    // Use joins to get packages and users, matching guest system structure
    // FK constraint exists for user_id, so automatic joins should work
    let baseQuery = supabase
      .from('bookings')
      .select('*, packages(*)')
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    
    if (status && status !== 'all') {
      baseQuery = baseQuery.eq('status', status);
    }
    
    if (packageId) {
      baseQuery = baseQuery.eq('package_id', packageId);
    }
    
    // Try automatic join first (now that FK constraint exists)
    // If it fails, fall back to manual fetching
    const queryWithUsers = baseQuery.select('*, packages(*), users(*)');
    const { data: bookings, error } = await queryWithUsers;
    
    if (error) {
      console.error('Get bookings query error (trying automatic join):', error);
      // Fallback: fetch without users join
      const { data: bookingsWithoutUsers, error: fallbackError } = await baseQuery;
      if (fallbackError) {
        throw fallbackError;
      }
      
      // Manually fetch users in batch (optimized)
      const userIds = [...new Set((bookingsWithoutUsers || []).filter(b => b.user_id).map(b => b.user_id))];
      let usersMap = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, email, full_name, first_name, last_name')
          .in('id', userIds);
        usersMap = (users || []).reduce((acc, user) => {
          acc[user.id] = user;
          return acc;
        }, {});
      }
      
      // Fetch booking_items for each booking
      const bookingsWithItems = await Promise.all((bookingsWithoutUsers || []).map(async (booking) => {
        const { data: items } = await supabase
          .from('booking_items')
          .select('*')
          .eq('booking_id', booking.id);
        
        return {
          ...booking,
          users: usersMap[booking.user_id] || null,
          booking_items: items || []
        };
      }));
      
      console.log(`Returning ${bookingsWithItems.length} bookings (with fallback user fetching)`);
      return res.json({ bookings: bookingsWithItems });
    }
    
    // Success with automatic join - fetch booking_items for each booking
    const bookingsWithItems = await Promise.all((bookings || []).map(async (booking) => {
      const { data: items } = await supabase
        .from('booking_items')
        .select('*')
        .eq('booking_id', booking.id);
      
      return {
        ...booking,
        booking_items: items || []
      };
    }));
    
    console.log(`Returning ${bookingsWithItems.length} bookings`);
    res.json({ bookings: bookingsWithItems });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings', details: error.message });
  }
});

// Get single booking
app.get('/api/bookings/:id', requireAuth, async (req, res) => {
  try {
    // Use automatic joins now that FK constraint exists
    let query = supabase
      .from('bookings')
      .select('*, packages(*), users(*), booking_items(*)')
      .eq('id', req.params.id)
      .single();
    
    const { data: booking, error } = await query;
    
    if (error) {
      console.error('Get booking query error:', error);
      // Fallback: try without users join
      const { data: bookingWithoutUser, error: fallbackError } = await supabase
        .from('bookings')
        .select('*, packages(*), booking_items(*)')
        .eq('id', req.params.id)
        .single();
      
      if (fallbackError) {
        throw fallbackError;
      }
      
      // Fetch user manually
      let userData = null;
      if (bookingWithoutUser && bookingWithoutUser.user_id) {
        const { data: user } = await supabase
          .from('users')
          .select('id, email, full_name, first_name, last_name')
          .eq('id', bookingWithoutUser.user_id)
          .single();
        userData = user;
      }
      
      return res.json({ booking: { ...bookingWithoutUser, users: userData } });
    }
    
    res.json({ booking });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Failed to fetch booking', details: error.message });
  }
});

// Create new booking
app.post('/api/bookings', requireAuth, async (req, res) => {
  try {
    // Support both new structure (package_id, user_id) and legacy structure (guest_name, room_type)
    const { 
      // New structure
      package_id, user_id, guests, total_cost, contact_number, special_requests,
      per_room_guests, selected_cottages, cottage_dates, hall_id,
      // Legacy structure (backward compatibility)
      guest_name, guest_email, guest_phone, room_type, booking_time,
      // Common fields
      check_in, check_out, status = 'pending', guest_count = 1, adults, kids,
      visit_time, cottage, entrance_fee, cottage_fee
    } = req.body;
    
    // Validate dates
    if (!check_in || !check_out) {
      return res.status(400).json({ error: 'Check-in and check-out dates are required' });
    }
    
    const checkInDate = new Date(check_in);
    const checkOutDate = new Date(check_out);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (checkInDate < today) {
      return res.status(400).json({ error: 'Check-in date cannot be in the past' });
    }
    
    if (checkOutDate < checkInDate) {
      return res.status(400).json({ error: 'Check-out date cannot be before check-in date' });
    }
    
    let userId = user_id;
    let packageId = package_id;
    
    // Handle legacy structure: find or create user from guest_email
    if (!userId && guest_email) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', guest_email)
        .single();
      
      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create user if doesn't exist (for legacy admin bookings)
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            email: guest_email,
            first_name: guest_name?.split(' ')[0] || 'Guest',
            last_name: guest_name?.split(' ').slice(1).join(' ') || 'User',
            full_name: guest_name || `${guest_email} User`,
            role: 'customer'
          })
          .select('id')
          .single();
        
        if (userError) {
          console.error('Error creating user:', userError);
          return res.status(500).json({ error: 'Failed to create user account' });
        }
        userId = newUser.id;
      }
    }
    
    // Handle legacy structure: find package from room_type
    if (!packageId && room_type) {
      // Map room_type to package (simplified - may need adjustment based on your packages)
      const { data: packageData } = await supabase
        .from('packages')
        .select('id')
        .ilike('title', `%${room_type}%`)
        .or('category.eq.rooms')
        .limit(1)
        .single();
      
      if (packageData) {
        packageId = packageData.id;
      } else {
        return res.status(400).json({ error: `Package not found for room type: ${room_type}` });
      }
    }
    
    if (!userId || !packageId) {
      return res.status(400).json({ error: 'User ID and Package ID are required (or provide guest_email and room_type for legacy format)' });
    }
    
    // Build guests JSONB object
    let guestsObj = guests;
    if (!guestsObj) {
      guestsObj = {
        adults: adults || 0,
        children: kids || 0
      };
    }
    
    // Calculate total cost if not provided
    let finalTotalCost = total_cost;
    if (!finalTotalCost) {
      const baseCapacity = 4;
      const totalGuests = (guestsObj.adults || 0) + (guestsObj.children || 0);
      const additionalGuests = Math.max(0, totalGuests - baseCapacity);
      const extraGuestCharge = additionalGuests * 100;
      finalTotalCost = (entrance_fee || 0) + (cottage_fee || 0) + extraGuestCharge;
    }
    
    // Create booking with unified structure
    const bookingData = {
      user_id: userId,
      package_id: packageId,
      check_in: check_in,
      check_out: check_out,
      guests: guestsObj,
      status: status,
      total_cost: finalTotalCost,
      contact_number: contact_number || guest_phone || null,
      special_requests: special_requests || null,
      created_by: req.session.user.id,
      // Legacy fields (for backward compatibility with existing data)
      booking_time: booking_time || null,
      visit_time: visit_time || null,
      entrance_fee: entrance_fee || 0,
      cottage_fee: cottage_fee || 0
    };
    
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();
    
    if (error) throw error;
    
    // Create booking_items based on what's provided
    const bookingItems = [];
    
    // Create booking_items for rooms
    if (per_room_guests && Array.isArray(per_room_guests) && per_room_guests.length > 0) {
      per_room_guests.forEach((room, index) => {
        bookingItems.push({
          booking_id: booking.id,
          item_type: 'room',
          item_id: room.roomId || room.item_id || `Room ${index + 1}`,
          guest_name: room.guestName || guest_name || null,
          adults: room.adults || 0,
          children: room.children || 0
        });
      });
    }
    
    // Create booking_items for cottages
    if (selected_cottages && Array.isArray(selected_cottages) && selected_cottages.length > 0) {
      const datesToUse = cottage_dates && Array.isArray(cottage_dates) ? cottage_dates : [check_in];
      selected_cottages.forEach(cottageId => {
        datesToUse.forEach(date => {
          bookingItems.push({
            booking_id: booking.id,
            item_type: 'cottage',
            item_id: cottageId,
            usage_date: date
          });
        });
      });
    } else if (cottage) {
      // Legacy cottage field
      bookingItems.push({
        booking_id: booking.id,
        item_type: 'cottage',
        item_id: cottage,
        usage_date: check_in
      });
    }
    
    // Create booking_items for function halls
    if (hall_id) {
      bookingItems.push({
        booking_id: booking.id,
        item_type: 'function-hall',
        item_id: hall_id,
        usage_date: check_in
      });
    }
    
    // Insert all booking_items
    if (bookingItems.length > 0) {
      const { error: itemsError } = await supabase
        .from('booking_items')
        .insert(bookingItems);
      
      if (itemsError) {
        console.error('Error creating booking items:', itemsError);
        // Don't fail the request, but log the error
      }
    }
    
    // Fetch user info for email and audit
    const { data: userData } = await supabase
      .from('users')
      .select('email, full_name, first_name, last_name')
      .eq('id', userId)
      .single();
    
    const userEmail = userData?.email || guest_email;
    const userName = userData?.full_name || userData?.first_name + ' ' + userData?.last_name || guest_name || 'Guest';
    
    // Log audit
    await logAudit({
      userId: req.session.user.id,
      action: 'booking_create',
      details: `Created booking ${booking.id} for user ${userId}`,
      userRole: req.session.user.role,
      req
    });
    
    // Send booking receipt email
    if (userEmail) {
      const statusMessage = status === 'confirmed' 
        ? 'Your booking has been confirmed!' 
        : status === 'pending' 
        ? 'Your booking request has been received and is pending confirmation.'
        : 'Your booking has been cancelled.';
      
      const payNowLink = buildPaymentLink(req, booking);
      const emailBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4e8fff 0%, #4e8fff 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .details-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .details-box h2 { margin-top: 0; color: #4e8fff; border-bottom: 2px solid #4e8fff; padding-bottom: 10px; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .detail-row:last-child { border-bottom: none; }
            .detail-label { font-weight: 600; color: #666; }
            .detail-value { color: #333; text-align: right; }
            .status-badge { padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: capitalize; display: inline-block; }
            .status-confirmed { background: #27ae60; color: white; }
            .status-pending { background: #f8f32b; color: #333; }
            .status-cancelled { background: #e74c3c; color: white; }
            .total-box { background: #4e8fff; color: white; padding: 20px; border-radius: 8px; margin-top: 20px; }
            .total-box h3 { margin: 0 0 10px 0; font-size: 18px; }
            .total-amount { font-size: 32px; font-weight: 700; margin: 0; }
            .actions { text-align: center; margin-top: 20px; }
            .btn { display: inline-block; padding: 12px 20px; background: #27ae60; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 700; }
            .btn:hover { background: #1f8a4d; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏖️ Kina Resort</h1>
              <p style="margin: 10px 0 0 0;">Booking Receipt</p>
            </div>
            
            <div class="content">
              <p>Dear ${userName},</p>
              <p><strong>${statusMessage}</strong></p>
              
              <div class="details-box">
                <h2>Guest Information</h2>
                <div class="detail-row">
                  <span class="detail-label">Name:</span>
                  <span class="detail-value">${userName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Email:</span>
                  <span class="detail-value">${userEmail}</span>
                </div>
                ${booking.contact_number ? `
                <div class="detail-row">
                  <span class="detail-label">Phone:</span>
                  <span class="detail-value">${booking.contact_number}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                  <span class="detail-label">Booking Status:</span>
                  <span class="detail-value"><span class="status-badge status-${status}">${status}</span></span>
                </div>
              </div>
              
              <div class="details-box">
                <h2>Booking Details</h2>
                <div class="detail-row">
                  <span class="detail-label">Total Guests:</span>
                  <span class="detail-value">${(guestsObj.adults || 0) + (guestsObj.children || 0)}</span>
                </div>
                ${guestsObj.adults > 0 || guestsObj.children > 0 ? `
                <div class="detail-row">
                  <span class="detail-label">Guest Breakdown:</span>
                  <span class="detail-value">${guestsObj.adults || 0} Adult(s), ${guestsObj.children || 0} Kid(s)</span>
                </div>
                ` : ''}
                ${booking.visit_time ? `
                <div class="detail-row">
                  <span class="detail-label">Visit Time:</span>
                  <span class="detail-value">${booking.visit_time}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                  <span class="detail-label">Check-in:</span>
                  <span class="detail-value">${new Date(check_in).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Check-out:</span>
                  <span class="detail-value">${new Date(check_out).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                ${booking.booking_time ? `
                <div class="detail-row">
                  <span class="detail-label">Booking Time:</span>
                  <span class="detail-value">${booking.booking_time}</span>
                </div>
                ` : ''}
                ${booking.special_requests ? `
                <div class="detail-row">
                  <span class="detail-label">Special Requests:</span>
                  <span class="detail-value">${booking.special_requests}</span>
                </div>
                ` : ''}
              </div>
              
              ${finalTotalCost > 0 ? `
              <div class="details-box">
                <h2>Cost Breakdown</h2>
                ${booking.entrance_fee > 0 ? `
                <div class="detail-row">
                  <span class="detail-label">Entrance Fee:</span>
                  <span class="detail-value">₱${booking.entrance_fee.toFixed(2)}</span>
                </div>
                ` : ''}
                ${booking.cottage_fee > 0 ? `
                <div class="detail-row">
                  <span class="detail-label">Cottage Fee:</span>
                  <span class="detail-value">₱${booking.cottage_fee.toFixed(2)}</span>
                </div>
                ` : ''}
              </div>
              
              <div class="total-box">
                <h3>Total Amount</h3>
                <p class="total-amount">₱${finalTotalCost.toFixed(2)}</p>
              </div>
              ` : ''}
              ${(status !== 'cancelled' && finalTotalCost > 0) ? `
              <div class="actions">
                <a href="${payNowLink}" class="btn">Pay Now</a>
              </div>
              ` : ''}
              
              <div class="footer">
                <p><strong>Thank you for choosing Kina Resort!</strong></p>
                <p>If you have any questions, please contact us at your earliest convenience.</p>
                <p style="margin-top: 20px; font-size: 12px;">
                  This is an automated email. Please do not reply directly to this message.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
      
      await sendEmail({
        to: userEmail,
        subject: status === 'confirmed' ? 'Booking Confirmation - Kina Resort' : status === 'pending' ? 'Booking Receipt - Kina Resort' : 'Booking Cancellation - Kina Resort',
        html: emailBody
      });
    }
    
    // Fetch booking with related data for response
    const { data: bookingWithDetails } = await supabase
      .from('bookings')
      .select('*, packages(*), users(*), booking_items(*)')
      .eq('id', booking.id)
      .single();
    
    res.status(201).json({ booking: bookingWithDetails || booking });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Update booking
app.put('/api/bookings/:id', requireAuth, async (req, res) => {
  try {
    // Support both new structure and legacy structure
    const { 
      // New structure
      package_id, user_id, guests, total_cost, contact_number, special_requests,
      per_room_guests, selected_cottages, cottage_dates, hall_id,
      // Legacy structure (backward compatibility)
      guest_name, guest_email, guest_phone, room_type,
      // Common fields
      check_in, check_out, status, guest_count, adults, kids,
      visit_time, cottage, booking_time, entrance_fee, cottage_fee
    } = req.body;
    
    // Get current booking
    const { data: currentBooking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (!currentBooking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Build update data
    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    // Update basic fields
    if (check_in !== undefined) updateData.check_in = check_in;
    if (check_out !== undefined) updateData.check_out = check_out;
    if (status !== undefined) updateData.status = status;
    if (total_cost !== undefined) updateData.total_cost = total_cost;
    if (contact_number !== undefined) updateData.contact_number = contact_number;
    if (special_requests !== undefined) updateData.special_requests = special_requests;
    if (package_id !== undefined) updateData.package_id = package_id;
    if (user_id !== undefined) updateData.user_id = user_id;
    
    // Update guests JSONB
    if (guests !== undefined) {
      updateData.guests = guests;
    } else if (adults !== undefined || kids !== undefined) {
      updateData.guests = {
        adults: adults || 0,
        children: kids || 0
      };
    }
    
    // Legacy fields (for backward compatibility)
    if (booking_time !== undefined) updateData.booking_time = booking_time;
    if (visit_time !== undefined) updateData.visit_time = visit_time;
    if (entrance_fee !== undefined) updateData.entrance_fee = entrance_fee;
    if (cottage_fee !== undefined) updateData.cottage_fee = cottage_fee;
    
    // Validate dates if being updated
    if (check_in || check_out) {
      const finalCheckIn = check_in || currentBooking.check_in;
      const finalCheckOut = check_out || currentBooking.check_out;
      
      const checkInDate = new Date(finalCheckIn);
      const checkOutDate = new Date(finalCheckOut);
      
      if (checkOutDate < checkInDate) {
        return res.status(400).json({ error: 'Check-out date cannot be before check-in date' });
      }
    }
    
    // Update booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) throw error;
    
    // Handle booking_items updates if provided
    if (per_room_guests !== undefined || selected_cottages !== undefined || hall_id !== undefined) {
      // Delete existing booking_items
      await supabase
        .from('booking_items')
        .delete()
        .eq('booking_id', req.params.id);
      
      // Create new booking_items
      const bookingItems = [];
      
      if (per_room_guests && Array.isArray(per_room_guests) && per_room_guests.length > 0) {
        per_room_guests.forEach((room, index) => {
          bookingItems.push({
            booking_id: booking.id,
            item_type: 'room',
            item_id: room.roomId || room.item_id || `Room ${index + 1}`,
            guest_name: room.guestName || null,
            adults: room.adults || 0,
            children: room.children || 0
          });
        });
      }
      
      if (selected_cottages && Array.isArray(selected_cottages) && selected_cottages.length > 0) {
        const datesToUse = cottage_dates && Array.isArray(cottage_dates) ? cottage_dates : [check_in || currentBooking.check_in];
        selected_cottages.forEach(cottageId => {
          datesToUse.forEach(date => {
            bookingItems.push({
              booking_id: booking.id,
              item_type: 'cottage',
              item_id: cottageId,
              usage_date: date
            });
          });
        });
      } else if (cottage) {
        // Legacy cottage field
        bookingItems.push({
          booking_id: booking.id,
          item_type: 'cottage',
          item_id: cottage,
          usage_date: check_in || currentBooking.check_in
        });
      }
      
      if (hall_id) {
        bookingItems.push({
          booking_id: booking.id,
          item_type: 'function-hall',
          item_id: hall_id,
          usage_date: check_in || currentBooking.check_in
        });
      }
      
      if (bookingItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('booking_items')
          .insert(bookingItems);
        
        if (itemsError) {
          console.error('Error updating booking items:', itemsError);
        }
      }
    }
    
    await logAudit({
      userId: req.session.user.id,
      action: 'booking_update',
      details: `Updated booking ${req.params.id}`,
      userRole: req.session.user.role,
      req
    });
    
    // Fetch updated booking with related data
    const { data: bookingWithDetails } = await supabase
      .from('bookings')
      .select('*, packages(*), users(*), booking_items(*)')
      .eq('id', req.params.id)
      .single();
    
    res.json({ booking: bookingWithDetails || booking });
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// Delete booking
app.delete('/api/bookings/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', req.params.id);
    
    if (error) throw error;
    
    await logAudit({
      userId: req.session.user.id,
      action: 'booking_delete',
      details: `Deleted booking ${req.params.id}`,
      userRole: req.session.user.role,
      req
    });
    
    res.json({ message: 'Booking deleted' });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// ==================== DASHBOARD STATS ====================

// Get dashboard stats for Admin
app.get('/api/dashboard/stats', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    // Get total bookings
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*');
    
    if (error) throw error;
    
    const totalBookings = bookings.length;
    const pendingBookings = bookings.filter(b => b.status === 'pending').length;
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
    
    // Calculate occupancy rate (simplified)
    const occupancyRate = totalBookings > 0 ? Math.round((confirmedBookings / totalBookings) * 100) : 0;
    
    // Calculate daily revenue (mock data - replace with actual revenue calculation)
    const dailyRevenue = confirmedBookings * 150; // Assuming $150 per room
    
    res.json({
      totalBookings,
      occupancyRate,
      dailyRevenue,
      pendingBookings,
      confirmedBookings,
      cancelledBookings
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get staff dashboard data
app.get('/api/dashboard/staff', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's check-ins
    const { data: checkIns } = await supabase
      .from('bookings')
      .select('*')
      .eq('check_in', today)
      .in('status', ['confirmed', 'pending']);
    
    // Get today's check-outs
    const { data: checkOuts } = await supabase
      .from('bookings')
      .select('*')
      .eq('check_out', today)
      .in('status', ['confirmed', 'pending']);
    
    // Get assigned bookings for staff (if staff role assigns bookings)
    const { data: assignedBookings } = await supabase
      .from('bookings')
      .select('*')
      .in('status', ['pending'])
      .limit(20);
    
    res.json({
      checkIns: checkIns || [],
      checkOuts: checkOuts || [],
      assignedBookings: assignedBookings || []
    });
  } catch (error) {
    console.error('Staff dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch staff dashboard data' });
  }
});

// Get all users/staff
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({ users: users || [] });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create user (Admin only)
app.post('/api/users/create', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body;
    
    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email,
        password: hashedPassword,
        full_name,
        role,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Create user error:', error);
      return res.status(500).json({ error: 'Failed to create account' });
    }
    
    // Log audit
    await logAudit({
      userId: req.session.user.id,
      action: 'user_create',
      details: `Created ${role} account for ${email}`,
      userRole: req.session.user.role,
      req
    });
    
    res.status(201).json({ message: 'Account created successfully', user });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user
app.put('/api/users/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) throw error;
    
    await logAudit({
      userId: req.session.user.id,
      action: 'user_update',
      details: `Updated user ${req.params.id}`,
      userRole: req.session.user.role,
      req
    });
    
    res.json({ user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (Admin only)
app.delete('/api/users/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    // Check if this is the last admin
    const { data: admins } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'admin')
      .eq('is_active', true);
    
    // Get user to delete
    const { data: userToDelete } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent deleting last admin
    if (userToDelete.role === 'admin' && admins.length === 1) {
      return res.status(400).json({ error: 'Cannot delete the last admin account' });
    }
    
    // Prevent deleting yourself
    if (userToDelete.id === req.session.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // Delete user
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id);
    
    if (error) throw error;
    
    // Log audit
    await logAudit({
      userId: req.session.user.id,
      action: 'user_delete',
      details: `Deleted user account: ${userToDelete.email}`,
      userRole: req.session.user.role,
      req
    });
    
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// ==================== ROOMS ROUTES ====================

// Get all rooms with availability (based on bookings)
app.get('/api/rooms', requireAuth, async (req, res) => {
  try {
    const { check_in, check_out } = req.query;
    
    // Get all rooms from database
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*');
    
    if (roomsError) {
      console.error('Rooms fetch error:', roomsError);
      throw roomsError;
    }
    
    // Get all room types (this table might not exist yet)
    const { data: allRoomTypes, error: roomTypesError } = await supabase
      .from('room_types')
      .select('*')
      .eq('is_active', true);
    
    // Check if room_types exists, if not use legacy schema
    const useLegacySchema = !!roomTypesError;
    
    // Handle legacy vs new schema
    let roomsToProcess;
    if (useLegacySchema) {
      // Legacy: rooms table has room_type as string, no room_types table
      roomsToProcess = (rooms || []).map(room => ({
        ...room,
        room_types: null,
        room_type_name: room.room_type || 'unknown'
      }));
    } else {
      // New: rooms has room_type_id that references room_types table
      const roomTypesMap = {};
      (allRoomTypes || []).forEach(rt => {
        roomTypesMap[rt.id] = rt;
      });
      
      roomsToProcess = (rooms || []).map(room => ({
        ...room,
        room_types: room.room_type_id ? roomTypesMap[room.room_type_id] : null
      }));
    }
    
    // Get bookings that overlap with the date range (if provided)
    let occupiedRooms = new Set();
    const { data: bookings } = await supabase
      .from('bookings')
      .select('room_type')
      .in('status', ['confirmed', 'pending'])
      .lt('check_in', check_out || '2099-12-31')
      .gte('check_out', check_in || '2000-01-01');
    
    // Count occupied rooms by name
    const occupiedByName = {};
    (bookings || []).forEach(booking => {
      const roomTypeName = (booking.room_type || '').toLowerCase();
      occupiedByName[roomTypeName] = (occupiedByName[roomTypeName] || 0) + 1;
    });
    
    // Mark rooms as occupied
    roomsToProcess.forEach((room) => {
      const typeName = (room.room_type_name || room.room_type || 'unknown').toLowerCase();
      const sameTypeRooms = roomsToProcess.filter(r => {
        const rTypeName = (r.room_type_name || r.room_type || 'unknown').toLowerCase();
        return rTypeName === typeName;
      });
      const roomIndex = sameTypeRooms.findIndex(r => r.id === room.id);
      
      if (occupiedByName[typeName] && roomIndex < occupiedByName[typeName]) {
        occupiedRooms.add(room.id);
      }
    });
    
    // Add availability status and flatten data
    const roomsWithAvailability = roomsToProcess.map(room => ({
      id: room.id,
      room_number: room.room_number,
      room_type_id: room.room_type_id,
      room_type: room.room_types ? room.room_types.name : (room.room_type_name || room.room_type || 'unknown'),
      room_type_name: room.room_types ? room.room_types.name : (room.room_type_name || room.room_type || 'unknown'),
      floor: room.floor,
      status: room.status,
      maintenance_notes: room.maintenance_notes,
      last_cleaned: room.last_cleaned,
      price: room.room_types ? room.room_types.base_price : (room.price || 0),
      base_price: room.room_types ? room.room_types.base_price : (room.price || 0),
      description: room.room_types ? room.room_types.description : room.description,
      max_occupancy: room.room_types ? room.room_types.max_occupancy : null,
      amenities: room.room_types ? room.room_types.amenities : null,
      images: room.room_types ? room.room_types.images : null,
      is_available: !occupiedRooms.has(room.id) && (room.status === 'available' || room.is_active),
      created_at: room.created_at,
      updated_at: room.updated_at
    }));
    
    res.json({ rooms: roomsWithAvailability });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Get room availability count by type (for booking form)
app.get('/api/rooms/availability', requireAuth, async (req, res) => {
  try {
    const { check_in, check_out } = req.query;
    
    if (!check_in || !check_out) {
      return res.status(400).json({ error: 'check_in and check_out dates are required' });
    }
    
    // Get all rooms
    const { data: rooms } = await supabase
      .from('rooms')
      .select('*');
    
    // Check if room_types exists
    const { data: roomTypes, error: roomTypesError } = await supabase
      .from('room_types')
      .select('id, name')
      .eq('is_active', true);
    
    const useLegacySchema = !!roomTypesError;
    
    // Count total rooms by name
    const totalByName = {};
    (rooms || []).forEach(room => {
      let typeName;
      if (useLegacySchema) {
        typeName = (room.room_type || '').toLowerCase();
      } else if (room.room_type_id && roomTypes) {
        const rt = roomTypes.find(r => r.id === room.room_type_id);
        typeName = rt ? rt.name.toLowerCase() : '';
      }
      if (typeName) {
        totalByName[typeName] = (totalByName[typeName] || 0) + 1;
      }
    });
    
    // Get conflicting bookings
    const { data: bookings } = await supabase
      .from('bookings')
      .select('room_type')
      .in('status', ['confirmed', 'pending'])
      .lt('check_in', check_out)
      .gte('check_out', check_in);
    
    // Count occupied by name
    const occupiedByName = {};
    (bookings || []).forEach(booking => {
      const typeName = (booking.room_type || '').toLowerCase();
      if (typeName) {
        occupiedByName[typeName] = (occupiedByName[typeName] || 0) + 1;
      }
    });
    
    // Calculate available by name
    const availability = {};
    Object.keys(totalByName).forEach(typeName => {
      const total = totalByName[typeName] || 0;
      const occupied = occupiedByName[typeName] || 0;
      availability[typeName] = {
        total,
        occupied,
        available: Math.max(0, total - occupied)
      };
    });
    
    // Also include room types that might not have rooms
    if (!useLegacySchema && roomTypes) {
      (roomTypes || []).forEach(rt => {
        if (rt.name) {
          const typeName = rt.name.toLowerCase();
          if (!availability[typeName]) {
            availability[typeName] = {
              total: 0,
              occupied: occupiedByName[typeName] || 0,
              available: 0
            };
          }
        }
      });
    }
    
    res.json({ availability });
  } catch (error) {
    console.error('Get room availability error:', error);
    res.status(500).json({ error: 'Failed to fetch room availability' });
  }
});

// ==================== EXPORT ROUTES ====================

// Export audit logs as CSV (Admin only)
app.get('/api/audit-logs/export', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Flatten nested objects for CSV
    const flattenedLogs = (logs || []).map(log => ({
      id: log.id,
      user_id: log.user_id,
      user_role: log.user_role,
      action: log.action,
      details: log.details,
      table_name: log.table_name,
      ip_address: log.ip_address,
      created_at: log.created_at
    }));
    
    const csv = parse(flattenedLogs, {
      fields: ['id', 'user_id', 'user_role', 'action', 'details', 'table_name', 'ip_address', 'created_at']
    });
    
    res.header('Content-Type', 'text/csv');
    res.attachment('audit-logs.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export audit logs error:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

// Export bookings as CSV (Admin only)
app.get('/api/bookings/export', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    const csv = parse(bookings || [], {
      fields: ['id', 'guest_name', 'guest_email', 'guest_phone', 'room_type', 'check_in', 'check_out', 'status', 'guest_count', 'adults', 'kids', 'visit_time', 'cottage', 'entrance_fee', 'cottage_fee', 'extra_guest_charge', 'created_at']
    });
    
    res.header('Content-Type', 'text/csv');
    res.attachment('bookings.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export bookings error:', error);
    res.status(500).json({ error: 'Failed to export bookings' });
  }
});

// ==================== AUDIT LOGS ROUTES ====================

// Get audit logs (Admin only)
app.get('/api/audit-logs', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error('Audit logs query error:', error);
      throw error;
    }
    
    console.log('Fetched audit logs count:', logs?.length || 0);
    
    // Get unique user IDs
    const userIds = [...new Set((logs || []).map(log => log.user_id).filter(Boolean))];
    
    // Fetch all users at once for better performance
    // Try both 'users' and 'user_profiles' tables
    let usersMap = {};
    if (userIds.length > 0) {
      // First try 'users' table
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', userIds);
      
      if (!usersError && users) {
        usersMap = users.reduce((acc, user) => {
          acc[user.id] = user;
          return acc;
        }, {});
      }
      
      // If no users found, try 'user_profiles'
      if (Object.keys(usersMap).length === 0) {
        const { data: userProfiles, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        if (!profilesError && userProfiles) {
          usersMap = userProfiles.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
          }, {});
        }
      }
    }
    
    // Map logs with user details
    const logsWithUsers = (logs || []).map(log => {
      if (log.user_id && usersMap[log.user_id]) {
        return {
          ...log,
          user: usersMap[log.user_id]
        };
      }
      return {
        ...log,
        user: { id: null, full_name: 'System', email: 'N/A' }
      };
    });
    
    res.json({ logs: logsWithUsers });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// ==================== FORGOT PASSWORD ROUTES ====================

// Generate and send OTP
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (userError || !user) {
      return res.status(400).json({ error: 'No account found with this email' });
    }
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiration time (15 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);
    
    // Save OTP to database
    const { error: insertError } = await supabase
      .from('password_reset_otps')
      .insert({
        email,
        otp,
        expires_at: expiresAt.toISOString(),
        used: false
      });
    
    if (insertError) {
      console.error('OTP insert error:', insertError);
      return res.status(500).json({ error: 'Failed to send OTP' });
    }
    
    // Send OTP via email
    await sendEmail({
      to: email,
      subject: 'Password Reset OTP - Kina Resort',
      html: `
        <h2>Password Reset Request</h2>
        <p>Dear ${user.full_name},</p>
        <p>You requested to reset your password. Please use the OTP below:</p>
        <div style="background: #667eea; color: white; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This code will expire in 15 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Thank you,<br>Kina Resort Team</p>
      `
    });
    
    res.json({ message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify OTP
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }
    
    // Check OTP from database
    const { data: otpRecord, error } = await supabase
      .from('password_reset_otps')
      .select('*')
      .eq('email', email)
      .eq('otp', otp)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !otpRecord) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    
    // Check if OTP has expired
    const now = new Date();
    const expiresAt = new Date(otpRecord.expires_at);
    
    if (now > expiresAt) {
      return res.status(400).json({ error: 'OTP has expired' });
    }
    
    // Mark OTP as used
    await supabase
      .from('password_reset_otps')
      .update({ used: true })
      .eq('id', otpRecord.id);
    
    res.json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset password
app.post('/api/reset-password', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Check if there's a valid (recently used) OTP for this email
    const { data: recentOtp } = await supabase
      .from('password_reset_otps')
      .select('*')
      .eq('email', email)
      .eq('used', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!recentOtp || (new Date() - new Date(recentOtp.created_at)) > 5 * 60 * 1000) {
      return res.status(400).json({ error: 'Please verify OTP first' });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Update user password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('email', email);
    
    if (updateError) {
      return res.status(500).json({ error: 'Failed to reset password' });
    }
    
    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Payment page with PayMongo integration (guest-facing)
app.get('/pay/:id', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const token = req.query.t;
    
    // Verify booking and token
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();
    
    if (!booking || !verifyPaymentToken(bookingId, booking.guest_email, token)) {
      return res.status(400).send('<h2>Invalid or expired payment link.</h2>');
    }

    const totalCost = ((booking.entrance_fee || 0) + (booking.cottage_fee || 0) + (booking.extra_guest_charge || 0));
    
    // Check if PayMongo is configured
    if (!paymongo || !process.env.PAYMONGO_PUBLIC_KEY) {
      // Fallback to demo mode if PayMongo not configured
      const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
      const amount = totalCost.toFixed(2);
      return res.send(`
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pay for Booking</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f5f7fb; padding: 20px; color: #333; }
      .card { max-width: 520px; margin: 0 auto; background: #fff; border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); padding: 24px; }
      h1 { margin: 0 0 8px 0; font-size: 22px; }
      .muted { color: #666; margin-top: 0; }
      .amount { background: #4e8fff; color: #fff; padding: 12px 16px; border-radius: 8px; font-weight: 700; display: inline-block; margin: 12px 0 18px; }
      .methods { display: grid; gap: 10px; margin: 12px 0 18px; }
      .option { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; display: flex; align-items: center; gap: 10px; cursor: pointer; }
      .option input { margin-right: 8px; }
      .submit { display: inline-block; padding: 12px 18px; background: #27ae60; color: #fff; border-radius: 8px; font-weight: 700; border: none; cursor: pointer; }
      .submit:hover { background: #1f8a4d; }
      .small { color: #777; font-size: 12px; margin-top: 10px; }
      .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 8px; margin: 12px 0; color: #856404; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Kina Resort Payment</h1>
      <p class="muted">Booking for ${booking.guest_name} • ${new Date(booking.check_in).toLocaleDateString()} - ${new Date(booking.check_out).toLocaleDateString()}</p>
      <div class="amount">Amount Due: ₱${amount}</div>
      <div class="warning">⚠️ PayMongo not configured. Using demo mode.</div>
      <form method="POST" action="${baseUrl}/api/payments/confirm">
        <input type="hidden" name="booking_id" value="${bookingId}" />
        <input type="hidden" name="token" value="${token}" />
        <div class="methods">
          <label class="option"><input type="radio" name="method" value="bank" required /> Bank Payment</label>
          <label class="option"><input type="radio" name="method" value="gcash" /> GCash Payment</label>
          <label class="option"><input type="radio" name="method" value="cashier" /> Pay at Counter/Cashier</label>
        </div>
        <button type="submit" class="submit">Confirm Payment</button>
        <div class="small">Note: Configure PayMongo API keys in .env to enable real payments.</div>
      </form>
    </div>
  </body>
  </html>
      `);
    }
    
    // Convert PHP to centavos (PayMongo uses smallest currency unit)
    const amountInCents = Math.round(totalCost * 100);
    const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    
    try {
      // Create payment intent with PayMongo
      const paymentIntent = await paymongo.paymentIntents.create({
        amount: amountInCents,
        currency: 'PHP',
        description: `Booking payment for ${booking.guest_name} - ${booking.check_in} to ${booking.check_out}`,
        metadata: {
          booking_id: bookingId,
          guest_email: booking.guest_email,
          guest_name: booking.guest_name
        }
      });

      // Store payment intent ID in booking (only if payment_status column exists)
      try {
        await supabase
          .from('bookings')
          .update({ 
            payment_status: 'pending',
            payment_transaction_id: paymentIntent.id,
            payment_gateway: 'paymongo'
          })
          .eq('id', bookingId);
      } catch (dbError) {
        // Ignore if columns don't exist yet (migration not run)
        console.log('Payment fields may not exist yet. Run migration-add-payment-fields.sql');
      }

      // Render payment page with PayMongo checkout
      res.send(`
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pay for Booking - Kina Resort</title>
    <script src="https://js.paymongo.com/v1"></script>
    <style>
      body { font-family: Arial, sans-serif; background: #f5f7fb; padding: 20px; color: #333; }
      .card { max-width: 520px; margin: 0 auto; background: #fff; border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); padding: 24px; }
      h1 { margin: 0 0 8px 0; font-size: 22px; }
      .muted { color: #666; margin-top: 0; }
      .amount { background: #4e8fff; color: #fff; padding: 12px 16px; border-radius: 8px; font-weight: 700; display: inline-block; margin: 12px 0 18px; }
      .payment-container { margin: 20px 0; }
      .paymongo-element { padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; margin: 10px 0; }
      .submit { display: inline-block; padding: 12px 18px; background: #27ae60; color: #fff; border-radius: 8px; font-weight: 700; border: none; cursor: pointer; width: 100%; margin-top: 10px; }
      .submit:hover { background: #1f8a4d; }
      .submit:disabled { background: #ccc; cursor: not-allowed; }
      .error { color: #e74c3c; margin-top: 10px; }
      .success { color: #27ae60; margin-top: 10px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>🏖️ Kina Resort Payment</h1>
      <p class="muted">Booking for ${booking.guest_name} • ${new Date(booking.check_in).toLocaleDateString()} - ${new Date(booking.check_out).toLocaleDateString()}</p>
      <div class="amount">Amount Due: ₱${totalCost.toFixed(2)}</div>
      
      <form id="payment-form">
        <input type="hidden" name="booking_id" value="${bookingId}" />
        <input type="hidden" name="token" value="${token}" />
        <input type="hidden" name="payment_intent_id" value="${paymentIntent.id}" />
        
        <div class="payment-container">
          <div id="paymongo-elements"></div>
          <div id="error-message" class="error"></div>
        </div>
        
        <button type="submit" class="submit" id="submit-btn">Pay ₱${totalCost.toFixed(2)}</button>
      </form>
    </div>

    <script>
      // Initialize PayMongo Elements
      const paymongoClient = Paymongo('${process.env.PAYMONGO_PUBLIC_KEY}');
      const elements = paymongoClient.elements();
      
      // Create payment method input
      const paymentMethodElement = elements.create('paymentMethod', {
        layout: 'tabs',
        paymentMethods: ['gcash', 'grab_pay', 'card']
      });
      
      paymentMethodElement.mount('#paymongo-elements');
      
      const form = document.getElementById('payment-form');
      const submitBtn = document.getElementById('submit-btn');
      const errorDiv = document.getElementById('error-message');
      
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
        errorDiv.textContent = '';
        
        try {
          // Create payment method
          const paymentMethod = await paymongoClient.paymentMethods.create({
            type: paymentMethodElement.value,
          });
          
          // Attach payment method to payment intent
          const response = await fetch('${baseUrl}/api/payments/paymongo/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              booking_id: '${bookingId}',
              token: '${token}',
              payment_intent_id: '${paymentIntent.id}',
              payment_method_id: paymentMethod.id
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            window.location.href = result.redirect_url || '${baseUrl}/payment-success?booking_id=${bookingId}';
          } else {
            errorDiv.textContent = result.error || 'Payment failed. Please try again.';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Pay ₱${totalCost.toFixed(2)}';
          }
        } catch (error) {
          console.error('Payment error:', error);
          errorDiv.textContent = error.message || 'Payment failed. Please try again.';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Pay ₱${totalCost.toFixed(2)}';
        }
      });
    </script>
  </body>
</html>
      `);
    } catch (error) {
      console.error('PayMongo payment intent creation error:', error);
      res.status(500).send('<h2>Unable to initialize payment. Please try again later.</h2><p>Error: ' + error.message + '</p>');
    }
  } catch (e) {
    console.error('Render payment page error:', e);
    res.status(500).send('<h2>Unable to load payment page.</h2>');
  }
});

// Confirm PayMongo payment
app.post('/api/payments/paymongo/confirm', async (req, res) => {
  try {
    const { booking_id, token, payment_intent_id, payment_method_id } = req.body;
    
    if (!paymongo) {
      return res.status(500).json({ error: 'PayMongo not configured' });
    }
    
    // Verify booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();
    
    if (!booking || !verifyPaymentToken(booking_id, booking.guest_email, token)) {
      return res.status(400).json({ error: 'Invalid or expired payment link' });
    }
    
    // Attach payment method to payment intent
    const paymentIntent = await paymongo.paymentIntents.attach(payment_intent_id, {
      payment_method: payment_method_id
    });
    
    // Check payment status
    if (paymentIntent.status === 'succeeded') {
      // Payment successful!
      const totalCost = (booking.entrance_fee || 0) + (booking.cottage_fee || 0) + (booking.extra_guest_charge || 0);
      
      // Update booking
      try {
        await supabase
          .from('bookings')
          .update({
            payment_status: 'paid',
            payment_method: paymentIntent.payment_method?.type || 'online',
            payment_date: new Date().toISOString(),
            payment_amount: totalCost,
            status: 'confirmed',
            updated_at: new Date().toISOString()
          })
          .eq('id', booking_id);
      } catch (dbError) {
        // Fallback if payment fields don't exist
        await supabase
          .from('bookings')
          .update({
            status: 'confirmed',
            updated_at: new Date().toISOString()
          })
          .eq('id', booking_id);
      }
      
      // Create payment record (if payments table exists)
      try {
        await supabase
          .from('payments')
          .insert({
            booking_id,
            amount: totalCost,
            currency: 'PHP',
            payment_method: paymentIntent.payment_method?.type || 'online',
            payment_gateway: 'paymongo',
            transaction_id: paymentIntent.id,
            gateway_response: paymentIntent,
            status: 'completed'
          });
      } catch (dbError) {
        // Ignore if payments table doesn't exist
        console.log('Payments table may not exist yet. Run migration-add-payment-fields.sql');
      }
      
      // Send receipt email
      await sendEmail({
        to: booking.guest_email,
        subject: 'Payment Confirmation - Kina Resort',
        html: generatePaymentReceiptHTML(booking, totalCost, paymentIntent.payment_method?.type || 'Online Payment')
      });
      
      // Log audit trail
      await logAudit({
        userId: null,
        action: 'booking_payment',
        details: `Payment confirmed for booking ${booking.id} via PayMongo (${paymentIntent.payment_method?.type || 'online'})`,
        userRole: 'guest',
        req
      });
      
      return res.json({
        success: true,
        redirect_url: `/payment-success?booking_id=${booking_id}`
      });
    } else {
      return res.status(400).json({ error: 'Payment not completed. Status: ' + paymentIntent.status });
    }
  } catch (error) {
    console.error('PayMongo confirm error:', error);
    res.status(500).json({ error: 'Payment processing failed: ' + (error.message || 'Unknown error') });
  }
});

// Fallback payment confirmation (for demo mode when PayMongo not configured)
app.post('/api/payments/confirm', async (req, res) => {
  try {
    const { booking_id, token, method } = req.body;
    if (!booking_id || !token || !method) {
      return res.status(400).json({ error: 'Missing payment details' });
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();
    if (!booking || !verifyPaymentToken(booking_id, booking.guest_email, token)) {
      return res.status(400).json({ error: 'Invalid or expired payment link' });
    }

    // Optionally mark as confirmed
    if (booking.status !== 'cancelled' && booking.status !== 'confirmed') {
      await supabase
        .from('bookings')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', booking_id);
    }

    const totalCost = (booking.entrance_fee || 0) + (booking.cottage_fee || 0) + (booking.extra_guest_charge || 0);

    // Send receipt email
    await sendEmail({
      to: booking.guest_email,
      subject: 'Payment Confirmation - Kina Resort',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="background:#27ae60;color:#fff;padding:16px;border-radius:8px 8px 0 0;margin:0;">Payment Confirmed</h2>
          <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
            <p>Dear ${booking.guest_name},</p>
            <p>Your payment has been recorded successfully.</p>
            <p><strong>Payment Method:</strong> ${method.toUpperCase()}</p>
            <p><strong>Booking ID:</strong> ${booking.id}</p>
            <p><strong>Amount Paid:</strong> ₱${totalCost.toFixed(2)}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
            <p>Check-in: ${new Date(booking.check_in).toLocaleDateString()}</p>
            <p>Check-out: ${new Date(booking.check_out).toLocaleDateString()}</p>
            ${booking.booking_time ? `<p>Booking Time: ${booking.booking_time}</p>` : ''}
            ${booking.visit_time ? `<p>Visit Time: ${booking.visit_time}</p>` : ''}
            <p style="margin-top:20px;">Thank you for choosing Kina Resort!</p>
          </div>
        </div>
      `
    });

    // Log audit trail
    await logAudit({
      userId: null,
      action: 'booking_payment',
      details: `Payment confirmed for booking ${booking.id} via ${method} (demo mode)`,
      userRole: 'guest',
      req
    });

    // Redirect back to a simple thank-you page
    res.send(`
      <h2>Thank you! Your payment has been recorded.</h2>
      <p>A confirmation receipt was sent to ${booking.guest_email}.</p>
      <p><small>Note: This is demo mode. Configure PayMongo for real payments.</small></p>
    `);
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// PayMongo webhook handler (for async payment confirmations)
app.post('/api/webhooks/paymongo', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!paymongo) {
      return res.status(500).json({ error: 'PayMongo not configured' });
    }
    
    const signature = req.headers['paymongo-signature'];
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.warn('PayMongo webhook secret not configured');
      // Continue without verification in development
    } else {
      // Verify webhook signature
      const isValid = paymongo.webhooks.verify(req.body, signature, webhookSecret);
      
      if (!isValid) {
        return res.status(400).send('Invalid signature');
      }
    }
    
    const event = JSON.parse(req.body);
    
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data;
      const bookingId = paymentIntent.metadata?.booking_id;
      
      if (bookingId) {
        // Get booking
        const { data: booking } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', bookingId)
          .single();
        
        if (booking) {
          const totalCost = (booking.entrance_fee || 0) + (booking.cottage_fee || 0) + (booking.extra_guest_charge || 0);
          
          // Update booking payment status
          try {
            await supabase
              .from('bookings')
              .update({
                payment_status: 'paid',
                payment_date: new Date().toISOString(),
                status: 'confirmed',
                updated_at: new Date().toISOString()
              })
              .eq('id', bookingId);
          } catch (dbError) {
            // Fallback if payment fields don't exist
            await supabase
              .from('bookings')
              .update({
                status: 'confirmed',
                updated_at: new Date().toISOString()
              })
              .eq('id', bookingId);
          }
          
          // Create payment record
          try {
            await supabase
              .from('payments')
              .insert({
                booking_id: bookingId,
                amount: totalCost,
                currency: 'PHP',
                payment_gateway: 'paymongo',
                transaction_id: paymentIntent.id,
                gateway_response: paymentIntent,
                status: 'completed'
              });
          } catch (dbError) {
            console.log('Payments table may not exist yet');
          }
          
          // Send receipt
          await sendEmail({
            to: booking.guest_email,
            subject: 'Payment Confirmation - Kina Resort',
            html: generatePaymentReceiptHTML(booking, totalCost, 'Online Payment')
          });
        }
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Payment success page
app.get('/payment-success', async (req, res) => {
  const bookingId = req.query.booking_id;
  
  if (bookingId) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();
    
    if (booking) {
      return res.send(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center;">
          <h2 style="color: #27ae60; font-size: 32px;">✅ Payment Successful!</h2>
          <p style="font-size: 18px; margin: 20px 0;">Your payment has been processed successfully.</p>
          <p>A confirmation receipt has been sent to <strong>${booking.guest_email}</strong></p>
          <p style="margin-top: 30px;"><strong>Booking ID:</strong> ${bookingId}</p>
          <div style="margin-top: 40px; padding: 20px; background: #f5f7fb; border-radius: 8px;">
            <p><strong>Check-in:</strong> ${new Date(booking.check_in).toLocaleDateString()}</p>
            <p><strong>Check-out:</strong> ${new Date(booking.check_out).toLocaleDateString()}</p>
          </div>
        </div>
      `);
    }
  }
  
  res.send('<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center;"><h2>Payment Successful!</h2><p>Thank you for your payment.</p></div>');
});

// Helper function to generate payment receipt HTML
function generatePaymentReceiptHTML(booking, amount, paymentMethod) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .details-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; }
        .total-box { background: #27ae60; color: white; padding: 20px; border-radius: 8px; margin-top: 20px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Payment Confirmed</h1>
          <p>Kina Resort</p>
        </div>
        <div class="content">
          <p>Dear ${booking.guest_name},</p>
          <p>Your payment has been successfully processed.</p>
          
          <div class="details-box">
            <h2>Payment Details</h2>
            <div class="detail-row">
              <span>Payment Method:</span>
              <span><strong>${paymentMethod.toUpperCase()}</strong></span>
            </div>
            <div class="detail-row">
              <span>Booking ID:</span>
              <span>${booking.id}</span>
            </div>
            <div class="detail-row">
              <span>Transaction Date:</span>
              <span>${new Date().toLocaleString()}</span>
            </div>
          </div>
          
          <div class="details-box">
            <h2>Booking Details</h2>
            <div class="detail-row">
              <span>Check-in:</span>
              <span>${new Date(booking.check_in).toLocaleDateString()}</span>
            </div>
            <div class="detail-row">
              <span>Check-out:</span>
              <span>${new Date(booking.check_out).toLocaleDateString()}</span>
            </div>
            <div class="detail-row">
              <span>Room Type:</span>
              <span>${booking.room_type}</span>
            </div>
            ${booking.booking_time ? `
            <div class="detail-row">
              <span>Booking Time:</span>
              <span>${booking.booking_time}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="total-box">
            <h3>Amount Paid</h3>
            <p style="font-size: 32px; font-weight: 700; margin: 0;">₱${amount.toFixed(2)}</p>
          </div>
          
          <p style="margin-top: 20px;">Thank you for choosing Kina Resort!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Test Supabase connection on startup
async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      console.error('❌ Supabase connection FAILED:', error.message);
      console.error('   Please check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    } else {
      console.log('✅ Supabase connection successful');
    }
  } catch (err) {
    console.error('❌ Supabase connection error:', err.message);
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Access the application at: http://localhost:${PORT}`);
  await testSupabaseConnection();
});
