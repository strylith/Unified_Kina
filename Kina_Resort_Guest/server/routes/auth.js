import express from 'express';
import jwt from 'jsonwebtoken';
import { db, dbAuth } from '../db/databaseClient.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper function to generate JWT token
const generateToken = (userId, email = null, userMetadata = {}) => {
  const secret = process.env.JWT_SECRET || 'test-secret-key-for-tests';
  const payload = { 
    userId, 
    email,
    user_metadata: userMetadata,
    ...userMetadata 
  };
  return jwt.sign(payload, secret, { expiresIn: '7d' });
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ 
        success: false, 
        error: 'All fields are required' 
      });
    }

    // Create user in Auth
    const { data: authData, error: authError } = await dbAuth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        firstName,
        lastName
      }
    });

    if (authError) {
      return res.status(400).json({ 
        success: false, 
        error: authError.message 
      });
    }

    // Create user profile in users table
    const { error: profileError } = await db
      .from('users')
      .insert({
        id: authData.user.id,
        email: email,
        first_name: firstName,
        last_name: lastName,
        member_since: new Date().toISOString(),
        loyalty_points: 0,
        total_bookings: 0
      });

    if (profileError) {
      // User created but profile failed - delete auth user
      await dbAuth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to create user profile' 
      });
    }

    // Generate token with user info
    const token = generateToken(
      authData.user.id,
      email,
      { firstName, lastName }
    );

    res.json({
      success: true,
      user: {
        id: authData.user.id,
        email: email,
        firstName,
        lastName
      },
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password required' 
      });
    }

    // Verify password using anon client
    const { data: signInData, error: signInError } = await dbAuth.signInWithPassword({
      email,
      password
    });

    if (signInError || !signInData.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await db
      .from('users')
      .select('*')
      .eq('id', signInData.user.id)
      .single();

    if (profileError) {
      return res.status(404).json({ 
        success: false, 
        error: 'User profile not found' 
      });
    }

    // Generate token with user info
    const token = generateToken(
      signInData.user.id,
      profile.email,
      { 
        firstName: profile.first_name, 
        lastName: profile.last_name 
      }
    );

    res.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        firstName: profile.first_name,
        lastName: profile.last_name,
        memberSince: profile.member_since,
        loyaltyPoints: profile.loyalty_points,
        totalBookings: profile.total_bookings
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/auth/oauth-login
// Exchange Supabase OAuth token for server JWT token
router.post('/oauth-login', async (req, res) => {
  try {
    const { supabaseToken } = req.body;

    if (!supabaseToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'Supabase token required' 
      });
    }

    // Decode Supabase JWT to extract user ID (sub claim)
    // Note: We decode without verification since we'll verify via Admin API
    let decodedToken;
    try {
      // Decode JWT without verification (just to get claims)
      // Supabase uses standard JWT encoding (base64url)
      const parts = supabaseToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }
      
      // Handle base64url encoding (JWT standard) - add padding if needed
      let payloadBase64 = parts[1];
      // Add padding for base64 decoding (base64url doesn't use padding)
      while (payloadBase64.length % 4) {
        payloadBase64 += '=';
      }
      
      // Replace base64url characters with base64
      payloadBase64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
      
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
      decodedToken = payload;
    } catch (decodeError) {
      console.error('[OAuth] Token decode error:', decodeError);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token format' 
      });
    }

    const userId = decodedToken.sub;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token missing user ID' 
      });
    }

    // Verify user exists in Supabase Auth using Admin API
    const { data: authUserData, error: authError } = await dbAuth.admin.getUserById(userId);
    const authUser = authUserData?.user || authUserData;

    if (authError || !authUser) {
      console.error('[OAuth] User verification failed:', authError);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
    }

    // Extract user information
    const email = authUser.email || decodedToken.email;
    const userMetadata = authUser.user_metadata || {};
    const fullName = userMetadata.full_name || userMetadata.name || '';
    
    // Parse name into first and last name
    let firstName = userMetadata.firstName || userMetadata.first_name || '';
    let lastName = userMetadata.lastName || userMetadata.last_name || '';
    
    // If fullName exists but firstName/lastName don't, split it
    if (fullName && !firstName && !lastName) {
      const nameParts = fullName.trim().split(/\s+/);
      firstName = nameParts[0] || email?.split('@')[0] || 'User';
      lastName = nameParts.slice(1).join(' ') || '';
    }
    
    // Fallback to email username if no name available
    if (!firstName) {
      firstName = email?.split('@')[0] || 'User';
    }

    // Check if user profile exists in kina_v2.users
    const { data: existingProfile, error: profileQueryError } = await db
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    let profile;
    
    if (profileQueryError && profileQueryError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('[OAuth] Profile query error:', profileQueryError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to check user profile' 
      });
    }

    if (existingProfile) {
      // User exists - update last_login, preserve existing data
      const { data: updatedProfile, error: updateError } = await db
        .from('users')
        .update({
          last_login: new Date().toISOString(),
          email: email, // Update email in case it changed
          first_name: firstName || existingProfile.first_name,
          last_name: lastName || existingProfile.last_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) {
        console.error('[OAuth] Profile update error:', updateError);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to update user profile' 
        });
      }

      profile = updatedProfile;
    } else {
      // User doesn't exist - create new profile
      const { data: newProfile, error: insertError } = await db
        .from('users')
        .insert({
          id: userId,
          email: email,
          first_name: firstName,
          last_name: lastName,
          member_since: new Date().toISOString(),
          loyalty_points: 0,
          total_bookings: 0,
          role: 'customer',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('[OAuth] Profile creation error:', insertError);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to create user profile' 
        });
      }

      profile = newProfile;
    }

    // Generate server JWT token (same format as email/password login)
    const token = generateToken(
      userId,
      profile.email,
      { 
        firstName: profile.first_name, 
        lastName: profile.last_name 
      }
    );

    // Return same format as /login endpoint for consistency
    res.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        firstName: profile.first_name,
        lastName: profile.last_name,
        memberSince: profile.member_since,
        loyaltyPoints: profile.loyalty_points,
        totalBookings: profile.total_bookings
      },
      token
    });
  } catch (error) {
    console.error('[OAuth] OAuth login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // In this implementation, JWT tokens are stateless
    // Client should simply discard the token
    res.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email required' 
      });
    }

    // Send password reset email
    const { error } = await dbAuth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:5500/#/auth'
    });

    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }

    res.json({ 
      success: true, 
      message: 'Password reset email sent' 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user.id;

    const { data: profile, error } = await db
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return res.status(404).json({ 
        success: false, 
        error: 'User profile not found' 
      });
    }

    res.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        firstName: profile.first_name,
        lastName: profile.last_name,
        memberSince: profile.member_since,
        loyaltyPoints: profile.loyalty_points,
        totalBookings: profile.total_bookings
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

export default router;
