# SealSend - Full QA Review Report
**Date:** 2026-02-28  
**Reviewer:** AI Code Review  
**Focus Areas:** Email (Resend), SMS (Twilio), Authentication, API Routes, Frontend Screens

---

## Executive Summary

SealSend is a well-structured Next.js 16 application for event management and RSVP handling. The codebase demonstrates good architectural patterns with clear separation of concerns. However, several **critical issues** were identified in the email/SMS systems, authentication, and security areas that require immediate attention before production deployment.

### Overall Score: **B+ (Good, with Critical Issues to Fix)**

| Category | Score | Status |
|----------|-------|--------|
| Email System (Resend) | B | ⚠️ Issues Found |
| SMS System (Twilio) | B- | ⚠️ Issues Found |
| Authentication | C+ | 🔴 Critical Issues |
| API Security | B | ⚠️ Issues Found |
| Frontend | A- | ✅ Good |
| Database/Schema | A- | ✅ Good |

---

## 🔴 CRITICAL ISSUES (Fix Before Production)

### 1. **Hardcoded Admin Password in Migration** 
**File:** `supabase/migrations/20250215000000_auth_tables.sql:94-96`

```sql
-- Insert a sample admin user (password: admin123)
INSERT INTO admin_users (email, password, name) 
VALUES ('admin@example.com', 'admin123', 'Admin User')
ON CONFLICT (email) DO NOTHING;
```

**Problem:** 
- Plaintext password storage (not hashed)
- Hardcoded weak password "admin123"
- Automatically creates admin user on deployment

**Fix:**
```sql
-- Remove or hash the password properly
-- Use bcrypt or argon2 for hashing
-- Or remove entirely and require manual admin creation
```

---

### 2. **No Password Hashing in Auth System**
**File:** `supabase/migrations/20250215000000_auth_tables.sql:27-28`

```sql
password TEXT NOT NULL, -- In production, store hashed passwords
```

**Problem:** The comment acknowledges the issue but the schema still stores plaintext passwords.

**Fix:** Implement bcrypt/argon2 hashing before storing passwords.

---

### 3. **Missing Error Handling in SMS/Email Send Operations**
**File:** `src/app/api/events/[eventId]/send-invites/route.ts:122-149`

```typescript
try {
  await resend.emails.send({...});
  emailOk = true;
} catch {
  // email failed - SILENTLY SWALLOWED
}

// Same for SMS
try {
  await twilioClient.messages.create({...});
  smsOk = true;
} catch {
  // sms failed - SILENTLY SWALLOWED
}
```

**Problem:** Errors are silently caught without logging or retry logic. Failed sends are not properly tracked.

**Fix:**
```typescript
try {
  await resend.emails.send({...});
  emailOk = true;
} catch (error) {
  console.error(`Failed to send email to ${guest.email}:`, error);
  // Track specific failure reason
  failedReasons.push({ guestId: guest.id, type: 'email', error: error.message });
}
```

---

### 4. **Phone Number Validation Missing**
**Files:** Multiple files accepting phone numbers

**Problem:** No validation/normalization of phone numbers before sending to Twilio. Invalid formats will cause SMS failures.

**Fix:** Add phone number validation using `libphonenumber-js`:
```typescript
import { parsePhoneNumber } from 'libphonenumber-js';

function validatePhone(phone: string): string | null {
  try {
    const parsed = parsePhoneNumber(phone, 'US'); // or user's country
    return parsed?.format('E.164') || null;
  } catch {
    return null;
  }
}
```

---

### 5. **No Rate Limiting on Public RSVP Endpoint**
**File:** `src/app/api/rsvp/[slug]/route.ts`

**Problem:** While there's rate limiting for auth, the RSVP submission endpoint only has basic IP-based rate limiting but lacks proper protection against spam submissions.

**Fix:** Implement stricter rate limiting per event slug:
```typescript
const { success } = rateLimit(`rsvp:${slug}:${ip}`, { max: 3, windowSeconds: 3600 });
```

---

## 🟠 HIGH PRIORITY ISSUES

### 6. **Email "From" Address Not Verified**
**Files:** 
- `src/app/api/auth/send-code/route.ts:97`
- `src/app/api/events/[eventId]/send-invites/route.ts:117`

```typescript
from: 'Seal and Send <contact@sealsend.app>',
```

**Problem:** Using hardcoded "from" address. If Resend doesn't have this domain verified, emails will fail or go to spam.

**Fix:** Make configurable via environment variable with fallback:
```typescript
from: process.env.FROM_EMAIL || 'Seal and Send <noreply@sealsend.app>',
```

---

