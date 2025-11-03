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
