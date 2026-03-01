# SealSend Testing Guide

Quick guide to testing email and SMS functionality.

## 🚀 Quick Start

### 1. Check Configuration

```bash
npm run test:config
```

This verifies all required environment variables are set.

### 2. Test Email (Mailgun)

```bash
npm run test:email -- your-email@example.com
```

You'll receive 5 test emails:
- Simple test email
- Invitation template
- Reminder template
- Announcement template
- Invalid email handling

### 3. Test SMS (Twilio)

```bash
npm run test:sms -- +15551234567
```

You'll receive:
- Simple test SMS
- Invitation SMS template
- Reminder SMS template
- Announcement SMS template

### 4. Run Everything

```bash
npm run test:all -- --all --email your@email.com --sms +15551234567
```

## 📋 Prerequisites

### Environment Variables

Create `.env.local`:

```env
# Required for all tests
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Required for email tests (Mailgun)
MAILGUN_API_KEY=key-...
MAILGUN_DOMAIN=email.sealsend.app
FROM_EMAIL="Seal and Send <noreply@email.sealsend.app>"

# Required for SMS tests (Twilio)
TWILIO_ACCOUNT_SID=AC_...
TWILIO_AUTH_TOKEN=...
TWILIO_MESSAGING_SERVICE_SID=MG_...
# OR
TWILIO_FROM_NUMBER=+15551234567
```

### Accounts

1. **Mailgun** (Email)
   - Sign up at https://mailgun.com
   - Add and verify your domain
   - Get API key starting with `key-`

2. **Twilio** (SMS)
   - Sign up at https://twilio.com
   - Get a phone number
   - Get Account SID and Auth Token
   - Set up Messaging Service (recommended)

## 🎯 What Gets Tested

### Email Tests
- ✅ Mailgun API connectivity
- ✅ All email templates render correctly
- ✅ Error handling for invalid emails
- ✅ Delivery tracking setup

### SMS Tests
- ✅ Twilio API connectivity
- ✅ Phone number validation (E.164 format)
- ✅ All SMS templates
- ✅ Character limits and segmentation
- ✅ Error handling for invalid numbers

### Integration Tests
- ✅ Database connectivity
- ✅ Password hashing
- ✅ Event creation flow
- ✅ Guest management
- ✅ Invite sending via API
- ✅ Send logging

## 🐛 Troubleshooting

### Email Not Received

```bash
# Check if Mailgun is configured
npm run test:config

# Check Mailgun dashboard for delivery status
# https://app.mailgun.com/app/logs
```

**Common issues:**
- Domain not verified in Mailgun
- Email in spam folder
- Invalid `FROM_EMAIL` format

### SMS Not Received

```bash
# Check Twilio configuration
npm run test:config

# Check Twilio console for error logs
# https://console.twilio.com
```

**Common issues:**
- Twilio account in trial mode
- Destination number can't receive SMS
- Invalid phone format (use E.164: +15551234567)
- Insufficient Twilio balance

### Integration Tests Fail

```bash
# Make sure server is running
npm run dev

# Then run tests in another terminal
npm run test:integration
```

## 📊 Test Scripts Location

All test scripts are in `scripts/test/`:

| Script | Purpose |
|--------|---------|
| `check-config.ts` | Verify environment setup |
| `test-email.ts` | Test Mailgun email |
| `test-sms.ts` | Test Twilio SMS |
| `test-integration.ts` | Full integration test |
| `test-all.ts` | Run all tests |

## 🎉 Success Criteria

After running tests, verify:

### Email
- [ ] All 5 test emails received
- [ ] Templates look correct
- [ ] Links are clickable
- [ ] Mailgun dashboard shows "Delivered"

### SMS
- [ ] All SMS messages received
- [ ] No encoding issues
- [ ] URLs are clickable
- [ ] Twilio console shows "Delivered"

### Integration
- [ ] Events created in Supabase
- [ ] Guests have invite tokens
- [ ] Send logs populated
- [ ] No errors in console

## 📚 Next Steps

After tests pass:

1. **Configure Webhooks** (optional but recommended)
   - Mailgun: `https://yourdomain.com/api/webhooks/mailgun`
   - Twilio: `https://yourdomain.com/api/webhooks/twilio`

2. **Create Admin User**
   ```bash
   npm run create-admin -- admin@yourdomain.com "Admin Name" "SecurePassword123!"
   ```

3. **Start Development**
   ```bash
   npm run dev
   ```

4. **Deploy**
   ```bash
   npm run build
   # Deploy to Vercel/Railway/etc
   ```

## 🆘 Need Help?

- Check `scripts/test/README.md` for detailed docs
- Review error messages in test output
- Check Mailgun/Twilio dashboards for delivery status
- Verify environment variables with `npm run test:config`
