// Simple authentication system for testing
import { setAuthState } from './state.js';
import { login as apiLogin, register as apiRegister } from './api.js';
import { supabase } from '../lib/supabaseClient.js';

// API base is centralized in utils/api.js; avoid direct fetches here

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  init() {
    // Check if user is already logged in
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');
    
    if (savedToken && savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
        this.updateHeaderForLoggedInUser();
        
        // Sync with global auth state
        setAuthState({
          isLoggedIn: true,
          user: this.currentUser,
          role: this.currentUser.role || 'customer'
        });
        
        // Update homepage buttons after a short delay to ensure DOM is ready
        setTimeout(() => {
          this.updateHomepageButtons();
        }, 100);
      } catch (e) {
        // Clear invalid data
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
  }

  // Test credentials for development
  getTestUsers() {
    return [
      {
        id: 'test1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        password: 'password123',
        memberSince: '2024-01-15',
        loyaltyPoints: 1250,
        totalBookings: 3
      },
      {
        id: 'test2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@test.com',
        password: 'password123',
        memberSince: '2024-03-20',
        loyaltyPoints: 850,
        totalBookings: 2
      }
    ];
  }

  async login(email, password) {
    try {
      const data = await apiLogin(email, password);
      if (data && (data.success === undefined || data.success || data.token || data.user)) {
        // Store token and user
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        
        this.currentUser = data.user;
        this.updateHeaderForLoggedInUser();
        
        // Sync with global auth state
        setAuthState({
          isLoggedIn: true,
          user: data.user,
          role: data.user.role || 'customer'
        });
        
        // Update homepage buttons if on homepage
        this.updateHomepageButtons();
        
        return { success: true, user: data.user };
      }
      return { success: false, message: data?.error || 'Invalid email or password' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Failed to connect to server. Make sure backend is running.' };
    }
  }

  async register(userData) {
    try {
      const data = await apiRegister(userData);
      if (data && (data.success === undefined || data.success || data.token || data.user)) {
        // Store token and user
        if (data.token) localStorage.setItem('auth_token', data.token);
        if (data.user) localStorage.setItem('auth_user', JSON.stringify(data.user));
        
        this.currentUser = data.user;
        this.updateHeaderForLoggedInUser();
        
        // Sync with global auth state
        setAuthState({
          isLoggedIn: true,
          user: data.user,
          role: data.user.role || 'customer'
        });
        
        // Update homepage buttons if on homepage
        this.updateHomepageButtons();
        
        return { success: true, user: data.user };
      }
      return { success: false, message: data?.error || 'Registration failed' };
    } catch (error) {
      console.error('Register error:', error);
      const res = { success: false, message: error?.message || 'Failed to connect to server' };
      if (error?.field) res.field = error.field;
      if (error?.code) res.code = error.code;
      return res;
    }
  }

  logout() {
    // Also sign out from Supabase (if logged in via Google)
    try { supabase.auth.signOut(); } catch {}
    // Clear tokens in local storage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('kina_user');
    
    this.currentUser = null;
    this.updateHeaderForLoggedOut();
    
    // Clear global auth state
    setAuthState({
      isLoggedIn: false,
      user: null,
      role: 'guest'
    });
    
    // Update homepage buttons if on homepage
    this.updateHomepageButtons();
    
    location.hash = '#/';
    location.reload();
  }

  isLoggedIn() {
    return this.currentUser !== null;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  updateHeaderForLoggedInUser() {
    const menu = document.getElementById('primary-menu');
    if (!menu) return;
    
    // Get all navigation items
    const packagesLink = menu.querySelector('a[data-nav="packages"]');
    const bookingsLink = menu.querySelector('a[data-nav="bookings"]');
    const weatherLink = menu.querySelector('a[data-nav="weather"]');
    const aboutLink = menu.querySelector('a[data-nav="about"]');
    const accountLink = menu.querySelector('a[data-nav="account"]');
    
    // Reorder navigation: Packages, Calendar, Bookings, About, Account
    const orderedItems = [packagesLink, weatherLink, bookingsLink, aboutLink, accountLink];
    orderedItems.forEach((item, index) => {
      if (item) {
        menu.appendChild(item.parentElement);
      }
    });
    
    // Change "Weather" to "Calendar"
    if (weatherLink) {
      weatherLink.textContent = 'Calendar';
    }
    
    // Show Bookings link
    if (bookingsLink && bookingsLink.parentElement) {
      bookingsLink.parentElement.style.display = '';
      bookingsLink.style.display = '';
    }
    
    // Update account button with user info
    if (accountLink && this.currentUser) {
      accountLink.innerHTML = `
        <div class="user-menu" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span class="user-name" style="font-weight: 600;">${this.currentUser.firstName}</span>
        </div>
      `;
      
      // Add click handler to open profile modal
      const userMenu = accountLink.querySelector('.user-menu');
      if (userMenu) {
        userMenu.onclick = (e) => {
          e.preventDefault();
          import('../components/profileModal.js').then(module => {
            module.openProfileModal();
          });
        };
      }
    }
  }

  updateHeaderForLoggedOut() {
    const menu = document.getElementById('primary-menu');
    if (!menu) return;
    
    // Get all navigation items
    const packagesLink = menu.querySelector('a[data-nav="packages"]');
    const bookingsLink = menu.querySelector('a[data-nav="bookings"]');
    const weatherLink = menu.querySelector('a[data-nav="weather"]');
    const aboutLink = menu.querySelector('a[data-nav="about"]');
    const accountLink = menu.querySelector('a[data-nav="account"]');
    
    // Restore original order: Packages, Bookings (hidden), Weather, About, Login
    const orderedItems = [packagesLink, bookingsLink, weatherLink, aboutLink, accountLink];
    orderedItems.forEach((item) => {
      if (item && item.parentElement) {
        menu.appendChild(item.parentElement);
      }
    });
    
    // Change "Calendar" back to "Weather"
    if (weatherLink) {
      weatherLink.textContent = 'Weather';
    }
    
    // Hide Bookings link
    if (bookingsLink && bookingsLink.parentElement) {
      bookingsLink.parentElement.style.display = 'none';
      bookingsLink.style.display = 'none';
    }
    
    // Update account button to show "Login"
    if (accountLink) {
      accountLink.innerHTML = 'Login';
      accountLink.onclick = null;
    }
  }

  updateHomepageButtons() {
    // Dynamically import to avoid circular dependencies
    import('../pages/home.js').then(module => {
      if (module.updateHomepageButtonsOnAuthChange) {
        module.updateHomepageButtonsOnAuthChange();
      }
    }).catch(() => {
      // If homepage module not loaded, ignore
    });
  }
}

// Create global auth instance
window.kinaAuth = new AuthManager();

// Export for use in other modules
export { AuthManager };
