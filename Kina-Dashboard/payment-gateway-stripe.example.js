/**
 * Stripe Payment Gateway Integration Example
 * 
 * Setup:
 * 1. Install: npm install stripe
 * 2. Get API keys from https://stripe.com
 * 3. Add to .env: STRIPE_SECRET_KEY and STRIPE_PUBLIC_KEY
 * 
 * Replace the payment routes in server.js with this implementation
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ==================== STRIPE PAYMENT ROUTES ====================

// Payment page with Stripe integration
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
    
    // Convert PHP to cents (Stripe uses smallest currency unit)
    const amountInCents = Math.round(totalCost * 100);

    // Create Stripe checkout session
    const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'php',
            product_data: {
              name: `Kina Resort Booking - ${booking.room_type}`,
              description: `Booking for ${booking.guest_name} from ${new Date(booking.check_in).toLocaleDateString()} to ${new Date(booking.check_out).toLocaleDateString()}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${baseUrl}/payment-success?booking_id=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/pay/${bookingId}?t=${token}`,
        customer_email: booking.guest_email,
        metadata: {
          booking_id: bookingId,
          guest_name: booking.guest_name,
          guest_email: booking.guest_email
        }
      });

      // Store session ID in booking
      await supabase
        .from('bookings')
        .update({ 
          payment_status: 'pending',
          payment_transaction_id: session.id,
          payment_gateway: 'stripe'
        })
        .eq('id', bookingId);

      // Redirect to Stripe Checkout
      res.redirect(session.url);
      
    } catch (error) {
      console.error('Stripe checkout creation error:', error);
      res.status(500).send('<h2>Unable to initialize payment. Please try again later.</h2>');
    }
  } catch (e) {
    console.error('Render payment page error:', e);
    res.status(500).send('<h2>Unable to load payment page.</h2>');
  }
});

// Payment success callback
app.get('/payment-success', async (req, res) => {
  try {
    const { booking_id, session_id } = req.query;
    
    if (!session_id) {
      return res.send('<h2>Payment Session Not Found</h2>');
    }
    
    // Retrieve Stripe session
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    if (session.payment_status === 'paid') {
      // Get booking
      const { data: booking } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', booking_id)
        .single();
      
      if (booking) {
        const totalCost = (booking.entrance_fee || 0) + (booking.cottage_fee || 0) + (booking.extra_guest_charge || 0);
        
        // Update booking
        await supabase
          .from('bookings')
          .update({
            payment_status: 'paid',
            payment_method: 'card',
            payment_date: new Date().toISOString(),
            payment_amount: totalCost,
            status: 'confirmed',
            updated_at: new Date().toISOString()
          })
          .eq('id', booking_id);
        
        // Create payment record
        await supabase
          .from('payments')
          .insert({
            booking_id,
            amount: totalCost,
            currency: 'PHP',
            payment_method: 'card',
            payment_gateway: 'stripe',
            transaction_id: session.payment_intent,
            gateway_response: session,
            status: 'completed'
          });
        
        // Send receipt email
        await sendEmail({
          to: booking.guest_email,
          subject: 'Payment Confirmation - Kina Resort',
          html: generatePaymentReceiptHTML(booking, totalCost, 'Credit/Debit Card')
        });
      }
    }
    
    res.send(`
      <h2>✅ Payment Successful!</h2>
      <p>Your payment has been processed successfully.</p>
      ${booking ? `<p>A confirmation receipt has been sent to ${booking.guest_email}</p>` : ''}
      <p><strong>Booking ID:</strong> ${booking_id}</p>
      <p><strong>Transaction ID:</strong> ${session_id}</p>
    `);
  } catch (error) {
    console.error('Payment success handler error:', error);
    res.status(500).send('<h2>Error processing payment confirmation</h2>');
  }
});

// Stripe webhook handler (for async payment confirmations)
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingId = session.metadata?.booking_id;
    
    if (bookingId && session.payment_status === 'paid') {
      // Get booking
      const { data: booking } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();
      
      if (booking) {
        const totalCost = (booking.entrance_fee || 0) + (booking.cottage_fee || 0) + (booking.extra_guest_charge || 0);
        
        // Update booking
        await supabase
          .from('bookings')
          .update({
            payment_status: 'paid',
            payment_method: 'card',
            payment_date: new Date().toISOString(),
            payment_amount: totalCost,
            status: 'confirmed',
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId);
        
        // Create payment record
        await supabase
          .from('payments')
          .insert({
            booking_id: bookingId,
            amount: totalCost,
            currency: 'PHP',
            payment_method: 'card',
            payment_gateway: 'stripe',
            transaction_id: session.payment_intent,
            gateway_response: session,
            status: 'completed'
          });
        
        // Send receipt
        await sendEmail({
          to: booking.guest_email,
          subject: 'Payment Confirmation - Kina Resort',
          html: generatePaymentReceiptHTML(booking, totalCost, 'Credit/Debit Card')
        });
      }
    }
  }
  
  res.json({ received: true });
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
              <span><strong>${paymentMethod}</strong></span>
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



