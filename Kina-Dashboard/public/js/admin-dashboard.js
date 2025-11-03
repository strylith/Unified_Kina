// Admin Dashboard JavaScript

let currentView = 'overview';
let bookings = [];
let stats = {};
let salesChart = null;
let currentPeriod = 'daily';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
    loadDashboardData();
    setupInactivityTimer();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopAuditLogsRealTime();
});

// Show logout confirmation dialog
function showLogoutConfirmation() {
    return new Promise((resolve) => {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        // Create confirmation box
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            max-width: 400px;
            width: 90%;
            text-align: center;
        `;
        
        modal.innerHTML = `
            <h2 style="margin: 0 0 15px 0; color: #333;">Confirm Logout</h2>
            <p style="margin: 0 0 25px 0; color: #666;">Are you sure you want to log out?</p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="confirmLogoutYes" style="
                    padding: 10px 30px;
                    background: #dc3545;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                ">Yes, Logout</button>
                <button id="confirmLogoutNo" style="
                    padding: 10px 30px;
                    background: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                ">Cancel</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Handle Yes button
        document.getElementById('confirmLogoutYes').addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(true);
        });
        
        // Handle No button
        document.getElementById('confirmLogoutNo').addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(false);
        });
        
        // Handle Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', handleEscape);
                resolve(false);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        // Handle click outside modal
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', handleEscape);
                resolve(false);
            }
        });
    });
}

// Check authentication
async function checkAuth() {
    try {
        // Debug: Check if cookies are available
        console.log('[Frontend Debug] Checking authentication...');
        
        const response = await fetch('/api/me', {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        // Debug: Log response details
        console.log('[Frontend Debug] Auth response status:', response.status);
        console.log('[Frontend Debug] Response headers:', Object.fromEntries(response.headers.entries()));
        
        const data = await response.json();
        
        if (!data.user) {
            window.location.href = '/login.html';
            return;
        }
        
        if (data.user.role !== 'admin') {
            alert('Access denied. Redirecting to staff dashboard.');
            window.location.href = '/staff-dashboard.html';
            return;
        }
        
        // Display user info
        document.getElementById('userInfo').textContent = `${data.user.full_name}`;
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/login.html';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.target.dataset.view;
            switchView(view);
        });
    });
    
    // Logout with confirmation
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        const confirmed = await showLogoutConfirmation();
        if (confirmed) {
            try {
                await fetch('/api/logout', { method: 'POST', credentials: 'include' });
                window.location.href = '/login.html';
            } catch (error) {
                console.error('Logout error:', error);
                alert('An error occurred during logout. Please try again.');
            }
        }
    });
    
    // Add booking button
    document.getElementById('addBookingBtn')?.addEventListener('click', () => {
        // Reset form to create mode
        const form = document.getElementById('addBookingForm');
        const modal = document.getElementById('bookingModal');
        const title = modal.querySelector('h3');
        const submitBtn = form.querySelector('button[type="submit"]');
        
        form.reset();
        delete form.dataset.bookingId;
        title.textContent = 'Add New Booking';
        submitBtn.textContent = 'Create Booking';
        
        document.getElementById('bookingModal').style.display = 'block';
    });
    
    // Close booking modal
    document.querySelector('#bookingModal .close')?.addEventListener('click', () => {
        document.getElementById('bookingModal').style.display = 'none';
    });
    
    document.getElementById('cancelBookingBtn')?.addEventListener('click', () => {
        document.getElementById('bookingModal').style.display = 'none';
    });
    
    // Booking form submit
    document.getElementById('addBookingForm')?.addEventListener('submit', handleAddBooking);
    
    // Update available rooms when dates change
    document.getElementById('checkInInput')?.addEventListener('change', updateAvailableRooms);
    document.getElementById('checkOutInput')?.addEventListener('change', updateAvailableRooms);
    
    // Add account button
    document.getElementById('addAccountBtn')?.addEventListener('click', () => {
        document.getElementById('accountModal').style.display = 'block';
    });
    
    // Close account modal
    document.getElementById('closeAccountModal')?.addEventListener('click', () => {
        document.getElementById('accountModal').style.display = 'none';
    });
    
    document.getElementById('cancelAccountBtn')?.addEventListener('click', () => {
        document.getElementById('accountModal').style.display = 'none';
    });
    
    // Account form submit
    document.getElementById('addAccountForm')?.addEventListener('submit', handleAddAccount);
    
    // Booking filter
    document.getElementById('bookingStatusFilter')?.addEventListener('change', (e) => {
        filterBookings(e.target.value);
    });
    
    // Close booking details modal
    document.getElementById('closeBookingDetails')?.addEventListener('click', () => {
        document.getElementById('bookingDetailsModal').style.display = 'none';
    });
    
    document.getElementById('closeDetailsBtn')?.addEventListener('click', () => {
        document.getElementById('bookingDetailsModal').style.display = 'none';
    });
    
    // Chart period buttons
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active class from all buttons
            document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            e.target.classList.add('active');
            // Update chart
            currentPeriod = e.target.dataset.period;
            updateSalesChart();
        });
    });
}

