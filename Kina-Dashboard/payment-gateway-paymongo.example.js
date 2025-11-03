/**
 * PayMongo Payment Gateway Integration Example
 * 
 * Setup:
 * 1. Install: npm install paymongo
 * 2. Get API keys from https://paymongo.com
 * 3. Add to .env: PAYMONGO_SECRET_KEY and PAYMONGO_PUBLIC_KEY
 * 
 * Replace the payment routes in server.js with this implementation
 */

const { Paymongo } = require('paymongo');

// Initialize PayMongo client
const paymongo = new Paymongo(process.env.PAYMONGO_SECRET_KEY);

// ==================== PAYMONGO PAYMENT ROUTES ====================

// Payment page with PayMongo integration
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
    
    // Convert PHP to centavos (PayMongo uses smallest currency unit)
    const amountInCents = Math.round(totalCost * 100);

    // Create payment intent with PayMongo
    const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    
    try {
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

      // Store payment intent ID in booking
      await supabase
        .from('bookings')
        .update({ 
          payment_status: 'pending',
          payment_transaction_id: paymentIntent.id,
          payment_gateway: 'paymongo'
        })
        .eq('id', bookingId);

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
      const paymongo = Paymongo('${process.env.PAYMONGO_PUBLIC_KEY}');
      const elements = paymongo.elements();
      
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
          const paymentMethod = await paymongo.paymentMethods.create({
            type: paymentMethodElement.value,
          });
          
          // Attach payment method to payment intent
          const response = await fetch('/api/payments/paymongo/confirm', {
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
            window.location.href = result.redirect_url || '/payment-success?booking_id=${bookingId}';
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
      res.status(500).send('<h2>Unable to initialize payment. Please try again later.</h2>');
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
      await supabase
        .from('bookings')
        .update({
          payment_status: 'paid',
          payment_method: paymentIntent.payment_method.type,
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
          payment_method: paymentIntent.payment_method.type,
          payment_gateway: 'paymongo',
          transaction_id: paymentIntent.id,
          gateway_response: paymentIntent,
          status: 'completed'
        });
      
      // Send receipt email
      await sendEmail({
        to: booking.guest_email,
        subject: 'Payment Confirmation - Kina Resort',
        html: generatePaymentReceiptHTML(booking, totalCost, paymentIntent.payment_method.type)
      });
      
      return res.json({
        success: true,
        redirect_url: `/payment-success?booking_id=${booking_id}`
      });
    } else {
      return res.status(400).json({ error: 'Payment not completed' });
    }
  } catch (error) {
    console.error('PayMongo confirm error:', error);
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

// PayMongo webhook handler (for async payment confirmations)
app.post('/api/webhooks/paymongo', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['paymongo-signature'];
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
    
    // Verify webhook signature
    const isValid = paymongo.webhooks.verify(req.body, signature, webhookSecret);
    
    if (!isValid) {
      return res.status(400).send('Invalid signature');
    }
    
    const event = JSON.parse(req.body);
    
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data;
      const bookingId = paymentIntent.metadata?.booking_id;
      
      if (bookingId) {
        // Update booking payment status
        await supabase
          .from('bookings')
          .update({
            payment_status: 'paid',
            payment_date: new Date().toISOString(),
            status: 'confirmed'
          })
          .eq('id', bookingId);
        
        // Create payment record
        const { data: booking } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', bookingId)
          .single();
        
        if (booking) {
          const totalCost = (booking.entrance_fee || 0) + (booking.cottage_fee || 0) + (booking.extra_guest_charge || 0);
          
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
        <h2>✅ Payment Successful!</h2>
        <p>Your payment has been processed successfully.</p>
        <p>A confirmation receipt has been sent to ${booking.guest_email}</p>
        <p><strong>Booking ID:</strong> ${bookingId}</p>
      `);
    }
  }
  
  res.send('<h2>Payment Successful!</h2><p>Thank you for your payment.</p>');
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



