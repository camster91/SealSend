# SealSend Test Scripts

This directory contains test scripts for verifying email and SMS functionality.

## 📋 Prerequisites

All test scripts require your environment variables to be configured. Make sure you have:

```bash
# Required for all tests
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Required for email tests
RESEND_API_KEY=re_...
FROM_EMAIL="Seal and Send <contact@sealsend.app>"

# Required for SMS tests
TWILIO_ACCOUNT_SID=AC_...
TWILIO_AUTH_TOKEN=... # OR TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET
TWILIO_MESSAGING_SERVICE_SID=MG_... # OR TWILIO_FROM_NUMBER
```

## 📧 Email Tests

Test Resend email integration and all email templates.

```bash
npx tsx scripts/test/test-email.ts your-email@example.com
```

This will send 5 test emails:
1. Simple test email
2. Invitation email template
3. Reminder email template
4. Announcement email template
5. Invalid email handling test

**Check your inbox for all test emails!**

### Example Output

```
🧪 SealSend Email Test Suite

Testing with recipient: your@email.com

📧 Test 1: Sending simple test email...
   ✅ Sent! ID: 12345678-1234-1234-1234-123456789abc

📧 Test 2: Testing invitation email template...
   ✅ Sent! Subject: You're Invited: Test Birthday Party
   ID: 87654321-4321-4321-4321-cba987654321

...

📊 Test Summary

✅ Simple Test Email
✅ Invitation Email Template
✅ Reminder Email Template
✅ Announcement Email Template
✅ Invalid Email Handling

5/5 tests passed
🎉 All tests passed!
```

## 📱 SMS Tests

Test Twilio SMS integration and all SMS templates.

```bash
# US number example
npx tsx scripts/test/test-sms.ts +15551234567

# International number example
npx tsx scripts/test/test-sms.ts +447123456789
```

This will:
1. Validate the phone number
2. Initialize Twilio client
3. Send simple test SMS
4. Test invitation SMS template
5. Test reminder SMS template
6. Test announcement SMS template
7. Test invalid phone handling
8. Check character limits

**Check your phone for all test messages!**

### Example Output

```
🧪 SealSend SMS Test Suite

Testing with phone: +15551234567

✅ Twilio configuration found

📱 Test 1: Phone number validation...
   ✅ Valid!
   Original: +15551234567
   Formatted: +15551234567
   Country: US

📱 Test 2: Twilio client initialization...
   Using Auth Token authentication
   Send options: {"messagingServiceSid":"MG_..."}
   ✅ Client initialized

📱 Test 3: Sending simple test SMS...
   ✅ Sent!
   SID: SM1234567890abcdef1234567890abcdef
   Status: queued

...

📊 Test Summary

✅ Phone Validation
✅ Twilio Client Initialization
✅ Simple Test SMS
✅ Invitation SMS Template
✅ Reminder SMS Template
✅ Announcement SMS Template
✅ Invalid Phone Handling
✅ Character Limit Check

8/8 tests passed
🎉 All tests passed!
```

## 🔗 Integration Tests

Test the complete flow from database to delivery.

```bash
# Optional: Set a test phone number for SMS testing
export TEST_PHONE_NUMBER=+15551234567

# Run integration tests
npx tsx scripts/test/test-integration.ts
```

This will:
1. Create a test admin user (with hashed password)
2. Create a test event
3. Add RSVP fields
4. Add test guests (email, SMS, and both)
5. Send invites via the API
6. Check send_logs for delivery tracking
7. Verify guest invite status
8. **Auto-cleanup all test data**

**Note:** This requires the server to be running locally or accessible at `NEXT_PUBLIC_SITE_URL`.

### Troubleshooting Integration Tests

If the API call fails, you can still verify:
- Admin user created with hashed password
- Event created in database
- Guests added with proper invite tokens
- Send configuration is correct

The cleanup SQL will be printed at the end in case of failures.

## 🎯 What to Verify

After running tests, verify:

### Email (Resend)
- [ ] All emails arrive in inbox (check spam too)
- [ ] Email templates render correctly
- [ ] Images load in invitation template
- [ ] Links are clickable and correct
- [ ] Resend dashboard shows delivery status

### SMS (Twilio)
- [ ] All SMS messages arrive
- [ ] No encoding issues with special characters
- [ ] URLs are clickable
- [ ] Message fits in single SMS (or note segmentation)
- [ ] Twilio console shows delivery status

### Integration
- [ ] Events created in database
- [ ] Guests have invite tokens generated
- [ ] Send logs created for each send
- [ ] Guest invite_status updated correctly

## 🐛 Common Issues

### Email Tests Fail

**"RESEND_API_KEY not configured"**
```bash
export RESEND_API_KEY=re_your_actual_key_here
```

**"Email not sent"**
- Check Resend dashboard for errors
- Verify FROM_EMAIL domain is verified in Resend
- Check if recipient email is valid

### SMS Tests Fail

**"Twilio not configured"**
```bash
export TWILIO_ACCOUNT_SID=AC_...
export TWILIO_AUTH_TOKEN=...
export TWILIO_MESSAGING_SERVICE_SID=MG_...
```

**"Invalid phone number"**
- Use E.164 format: `+15551234567` (not `555-123-4567`)
- Include country code

**"Message not delivered"**
- Check Twilio console for error codes
- Verify Twilio account is not in trial mode
- Check if destination number can receive SMS

### Integration Tests Fail

**"API returned 401"**
- Server not running - start with `npm run dev`
- Session cookie not being set correctly

**"Cannot connect to server"**
- Set correct `NEXT_PUBLIC_SITE_URL`
- For local testing: `export NEXT_PUBLIC_SITE_URL=http://localhost:3000`

## 📝 Environment Variables for Testing

Create a `.env.test` file (do not commit to git):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Email
RESEND_API_KEY=re_...
FROM_EMAIL="Seal and Send <contact@sealsend.app>"

# SMS
TWILIO_ACCOUNT_SID=AC_...
TWILIO_AUTH_TOKEN=...
TWILIO_MESSAGING_SERVICE_SID=MG_...

# Optional: Test phone number
TEST_PHONE_NUMBER=+15551234567

# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Load it before running tests:
```bash
source .env.test && npx tsx scripts/test/test-email.ts your@email.com
```