// Switch view
function switchView(viewName) {
    currentView = viewName;
    
    // Stop real-time updates for previous view
    stopAuditLogsRealTime();
    
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
    
    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`${viewName}-view`).classList.add('active');
    
    // Load view-specific data
    if (viewName === 'bookings') {
        renderBookings();
    } else if (viewName === 'rooms') {
        renderRooms();
    } else if (viewName === 'staff') {
        loadStaff();
    } else if (viewName === 'audit') {
        loadAuditLogs();
        startAuditLogsRealTime();
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        const [statsRes, bookingsRes] = await Promise.all([
            fetch('/api/dashboard/stats', { credentials: 'include' }),
            fetch('/api/bookings', { credentials: 'include' })
        ]);
        
        // Check response status before parsing JSON
        if (!statsRes.ok) {
            console.error('Failed to load dashboard stats:', statsRes.status, statsRes.statusText);
            const errorData = await statsRes.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Stats error details:', errorData);
        }
        
        if (!bookingsRes.ok) {
            console.error('Failed to load bookings:', bookingsRes.status, bookingsRes.statusText);
            const errorData = await bookingsRes.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Bookings error details:', errorData);
            
            // Show user-friendly error message
            const errorMsg = errorData.error || `Failed to load bookings (${bookingsRes.status})`;
            alert(errorMsg);
            
            // Set empty bookings to prevent rendering errors
            bookings = [];
            updateOverview();
            renderBookings();
            
            // Try to update chart if it exists, otherwise skip chart initialization on error
            try {
                if (salesChart) {
                    updateSalesChart();
                }
            } catch (chartError) {
                console.error('Error updating chart (non-fatal):', chartError);
            }
            return;
        }
        
        stats = await statsRes.json().catch(() => ({}));
        const bookingsData = await bookingsRes.json().catch(() => ({ bookings: [] }));
        
        // Handle new structure with nested packages, users, booking_items
        bookings = bookingsData.bookings || [];
        
        console.log(`Loaded ${bookings.length} bookings successfully`);
        
        // Update UI with loaded data
        updateOverview();
        renderBookings();
        
        // Initialize/update chart - wrap in try-catch so chart errors don't affect bookings display
        try {
            // If chart exists, just update it; otherwise initialize it
            if (salesChart) {
                updateSalesChart();
            } else {
                initializeSalesChart();
            }
        } catch (chartError) {
            console.error('Error with sales chart (non-fatal):', chartError);
            // Chart errors should not clear bookings - just log and continue
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        alert('Failed to load dashboard data. Please refresh the page.');
        // Only clear bookings if it's a data loading error, not a chart error
        bookings = [];
        renderBookings();
    }
}

// Update overview stats
function updateOverview() {
    document.getElementById('totalBookings').textContent = stats.totalBookings || 0;
    document.getElementById('occupancyRate').textContent = `${stats.occupancyRate || 0}%`;
    document.getElementById('dailyRevenue').textContent = stats.dailyRevenue || 0;
    document.getElementById('pendingBookings').textContent = stats.pendingBookings || 0;
    
    // Show recent bookings
    const recentBookings = bookings.slice(0, 5);
    renderRecentBookings(recentBookings);
}

