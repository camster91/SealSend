# SealSend Testing Checklist

## Pre-Deployment Verification

Run these tests locally before deploying:

```bash
cd SealSend
npm run build
```

Build should complete without errors.

---

## Post-Deployment Testing

### Test 1: Homepage Load
```bash
curl -s -o /dev/null -w "%{http_code}" https://sealsend.app
```
Expected: `200`

### Test 2: Login Page
```bash
curl -s -o /dev/null -w "%{http_code}" https://sealsend.app/login
```
Expected: `200`

### Test 3: Dashboard (requires auth)
```bash
curl -s -o /dev/null -w "%{http_code}" https://sealsend.app/dashboard
```
Expected: `302` (redirects to login if not authenticated)

### Test 4: API Health
```bash
curl -s https://sealsend.app/api/events | head -c 100
```
Expected: `{"error":"Unauthorized"}` or similar auth error

---

## Manual Browser Testing

### Homepage Test
1. Open https://sealsend.app
2. Verify:
   - [ ] Page loads
   - [ ] Logo visible
   - [ ] Navigation menu works
   - [ ] "Sign in" button present
   - [ ] "Get Started" button present

### Login Flow Test
1. Click "Sign in"
2. Enter email: `your-email@example.com`
3. Click "Send Code"
4. Check email for 6-digit code
5. Enter code
6. Verify:
   - [ ] Logged in successfully
   - [ ] Redirected to dashboard
   - [ ] "Dashboard" button shows in navbar

### Dashboard Test
1. On dashboard, verify:
   - [ ] Welcome message shows name/email
   - [ ] Stats cards visible (My Events, Invited To, Total)
   - [ ] "Create Event" button present
   - [ ] Sidebar navigation works

### Create Event Test
1. Click "Create Event"
2. Fill in:
   - Event Title: "Test Event"
   - Date: Tomorrow
   - Location: "Test Location"
3. Click through wizard
4. Add a test guest:
   - Name: "Test Guest"
   - Email: your other email
5. Publish event
6. Verify:
   - [ ] Event appears in dashboard
   - [ ] Can view event details

### Invitation Test
1. Open created event
2. Click "Guests" tab
3. Click "Send Invitations"
4. Check recipient email
5. Verify:
   - [ ] Email received with magic link
   - [ ] Link format: `https://sealsend.app/invite/accept?token=...`

### Guest Experience Test
1. Open invitation email
2. Click magic link
3. Verify:
   - [ ] Auto-logged in as guest
   - [ ] Can view event details
   - [ ] Can submit RSVP

### Logout Test
1. Click "Sign out" in sidebar
2. Verify:
   - [ ] Session cleared
   - [ ] Redirected to homepage
   - [ ] "Sign in" button visible again

---

## Mobile Testing

Repeat the above tests on mobile device or emulator:
- [ ] Homepage responsive
- [ ] Login works
- [ ] Dashboard usable
- [ ] Event creation works

---

## Performance Checks

```bash
# Test page load time
curl -o /dev/null -s -w "Total time: %{time_total}s\n" https://sealsend.app
```

Expected: Under 3 seconds

---

## Security Checks

- [ ] HTTPS enforced
- [ ] Cookies are httpOnly and secure
- [ ] No sensitive data in localStorage
- [ ] API requires authentication

---

## Sign-off

**Tested by:** _______________
**Date:** _______________
**All tests passed:** [ ] Yes [ ] No

**Issues found:**
_________________________________
_________________________________
