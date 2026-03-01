# SealSend.app Coolify Deployment Guide

## ✅ GitHub Repository
- **Repo**: https://github.com/camster91/SealSend
- **Branch**: master
- **Latest Commit**: e30ad29 - Update sender email to contact@sealsend.app

## 🚀 Coolify Deployment Steps

### 1. Access Coolify Dashboard
- URL: http://187.77.26.99:8000
- Server IP: 187.77.26.99

### 2. Create/Update Application

If the SealSend app already exists:
1. Go to the application in Coolify dashboard
2. Click **Deploy** to redeploy with latest changes

If creating new:
1. Click **+ Create New Resource**
2. Select **Application**
3. Choose **GitHub** as source
4. Select repository: `camster91/SealSend`
5. Branch: `master`

### 3. Build Configuration

**Build Pack**: Dockerfile

The project includes a `Dockerfile` optimized for Next.js standalone output.

### 4. Environment Variables

**IMPORTANT**: `NEXT_PUBLIC_*` vars must be set as **Build Arguments** in Coolify
(they get baked into the client JS at build time). All other vars are **runtime**
and should be set as regular Environment Variables.

#### Build Arguments (Coolify → Settings → Build Args)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://vtbreowxqfcvwegpfnwn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0YnJlb3d4cWZjdndlZ3BmbnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDA4NTMsImV4cCI6MjA4NjQxNjg1M30.eFcnSP-sNXJq7TOsnu2bQ-hI0_-IibQZsruRNugQV3E
NEXT_PUBLIC_SITE_URL=https://sealsend.app
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your-stripe-publishable-key
```

#### Runtime Environment Variables (Coolify → Environment Variables)

```bash
# Supabase (Required - server-side)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Email - Mailgun (Required)
MAILGUN_API_KEY=your-mailgun-sending-key
MAILGUN_DOMAIN=sealsend.app
MAILGUN_URL=https://api.mailgun.net
FROM_EMAIL=SealSend <noreply@sealsend.app>

# Twilio SMS (Required for SMS features)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_API_KEY_SID=your-twilio-api-key-sid
TWILIO_API_KEY_SECRET=your-twilio-api-key-secret
TWILIO_MESSAGING_SERVICE_SID=your-twilio-messaging-service-sid

# Stripe Payments (Required for paid tiers)
STRIPE_SECRET_KEY=sk_live_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-stripe-webhook-secret
STRIPE_STANDARD_PRICE_ID=price_your-standard-price-id
STRIPE_PREMIUM_PRICE_ID=price_your-premium-price-id
```

### 5. Domain Configuration

**Domains**: `sealsend.app, www.sealsend.app`

In Coolify:
1. Go to **Domains** section
2. Add: `sealsend.app`
3. Add: `www.sealsend.app` (redirect to apex)
4. Enable **HTTPS** (Let's Encrypt)

### 6. Webhook (Auto-Deploy)

The webhook is already configured:
- **URL**: `http://187.77.26.99:8000/webhooks/source/github/x8okwogw0so8s08oss04s088`

To verify in GitHub:
1. Go to https://github.com/camster91/SealSend/settings/hooks
2. Check that webhook is active
3. Payload URL should match above

### 7. Deploy

Click **Deploy** button in Coolify dashboard.

## 🔍 Post-Deployment Checklist

- [ ] App accessible at https://sealsend.app
- [ ] HTTPS working (green lock)
- [ ] Login with email sends from contact@sealsend.app
- [ ] Stripe checkout works
- [ ] SMS reminders work (if Twilio configured)

## 🛠️ Troubleshooting

### Build Fails
Check build logs in Coolify for missing env vars or build errors.

### 500 Errors
Check that all required environment variables are set.

### Emails Not Sending
- Verify Mailgun API key and domain
- Check Mailgun dashboard for delivery logs
- Ensure `sealsend.app` domain is verified in Mailgun (DNS: SPF, DKIM, MX)

### Domain Not Working
- Check DNS A record points to 187.77.26.99
- Verify SSL certificate generated in Coolify