// Render recent bookings
function renderRecentBookings(bookings) {
    const container = document.getElementById('recentBookingsTable');
    if (!container) return;
    
    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Guest</th>
                    <th>Package</th>
                    <th>Check-in</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${bookings.map(b => {
                    const userName = b.users?.full_name || b.users?.first_name + ' ' + b.users?.last_name || b.guest_name || 'Guest';
                    const packageName = b.packages?.title || b.room_type || 'Package';
                    return `
                    <tr>
                        <td>${userName}</td>
                        <td>${packageName}</td>
                        <td>${formatDate(b.check_in)}</td>
                        <td><span class="status-badge status-${b.status}">${b.status}</span></td>
                    </tr>
                `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// Render bookings
function renderBookings(filteredBookings = bookings) {
    const tbody = document.getElementById('bookingsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = filteredBookings.map(booking => {
        // Get user info from nested users object or fallback to legacy fields
        const userName = booking.users?.full_name || booking.users?.first_name + ' ' + booking.users?.last_name || booking.guest_name || 'Guest';
        const userEmail = booking.users?.email || booking.guest_email || 'N/A';
        const userPhone = booking.contact_number || booking.guest_phone || 'N/A';
        
        // Get package info from nested packages object or fallback to legacy fields
        const packageName = booking.packages?.title || booking.room_type || 'Package';
        
        // Get guest count from guests JSONB or legacy fields
        const guestsObj = booking.guests || {};
        const guestCount = (guestsObj.adults || 0) + (guestsObj.children || 0) || booking.guest_count || 1;
        
        // Get booking items count
        const itemsCount = booking.booking_items?.length || 0;
        const itemsBadge = itemsCount > 0 ? `<span class="badge" title="${itemsCount} item(s)">${itemsCount}</span>` : '';
        
        return `
            <tr>
                <td>${userName}</td>
                <td>${userEmail}<br><small>${userPhone}</small></td>
                <td>${packageName} ${itemsBadge}</td>
                <td>${guestsObj.adults || 0} adults, ${guestsObj.children || 0} kids</td>
                <td>${formatDate(booking.check_in)}</td>
                <td>${formatDate(booking.check_out)}</td>
                <td><span class="status-badge status-${booking.status}">${booking.status}</span></td>
                <td>
                    <button class="btn btn-small btn-secondary" onclick="viewBooking('${booking.id}')">View</button>
                    <button class="btn btn-small btn-warning" onclick="editBooking('${booking.id}')" title="Edit Booking">
                        <span style="font-size: 14px;"></span> Edit
                    </button>
                    <button class="btn btn-small btn-success" onclick="approveBooking('${booking.id}')">Approve</button>
                    <button class="btn btn-small btn-danger" onclick="deleteBooking('${booking.id}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Filter bookings
function filterBookings(status) {
    if (status === 'all') {
        renderBookings(bookings);
    } else {
        const filtered = bookings.filter(b => b.status === status);
        renderBookings(filtered);
    }
}

// Update available rooms based on selected dates - fetch from API
async function updateAvailableRooms() {
    const checkInInput = document.getElementById('checkInInput');
    const checkOutInput = document.getElementById('checkOutInput');
    const roomTypeSelect = document.getElementById('roomTypeSelect');
    
    if (!checkInInput || !checkOutInput || !roomTypeSelect) return;
    
    const checkIn = checkInInput.value;
    const checkOut = checkOutInput.value;
    
    if (!checkIn || !checkOut) {
        // Reset to default if dates not selected
        roomTypeSelect.innerHTML = `
            <option value="">Select Room Type</option>
            <option value="standard">Standard</option>
            <option value="deluxe">Deluxe</option>
            <option value="suite">Suite</option>
        `;
        return;
    }
    
    try {
        // Fetch availability from API
        const response = await fetch(`/api/rooms/availability?check_in=${checkIn}&check_out=${checkOut}`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to fetch availability');
        
        const data = await response.json();
        const availability = data.availability || {};
        
        // Get all room types dynamically from availability data
        const roomTypes = Object.keys(availability).sort();
        const roomTypeLabels = {};
        roomTypes.forEach(type => {
            // Capitalize first letter of each word
            roomTypeLabels[type] = type.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
        });
        
        // Build options with availability info
        const availableRooms = [];
        roomTypes.forEach(type => {
            const avail = availability[type] || { total: 0, occupied: 0, available: 0 };
            const label = roomTypeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1);
            
            if (avail.available > 0) {
                availableRooms.push(`<option value="${type}">${label} (${avail.available} of ${avail.total} available)</option>`);
            } else if (avail.total > 0) {
                availableRooms.push(`<option value="${type}" disabled>${label} (Fully Booked - ${avail.total} rooms)</option>`);
            } else {
                // Only show room types that exist in the database
                // Skip types with 0 total (they don't exist)
            }
        });
        
        // Update select
        const currentValue = roomTypeSelect.value;
        roomTypeSelect.innerHTML = '<option value="">Select Room Type</option>' + availableRooms.join('');
        
        // Restore previous selection if still available
        if (currentValue && roomTypeSelect.querySelector(`option[value="${currentValue}"]:not([disabled])`)) {
            roomTypeSelect.value = currentValue;
        }
    } catch (error) {
        console.error('Error updating available rooms:', error);
        // Fallback: show Standard (since that's the only room type)
        roomTypeSelect.innerHTML = `
            <option value="">Select Room Type</option>
            <option value="standard">Standard</option>
        `;
    }
}

// Edit booking
async function editBooking(bookingId) {
    try {
        const response = await fetch(`/api/bookings/${bookingId}`, {
            credentials: 'include'
        });
        if (!response.ok) {
            alert('Failed to load booking details');
            return;
        }
        
        const data = await response.json();
        const booking = data.booking;
        
        // Get user info from nested users object or fallback to legacy fields
        const userName = booking.users?.full_name || booking.users?.first_name + ' ' + booking.users?.last_name || booking.guest_name || '';
        const userEmail = booking.users?.email || booking.guest_email || '';
        const userPhone = booking.contact_number || booking.guest_phone || '';
        
        // Get guest info from guests JSONB or legacy fields
        const guestsObj = booking.guests || {};
        const adults = guestsObj.adults || booking.adults || 0;
        const kids = guestsObj.children || booking.kids || 0;
        
        // Get package/room type (for legacy form compatibility)
        const roomType = booking.packages?.title || booking.room_type || '';
        
        // Populate form with booking data (using legacy fields for backward compatibility)
        const nameField = document.querySelector('input[name="guest_name"]');
        const emailField = document.querySelector('input[name="guest_email"]');
        const phoneField = document.querySelector('input[name="guest_phone"]');
        
        if (nameField) nameField.value = userName;
        if (emailField) emailField.value = userEmail;
        if (phoneField) phoneField.value = userPhone;
        
        const adultsField = document.querySelector('input[name="adults"]');
        const kidsField = document.querySelector('input[name="kids"]');
        if (adultsField) adultsField.value = adults;
        if (kidsField) kidsField.value = kids;
        
        const visitTimeField = document.querySelector('select[name="visit_time"]');
        const roomTypeField = document.querySelector('select[name="room_type"]');
        const cottageField = document.querySelector('select[name="cottage"]');
        const checkInField = document.querySelector('input[name="check_in"]');
        const checkOutField = document.querySelector('input[name="check_out"]');
        const bookingTimeField = document.querySelector('input[name="booking_time"]');
        const statusField = document.querySelector('select[name="status"]');
        
        if (visitTimeField) visitTimeField.value = booking.visit_time || '';
        if (roomTypeField) roomTypeField.value = roomType; // Note: This is package title, may need package_id lookup
        if (cottageField) cottageField.value = booking.cottage || '';
        if (checkInField) checkInField.value = booking.check_in ? booking.check_in.split('T')[0] : '';
        if (checkOutField) checkOutField.value = booking.check_out ? booking.check_out.split('T')[0] : '';
        if (bookingTimeField) bookingTimeField.value = booking.booking_time || '';
        if (statusField) statusField.value = booking.status || 'pending';
        
        // Store original package_id if available for proper updates
        const form = document.getElementById('addBookingForm');
        if (form && booking.package_id) {
            form.dataset.packageId = booking.package_id;
        }
        if (form && booking.user_id) {
            form.dataset.userId = booking.user_id;
        }
        
        // Update modal title and form
        const modal = document.getElementById('bookingModal');
        const title = modal.querySelector('h3');
        const submitBtn = form.querySelector('button[type="submit"]');
        
        title.textContent = 'Edit Booking';
        submitBtn.textContent = 'Update Booking';
        
        // Store booking ID for update
        form.dataset.bookingId = bookingId;
        
        // Update available rooms
        updateAvailableRooms();
        
        // Show modal
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error loading booking:', error);
        alert('Failed to load booking details');
    }
}

// Handle add booking
async function handleAddBooking(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const adults = parseInt(formData.get('adults')) || 0;
    const kids = parseInt(formData.get('kids')) || 0;
    const visitTime = formData.get('visit_time');
    const cottage = formData.get('cottage');
    
    // Calculate entrance fees
    const adultPrice = visitTime === 'morning' ? 70 : visitTime === 'night' ? 120 : 0;
    const kidPrice = visitTime === 'morning' ? 60 : visitTime === 'night' ? 100 : 0;
    const entranceFee = (adults * adultPrice) + (kids * kidPrice);
    
    // Calculate cottage fee
    const cottagePrices = {
        'tropahan': 300,
        'barkads': 400,
        'family': 500
    };
    const cottageFee = cottage ? (cottagePrices[cottage] || 0) : 0;
    
    // Calculate total guest count (adults + kids)
    const guestCount = adults + kids;
    
    const bookingTime = formData.get('booking_time');
    
    // Build booking data - backend handles conversion from legacy to unified structure
    const bookingData = {
        // Legacy fields (for backward compatibility - backend converts these)
        guest_name: formData.get('guest_name'),
        guest_email: formData.get('guest_email'),
        guest_phone: formData.get('guest_phone'),
        room_type: formData.get('room_type'),
        adults: adults,
        kids: kids,
        visit_time: visitTime,
        cottage: cottage || null,
        entrance_fee: entranceFee,
        booking_time: bookingTime,
        cottage_fee: cottageFee,
        guest_count: guestCount,
        check_in: formData.get('check_in'),
        check_out: formData.get('check_out'),
        status: formData.get('status')
    };
    
    // If editing, include package_id and user_id if available
    const bookingId = e.target.dataset.bookingId;
    if (bookingId) {
        if (e.target.dataset.packageId) {
            bookingData.package_id = parseInt(e.target.dataset.packageId);
        }
        if (e.target.dataset.userId) {
            bookingData.user_id = e.target.dataset.userId;
        }
    }
    
    try {
        const url = bookingId ? `/api/bookings/${bookingId}` : '/api/bookings';
        const method = bookingId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(bookingData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            alert(error.error || `Failed to ${bookingId ? 'update' : 'create'} booking`);
            return;
        }
        
        // Reset form and modal
        document.getElementById('bookingModal').style.display = 'none';
        const form = document.getElementById('addBookingForm');
        form.reset();
        delete form.dataset.bookingId;
        
        // Reset modal title and button
        const modal = document.getElementById('bookingModal');
        const title = modal.querySelector('h3');
        const submitBtn = form.querySelector('button[type="submit"]');
        title.textContent = 'Add New Booking';
        submitBtn.textContent = 'Create Booking';
        
        loadDashboardData();
        alert(`Booking ${bookingId ? 'updated' : 'created'} successfully!`);
    } catch (error) {
        console.error(`Error ${e.target.dataset.bookingId ? 'updating' : 'creating'} booking:`, error);
        alert('An error occurred');
    }
}

// Approve booking
async function approveBooking(bookingId) {
    try {
        const response = await fetch(`/api/bookings/${bookingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: 'confirmed' })
        });
        
        if (response.ok) {
            loadDashboardData();
        }
    } catch (error) {
        console.error('Error approving booking:', error);
    }
}

// Delete booking
async function deleteBooking(bookingId) {
    if (!confirm('Are you sure you want to delete this booking?')) return;
    
    try {
        const response = await fetch(`/api/bookings/${bookingId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            loadDashboardData();
        }
    } catch (error) {
        console.error('Error deleting booking:', error);
    }
}

// View booking details
async function viewBooking(bookingId) {
    // Try to find booking in cache, otherwise fetch it
    let booking = bookings.find(b => b.id == bookingId);
    
    if (!booking) {
        // Fetch booking if not in cache
        try {
            const response = await fetch(`/api/bookings/${bookingId}`, { credentials: 'include' });
            const data = await response.json();
            booking = data.booking;
        } catch (error) {
            console.error('Error fetching booking:', error);
            alert('Failed to load booking details');
            return;
        }
    }
    
    if (!booking) return;
    
    // Get user info from nested users object or fallback to legacy fields
    const userName = booking.users?.full_name || booking.users?.first_name + ' ' + booking.users?.last_name || booking.guest_name || 'Guest';
    const userEmail = booking.users?.email || booking.guest_email || 'N/A';
    const userPhone = booking.contact_number || booking.guest_phone || 'N/A';
    
    // Get package info from nested packages object or fallback to legacy fields
    const packageName = booking.packages?.title || booking.room_type || 'Package';
    const packageCategory = booking.packages?.category || 'N/A';
    
    // Get guest info from guests JSONB or legacy fields
    const guestsObj = booking.guests || {};
    const adults = guestsObj.adults || booking.adults || 0;
    const kids = guestsObj.children || booking.kids || 0;
    const totalGuests = adults + kids;
    
    const entranceFee = booking.entrance_fee || 0;
    const cottageFee = booking.cottage_fee || 0;
    const visitTime = booking.visit_time || null;
    const bookingTime = booking.booking_time || null;
    
    let totalCost = booking.total_cost || (entranceFee + cottageFee);
    
    // Render booking items
    let bookingItemsHtml = '';
    if (booking.booking_items && booking.booking_items.length > 0) {
        bookingItemsHtml = `
        <div class="details-group">
            <strong>Booking Items:</strong>
            <table style="width: 100%; margin-top: 10px; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Type</th>
                        <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Item</th>
                        <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Guest Name</th>
                        <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Adults</th>
                        <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Children</th>
                        <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${booking.booking_items.map(item => `
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd;">${item.item_type || 'N/A'}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${item.item_id || 'N/A'}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${item.guest_name || '-'}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${item.adults || 0}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${item.children || 0}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${item.usage_date ? formatDate(item.usage_date) : '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        `;
    }
    
    // Function hall metadata
    let functionHallHtml = '';
    if (booking.function_hall_metadata) {
        const fh = booking.function_hall_metadata;
        functionHallHtml = `
        <div class="details-group">
            <strong>Function Hall Details:</strong>
            ${fh.event_name ? `<p>Event: ${fh.event_name}</p>` : ''}
            ${fh.event_type ? `<p>Event Type: ${fh.event_type}</p>` : ''}
            ${fh.setup_type ? `<p>Setup: ${fh.setup_type}</p>` : ''}
            ${fh.start_time && fh.end_time ? `<p>Time: ${fh.start_time} - ${fh.end_time}</p>` : ''}
        </div>
        `;
    }
    
    document.getElementById('bookingDetailsContent').innerHTML = `
        <div class="details-group">
            <strong>Guest Information:</strong>
            <p>Name: ${userName}</p>
            <p>Email: ${userEmail}</p>
            <p>Phone: ${userPhone}</p>
        </div>
        <div class="details-group">
            <strong>Booking Information:</strong>
            <p>Package: ${packageName} (${packageCategory})</p>
            <p>Total Guests: ${totalGuests} (${adults} Adult(s), ${kids} Kid(s))</p>
            ${visitTime ? `<p>Visit Time: ${visitTime.charAt(0).toUpperCase() + visitTime.slice(1)}</p>` : ''}
            <p>Check-in: ${formatDate(booking.check_in)}</p>
            <p>Check-out: ${formatDate(booking.check_out)}</p>
            ${bookingTime ? `<p>Booking Time: ${bookingTime}</p>` : ''}
            <p>Status: <span class="status-badge status-${booking.status}">${booking.status}</span></p>
            ${booking.special_requests ? `<p>Special Requests: ${booking.special_requests}</p>` : ''}
        </div>
        ${bookingItemsHtml}
        ${functionHallHtml}
        ${totalCost > 0 ? `
        <div class="details-group">
            <strong>Cost Breakdown:</strong>
            ${entranceFee > 0 ? `<p>Entrance Fee: ₱${entranceFee.toFixed(2)}</p>` : ''}
            ${cottageFee > 0 ? `<p>Cottage Fee: ₱${cottageFee.toFixed(2)}</p>` : ''}
            <p><strong>Total: ₱${totalCost.toFixed(2)}</strong></p>
        </div>
        ` : ''}
    `;
    
    document.getElementById('bookingDetailsModal').style.display = 'block';
}

// Render rooms - static room management view
function renderRooms() {
    const container = document.getElementById('standard-rooms');
    if (!container) return;
    
    // Show a simple message for room management
    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <h3 style="color: #333; margin-bottom: 15px;">Room Management</h3>
            <p style="color: #666; margin-bottom: 20px;">
                Room management features are coming soon. 
                You can manage bookings through the Bookings section.
            </p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; max-width: 500px; margin: 0 auto;">
                <p style="font-size: 14px; color: #333; margin: 0;">
                    📋 Use the Bookings view to manage reservations and view room availability.
                </p>
            </div>
        </div>
    `;
}

// Load staff data
async function loadStaff() {
    const tbody = document.getElementById('staffTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading staff...</td></tr>';
    
    try {
        const response = await fetch('/api/users', { credentials: 'include' });
        const data = await response.json();
        const users = data.users || [];
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No staff members found. Register staff accounts to see them here.</td></tr>';
            return;
        }
        
        // Get current user ID to prevent self-deletion
        let currentUserId = null;
        try {
            const userResponse = await fetch('/api/me', { credentials: 'include' });
            const userData = await userResponse.json();
            if (userData.user) currentUserId = userData.user.id;
        } catch (e) {}
        
        // Count active admins
        const activeAdmins = users.filter(u => u.role === 'admin' && u.is_active).length;
        
        tbody.innerHTML = users.map(user => {
            const canDelete = (user.id !== currentUserId) && 
                             (user.role !== 'admin' || activeAdmins > 1);
            
            return `
                <tr>
                    <td>${user.full_name}</td>
                    <td>${user.email}</td>
                    <td><span class="status-badge ${user.role === 'admin' ? 'status-confirmed' : ''}">${user.role}</span></td>
                    <td><span class="status-badge ${user.is_active ? 'status-confirmed' : 'status-cancelled'}">${user.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>${user.last_login ? formatDate(user.last_login) : 'Never'}</td>
                    <td>
                        ${canDelete ? `
                            <button class="btn btn-small btn-danger" onclick="deleteAccount('${user.id}', '${user.full_name.replace(/'/g, "\\'")}')">Delete</button>
                        ` : '<small style="color: #999;">Protected</small>'}
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading staff:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Error loading staff data</td></tr>';
    }
}

// Load audit logs
async function loadAuditLogs() {
    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading audit logs...</td></tr>';
    
    try {
        const response = await fetch('/api/audit-logs', { credentials: 'include' });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const logs = data.logs || [];
        
        console.log('Audit logs loaded:', logs.length);
        
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px;">No audit logs found. Logs will appear here as actions are performed.</td></tr>';
            return;
        }
        
        tbody.innerHTML = logs.map(log => {
            // Extract role from new_values if available, otherwise use action details
            const role = log.new_values?.role || (log.action.includes('admin') ? 'admin' : 'staff');
            const details = log.new_values?.details || log.action;
            
            return `
                <tr>
                    <td>${formatDateTime(log.created_at)}</td>
                    <td>${log.user?.full_name || 'System'}</td>
                    <td><span class="status-badge ${role === 'admin' ? 'status-confirmed' : ''}">${role}</span></td>
                    <td>${log.action}</td>
                    <td>${details}</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading audit logs:', error);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px;">Error loading audit logs: ${error.message}</td></tr>`;
    }
}

// Real-time audit logs refresh
let auditLogsInterval;

function startAuditLogsRealTime() {
    // Clear any existing interval
    if (auditLogsInterval) {
        clearInterval(auditLogsInterval);
    }
    
    // Refresh audit logs every 5 seconds
    auditLogsInterval = setInterval(() => {
        if (currentView === 'audit') {
            loadAuditLogs();
        }
    }, 5000);
}

function stopAuditLogsRealTime() {
    if (auditLogsInterval) {
        clearInterval(auditLogsInterval);
        auditLogsInterval = null;
    }
}

// Setup inactivity timer
let inactivityTimer;
function setupInactivityTimer() {
    const inactivityPeriod = 30 * 60 * 1000; // 30 minutes
    
    function resetTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            alert('Session expired due to inactivity. Please login again.');
            fetch('/api/logout', { method: 'POST' });
            window.location.href = '/login.html';
        }, inactivityPeriod);
    }
    
    // Reset timer on user activity
    ['mousedown', 'keypress', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, resetTimer, true);
    });
    
    resetTimer();
}

