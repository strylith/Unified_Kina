# Payment Gateway Integration Guide

## Overview
Yes, you can absolutely integrate real payment gateways! The system already sends email receipts with payment links. This guide shows how to integrate real payment processing.

## Current Flow
1. ✅ Booking created → Email receipt sent with "Pay Now" link
2. ✅ User clicks link → Goes to `/pay/:id` page
3. ⚠️ Currently: Demo flow (just records payment method choice)
4. ✅ Payment confirmed → Receipt email sent

## Recommended Payment Gateways for Philippines

### Option 1: PayMongo (Best for PH - supports GCash, credit cards)
- **Supports:** GCash, GrabPay, Credit Cards, PayPal
- **Perfect for:** Philippine businesses
- **Website:** https://paymongo.com
- **API Docs:** https://developers.paymongo.com

### Option 2: Stripe
- **Supports:** Credit cards, Apple Pay, Google Pay, international
- **Perfect for:** Global reach
- **Website:** https://stripe.com
- **API Docs:** https://stripe.com/docs

### Option 3: GCash Direct Integration
- **Requires:** GCash Business Account
- **More complex:** Direct API integration needed

## Implementation Steps

### Step 1: Add Payment Fields to Database
Run the migration SQL to add payment tracking fields.

### Step 2: Install Payment Gateway SDK
```bash
npm install paymongo  # For PayMongo
# OR
npm install stripe     # For Stripe
```

### Step 3: Update Environment Variables
Add your payment gateway API keys to `.env`:
```env
# PayMongo
PAYMONGO_SECRET_KEY=pk_test_xxxxx
PAYMONGO_PUBLIC_KEY=pk_test_xxxxx

# OR Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLIC_KEY=pk_test_xxxxx
```

### Step 4: Update Payment Flow
The payment page will:
1. Create payment intent with gateway
2. Redirect to gateway checkout (or embed form)
3. Handle webhook callback for payment confirmation
4. Update booking status and send receipt

## Architecture

```
Booking Email Receipt
    ↓
User clicks "Pay Now" link
    ↓
Payment Page (/pay/:id)
    ↓
Create Payment Intent (Gateway API)
    ↓
Gateway Checkout (GCash/Stripe/etc)
    ↓
Payment Success → Webhook → Update Database → Send Receipt
```

## Files to Update

1. **Database Migration:** `migration-add-payment-fields.sql`
2. **Server Routes:** `server.js` (payment endpoints)
3. **Payment Page:** Update `/pay/:id` route
4. **Webhook Handler:** New route for payment callbacks