### 7. **No Email Delivery Tracking**
**Problem:** No webhook handling for email delivery status (bounces, complaints, deliveries).

**Fix:** Implement Resend webhook handler:
```typescript
// app/api/webhooks/resend/route.ts
export async function POST(request: Request) {
  const payload = await request.json();
  // Handle: email.delivered, email.bounced, email.complained
  // Update guest.invite_status accordingly
}
```

---

### 8. **Twilio Fallback Missing**
**File:** `src/app/api/auth/send-code/route.ts:117-130`

**Problem:** Only uses Messaging Service SID, no fallback to From number.

**Current Code:**
```typescript
await getTwilioClient().messages.create({
  body: `Your Seal and Send ${role} access code: ${code}. This code expires in 15 minutes.`,
  messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!,
  to: phone
});
```

**Fix:** Use the existing `getTwilioSendOptions()` helper for consistency.

---

### 9. **Session Management Issues**
**File:** `src/lib/auth/session.ts`

**Problem:** Session is read from cookie without server-side validation on every request. The cookie could be tampered with.

**Fix:** Validate session token against database:
```typescript
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('sealsend_session')?.value;
  
  if (!sessionToken) return null;
  
  // Validate against database
  const adminSupabase = createAdminClient();
  const { data: session } = await adminSupabase
    .from('user_sessions')
    .select('user_id, user_role, expires_at')
    .eq('session_token', sessionToken)
    .gt('expires_at', new Date().toISOString())
    .single();
    
  if (!session) {
    // Clear invalid cookie
    cookieStore.delete('sealsend_session');
    return null;
  }
  
  // Then parse user info
  const userCookie = cookieStore.get('sealsend_user')?.value;
  // ...
}
```

---

### 10. **No Input Sanitization on Event Customization**
**File:** `src/app/e/[slug]/page.tsx:93-106`

While there is some validation, custom CSS values could still be exploited:

```typescript
const rawBgImage = event.customization?.backgroundImage || null;
const backgroundImage = rawBgImage && /^https:\/\/[^\s"')};]+$/.test(rawBgImage) ? rawBgImage : null;
```

**Problem:** The regex allows URLs that could contain malicious content or tracking pixels.

**Fix:** Validate against allowlist of domains or use URL parsing.

---

## 🟡 MEDIUM PRIORITY ISSUES

### 11. **Mailgun vs Resend Confusion**
**Problem:** You mentioned Mailgun for email, but the codebase uses Resend exclusively.

**Clarification Needed:** 
- If using Resend: Update documentation
- If using Mailgun: Implement Mailgun client alongside or instead of Resend
- If using both: Clarify use cases (e.g., Resend for transactional, Mailgun for bulk)

---

### 12. **No Retry Logic for Failed Sends**
**Problem:** When SMS or email fails, there's no retry mechanism with exponential backoff.

**Fix:** Implement retry queue using Supabase or Redis:
```typescript
async function sendWithRetry(sendFn: () => Promise<void>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await sendFn();
      return { success: true };
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(Math.pow(2, i) * 1000); // Exponential backoff
    }
  }
}
```

---

### 13. **Missing Guest De-duplication**
**Problem:** When importing guests via CSV, there's no check for duplicate email/phone numbers.

**Fix:** Check for existing guests before insertion in bulk import.

---

### 14. **No Event Cleanup for Abandoned Drafts**
**Problem:** Draft events are never cleaned up if user abandons creation process.

**Fix:** Add a scheduled job to delete draft events older than 30 days with no activity.

---

### 15. **Type Safety Issues**
**File:** `src/app/e/[slug]/page.tsx:74`

```typescript
(sum: number, r: { headcount: number }) => sum + (r.headcount || 1),
```

**Problem:** Manual type casting bypasses TypeScript checks.

---

## ✅ GOOD PRACTICES FOUND

1. **Proper Use of Environment Variables** - All sensitive config is externalized
2. **Rate Limiting** - Implemented on auth endpoints (though could be stricter)
3. **SQL Injection Prevention** - Using parameterized queries via Supabase
4. **XSS Protection** - `escapeHtml` function used in email templates
5. **RLS Policies** - Row Level Security enabled on Supabase tables
6. **Batch Processing** - Guest sends are batched (10 at a time) to avoid API rate limits
7. **Graceful Degradation** - SMS falls back gracefully when not configured
8. **CSRF Protection** - Next.js handles this automatically

---

## 📋 RECOMMENDATIONS BY PRIORITY

### Immediate (Before Production)
- [ ] Remove hardcoded admin password from migrations
- [ ] Implement password hashing (bcrypt/argon2)
- [ ] Add proper error logging to SMS/email sends
- [ ] Add phone number validation/normalization
- [ ] Verify Resend "from" email domain

