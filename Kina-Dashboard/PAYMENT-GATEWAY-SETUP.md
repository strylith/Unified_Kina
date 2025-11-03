# Quick Setup: Real Payment Gateway Integration

## ✅ Yes, You Can Integrate Real Payment Gateways!

Your system is **perfectly set up** for this. The email receipt already includes a "Pay Now" link that goes to the payment page. We just need to replace the demo flow with real payment processing.

## 🚀 Quick Start (5 Steps)

### Step 1: Run Database Migration
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `migration-add-payment-fields.sql`
3. Click "Run"

This adds payment tracking fields to your bookings table.

### Step 2: Choose Your Gateway

**For Philippines (Recommended):**
- **PayMongo** - Supports GCash, GrabPay, Credit Cards
- Get API keys from https://paymongo.com

**For International:**
- **Stripe** - Credit Cards, Apple Pay, Google Pay
- Get API keys from https://stripe.com

### Step 3: Install Payment SDK

**For PayMongo:**
```bash
npm install paymongo
```

**For Stripe:**
```bash
npm install stripe
```

### Step 4: Configure Environment Variables

Edit your `.env` file and add your gateway API keys:

```env
# For PayMongo
PAYMONGO_SECRET_KEY=pk_test_xxxxx
PAYMONGO_PUBLIC_KEY=pk_test_xxxxx
PAYMONGO_WEBHOOK_SECRET=whsec_xxxxx

# OR for Stripe
# STRIPE_SECRET_KEY=sk_test_xxxxx
# STRIPE_PUBLIC_KEY=pk_test_xxxxx
# STRIPE_WEBHOOK_SECRET=whsec_xxxxx

PUBLIC_BASE_URL=http://localhost:3000
```

### Step 5: Replace Payment Routes in server.js

**Option A: PayMongo Integration**
1. Open `payment-gateway-paymongo.example.js`
2. Copy the payment routes (everything from `// Payment page` onwards)
3. In `server.js`, find and replace the existing `/pay/:id` and `/api/payments/confirm` routes with the PayMongo implementation
4. Also add the webhook route: `/api/webhooks/paymongo`

**Option B: Stripe Integration**
1. Open `payment-gateway-stripe.example.js`
2. Copy the payment routes
3. In `server.js`, replace the existing payment routes with the Stripe implementation
4. Also add the webhook route: `/api/webhooks/stripe`

### Step 6: Set Up Webhooks (Important!)

Webhooks ensure payments are confirmed even if the user closes the browser.

**PayMongo:**
1. Go to PayMongo Dashboard → Webhooks
2. Add webhook URL: `https://yourdomain.com/api/webhooks/paymongo`
3. Select events: `payment_intent.succeeded`
4. Copy the webhook secret to `.env`

**Stripe:**
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select events: `checkout.session.completed`
4. Copy the webhook secret to `.env`

## 📧 How It Works

### Current Flow (After Integration):

```
1. Booking Created
   ↓
2. Email Receipt Sent (with "Pay Now" link)
   ↓
3. User Clicks Link → Payment Page
   ↓
4. User Selects Payment Method:
   - GCash (PayMongo)
   - Credit Card (Stripe/PayMongo)
   - GrabPay (PayMongo)
   ↓
5. Payment Processed via Gateway
   ↓
6. Payment Confirmed → Webhook Received
   ↓
7. Database Updated (payment_status = 'paid')
   ↓
8. Confirmation Email Sent to Guest
```

## 🎯 What Changes in the User Experience

**Before (Demo):**
- User clicks "Pay Now" → Selects method → Payment "confirmed" (not real)

**After (Real Gateway):**
- User clicks "Pay Now" → Redirected to GCash/Stripe checkout → Real payment → Confirmation email

## 💰 Payment Methods Available

### PayMongo (Philippines):
- ✅ GCash
- ✅ GrabPay
- ✅ Credit/Debit Cards
- ✅ PayPal

### Stripe:
- ✅ Credit/Debit Cards
- ✅ Apple Pay
- ✅ Google Pay
- ✅ Bank Transfers (some countries)

## 🧪 Testing

### Test Mode:
Both gateways provide test API keys for development:
- PayMongo: Use `pk_test_...` keys
- Stripe: Use `sk_test_...` keys

### Test Cards:
**Stripe:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`

**PayMongo:**
- Use test mode GCash flow (instructions in PayMongo docs)

## 📊 Tracking Payments

After integration, you can:
1. View payment status in bookings table
2. Check payment history in `payments` table
3. Filter by payment status in admin dashboard

## 🔒 Security Notes

1. **Never commit `.env` file** - Your API keys are sensitive
2. **Use HTTPS in production** - Required for webhooks
3. **Verify webhook signatures** - Both examples include this
4. **Store payment transaction IDs** - For refunds and disputes

## 🆘 Troubleshooting

### Payment not completing?
- Check webhook URL is accessible
- Verify webhook secret matches
- Check server logs for errors

### "Invalid payment link" error?
- Token expiration issue
- Verify `verifyPaymentToken` function

### Email not sending after payment?
- Check SMTP configuration
- Verify email logs in database

## 📝 Next Steps

1. ✅ Run database migration
2. ✅ Install gateway SDK
3. ✅ Add API keys to `.env`
4. ✅ Replace payment routes in `server.js`
5. ✅ Test with test mode
6. ✅ Set up production webhooks
7. ✅ Go live! 🚀

## Need Help?

- **PayMongo Docs:** https://developers.paymongo.com
- **Stripe Docs:** https://stripe.com/docs
- Check the example files for detailed implementation

---

**Remember:** The email receipt system is already working! You're just replacing the payment processing with real gateways. The rest of the flow (email sending, booking creation, etc.) stays the same.