// Handle add account
async function handleAddAccount(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    const errorDiv = document.getElementById('accountErrorMessage');
    const successDiv = document.getElementById('accountSuccessMessage');
    
    errorDiv.textContent = '';
    successDiv.textContent = '';
    
    // Validate passwords match
    if (password !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match';
        return;
    }
    
    // Validate password strength
    if (password.length < 6) {
        errorDiv.textContent = 'Password must be at least 6 characters';
        return;
    }
    
    const accountData = {
        email: formData.get('email'),
        password: password,
        full_name: formData.get('full_name'),
        role: formData.get('role')
    };
    
    try {
        const response = await fetch('/api/users/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(accountData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            errorDiv.textContent = data.error || 'Failed to create account';
            return;
        }
        
        successDiv.textContent = 'Account created successfully!';
        
        // Clear form and reload staff list
        document.getElementById('addAccountForm').reset();
        setTimeout(() => {
            document.getElementById('accountModal').style.display = 'none';
            loadStaff();
        }, 1500);
    } catch (error) {
        console.error('Error creating account:', error);
        errorDiv.textContent = 'An error occurred';
    }
}

// Delete account
async function deleteAccount(userId, userName) {
    if (!confirm(`Are you sure you want to delete account for ${userName}? This action cannot be undone.`)) return;
    
    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            const data = await response.json();
            alert(data.error || 'Failed to delete account');
            return;
        }
        
        alert('Account deleted successfully');
        loadStaff();
    } catch (error) {
        console.error('Error deleting account:', error);
        alert('Failed to delete account');
    }
}