### Short Term (Within 1 Week)
- [ ] Implement server-side session validation
- [ ] Add Resend webhook for delivery tracking
- [ ] Fix Twilio auth code to use consistent send options
- [ ] Add input sanitization for customization fields
- [ ] Implement retry logic with exponential backoff

### Medium Term (Within 1 Month)
- [ ] Add guest de-duplication logic
- [ ] Implement abandoned draft cleanup
- [ ] Add comprehensive logging/monitoring
- [ ] Add SMS delivery status tracking via Twilio webhooks
- [ ] Implement email template versioning

### Long Term (Nice to Have)
- [ ] Add support for multiple email providers (failover)
- [ ] Implement queue system for high-volume sends
- [ ] Add analytics dashboard for delivery rates
- [ ] Support for international phone numbers with country selection
- [ ] A/B testing for email templates

---

## 🔧 SPECIFIC CODE FIXES

### Fix 1: Phone Validation Helper
```typescript
// src/lib/phone-validation.ts
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export function validateAndFormatPhone(phone: string, defaultCountry = 'US'): { 
  valid: boolean; 
  formatted?: string;
  error?: string;
} {
  try {
    if (!isValidPhoneNumber(phone, defaultCountry)) {
      return { valid: false, error: 'Invalid phone number' };
    }
    
    const parsed = parsePhoneNumber(phone, defaultCountry);
    return { valid: true, formatted: parsed.format('E.164') };
  } catch (error) {
    return { valid: false, error: 'Invalid phone number format' };
  }
}
```

### Fix 2: Improved Error Handling in Send Routes
```typescript
// In send-invites route
interface SendResult {
  guestId: string;
  emailOk: boolean;
  smsOk: boolean;
  errors: Array<{ type: 'email' | 'sms'; message: string }>;
}

// ... inside batch processing
try {
  await resend.emails.send({...});
  emailOk = true;
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Email failed for ${guest.email}:`, message);
  errors.push({ type: 'email', message });
}
```

### Fix 3: Session Validation Middleware
```typescript
// src/lib/auth/validate-session.ts
export async function validateSession(token: string): Promise<{
  valid: boolean;
  user?: AuthUser;
}> {
  const adminSupabase = createAdminClient();
  
  const { data: session } = await adminSupabase
    .from('user_sessions')
    .select('*')
    .eq('session_token', token)
    .gt('expires_at', new Date().toISOString())
    .single();
    
  if (!session) return { valid: false };
  
  return { 
    valid: true, 
    user: { /* ... */ }
  };
}
```

---

## 📊 TESTING CHECKLIST

### Email (Resend)
- [ ] Send invitation email to valid address
- [ ] Handle invalid email addresses gracefully
- [ ] Verify email template renders correctly in major clients (Gmail, Outlook, Apple Mail)
- [ ] Test with large batch sends (100+ guests)
- [ ] Verify rate limiting works correctly
- [ ] Test "from" address with unverified domain (should fail gracefully)

### SMS (Twilio)
- [ ] Send SMS to valid US number
- [ ] Send SMS to international number
- [ ] Handle invalid phone numbers
- [ ] Test without Twilio config (should skip SMS gracefully)
- [ ] Verify character limits (SMS split handling)
- [ ] Test with Messaging Service vs From number

### Authentication
- [ ] Email OTP flow works end-to-end
- [ ] SMS OTP flow works end-to-end
- [ ] Invalid codes are rejected
- [ ] Expired codes are rejected
- [ ] Session persists across page reloads
- [ ] Logout clears session properly
- [ ] Attempt to access protected route without auth (should redirect)

### General
- [ ] Create event with all fields
- [ ] Publish event
- [ ] Import guests via CSV
- [ ] Send invites to guests
- [ ] Submit RSVP as guest
- [ ] Check analytics/dashboard updates
- [ ] Test on mobile devices
- [ ] Test with slow network (loading states)

---

## 📝 SUMMARY

SealSend has a solid foundation with good architectural decisions. The main concerns are:

1. **Security**: Hardcoded passwords, plaintext storage, and missing session validation are blockers
2. **Reliability**: Silent failures in SMS/email sending need proper error handling
3. **Data Integrity**: Phone validation and guest de-duplication needed

Once the critical issues are addressed, this will be a production-ready application with a strong feature set for event management.

---

**Next Steps:**
1. Address all 🔴 Critical issues
2. Run through the testing checklist
3. Set up monitoring/logging for production
4. Consider load testing for bulk email/SMS sends