// Toggle password visibility
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    const eyeIcon = button.querySelector('.eye-icon');
    
    if (input.type === 'password') {
        input.type = 'text';
        // Eye closed/off icon
        eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        input.type = 'password';
        // Eye open icon
        eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Initialize sales chart
function initializeSalesChart() {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;
    
    // If chart already exists, destroy it before creating a new one
    if (salesChart) {
        try {
            salesChart.destroy();
        } catch (error) {
            console.warn('Error destroying existing chart:', error);
        }
        salesChart = null;
    }
    
    // Create new chart instance
    try {
        salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Revenue (₱)',
                    data: [],
                    borderColor: '#4e8fff',
                    backgroundColor: 'rgba(78, 143, 255, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₱' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
        
        updateSalesChart();
    } catch (error) {
        console.error('Error initializing sales chart:', error);
        salesChart = null;
    }
}

// Update sales chart based on period
function updateSalesChart() {
    if (!salesChart) return;
    
    const data = getSalesData(currentPeriod);
    salesChart.data.labels = data.labels;
    salesChart.data.datasets[0].data = data.revenue;
    salesChart.update();
}

// Get sales data for different periods
function getSalesData(period) {
    // Pricing for different room types
    const roomPrices = {
        'standard': 1500,
        'deluxe': 2500,
        'suite': 4000
    };
    
    // Get confirmed bookings only
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
    
    let labels = [];
    let revenue = [];
    
    if (period === 'daily') {
        // Last 7 days
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            // Get bookings that were checked in on this date
            const dayBookings = confirmedBookings.filter(b => b.check_in === dateStr);
            const dayRevenue = dayBookings.reduce((sum, b) => {
                const price = roomPrices[b.room_type] || 0;
                const nights = Math.ceil((new Date(b.check_out) - new Date(b.check_in)) / (1000 * 60 * 60 * 24));
                const extraCharge = b.extra_guest_charge || 0;
                const entranceFee = b.entrance_fee || 0;
                const cottageFee = b.cottage_fee || 0;
                return sum + (price * nights) + extraCharge + entranceFee + cottageFee;
            }, 0);
            
            labels.push(dateLabel);
            revenue.push(dayRevenue);
        }
    } else if (period === 'weekly') {
        // Last 7 weeks
        for (let i = 6; i >= 0; i--) {
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - (i * 7));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            
            const weekBookings = confirmedBookings.filter(b => {
                const checkIn = new Date(b.check_in);
                return checkIn >= weekStart && checkIn <= weekEnd;
            });
            
            const weekRevenue = weekBookings.reduce((sum, b) => {
                const price = roomPrices[b.room_type] || 0;
                const nights = Math.ceil((new Date(b.check_out) - new Date(b.check_in)) / (1000 * 60 * 60 * 24));
                const extraCharge = b.extra_guest_charge || 0;
                const entranceFee = b.entrance_fee || 0;
                const cottageFee = b.cottage_fee || 0;
                return sum + (price * nights) + extraCharge + entranceFee + cottageFee;
            }, 0);
            
            labels.push(`Week ${7-i}`);
            revenue.push(weekRevenue);
        }
    } else if (period === 'monthly') {
        // Last 7 months
        for (let i = 6; i >= 0; i--) {
            const month = new Date();
            month.setMonth(month.getMonth() - i);
            const monthLabel = month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            
            const monthBookings = confirmedBookings.filter(b => {
                const checkIn = new Date(b.check_in);
                return checkIn.getMonth() === month.getMonth() && 
                       checkIn.getFullYear() === month.getFullYear();
            });
            
            const monthRevenue = monthBookings.reduce((sum, b) => {
                const price = roomPrices[b.room_type] || 0;
                const nights = Math.ceil((new Date(b.check_out) - new Date(b.check_in)) / (1000 * 60 * 60 * 24));
                const extraCharge = b.extra_guest_charge || 0;
                const entranceFee = b.entrance_fee || 0;
                const cottageFee = b.cottage_fee || 0;
                return sum + (price * nights) + extraCharge + entranceFee + cottageFee;
            }, 0);
            
            labels.push(monthLabel);
            revenue.push(monthRevenue);
        }
    }
    
    return { labels, revenue };
}

// Set date inputs to today's date
window.addEventListener('load', () => {
    const today = new Date().toISOString().split('T')[0];
    const checkInInput = document.querySelector('input[name="check_in"]');
    if (checkInInput) {
        checkInInput.min = today;
    }
    const checkOutInput = document.querySelector('input[name="check_out"]');
    if (checkOutInput) {
        checkOutInput.min = today;
    }
});
