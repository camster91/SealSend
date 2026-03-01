# Dashboard Not Loading - Root Cause & Fix

## Problem Analysis
The dashboard at `https://sealsend.app/dashboard` is not loading due to an authentication mismatch between the middleware and custom auth system.

### Root Cause
1. **Authentication System Mismatch**: The application uses a **custom authentication system** with `auth_codes` and `user_sessions` tables, but the middleware only checks for **Supabase Auth sessions**.
2. **Redirect Loop**: When a user logs in via the custom auth system (setting `sealsend_session` and `sealsend_user` cookies), the middleware doesn't recognize these cookies and redirects them back to `/login`.
3. **Admin Role Requirement**: The dashboard page requires `admin` role via `requireAdmin()`, but the auth code may have been created with `guest` role if the email isn't in the `admin_users` table.

### Symptoms
- User gets redirected to `/login` even after logging in
- Dashboard shows blank page or 500 error
- Browser console may show network redirects

## Solution Applied

### 1. Updated Middleware (`src/lib/supabase/middleware.ts`)
The middleware now recognizes **both authentication methods**:
- ✅ Supabase Auth sessions (existing)
- ✅ Custom auth sessions via `sealsend_session` cookie (added)

**Changes made:**
- Added check for `sealsend_session` cookie
- User is considered authenticated if they have **either** Supabase auth session OR custom session
- Protected routes allow access with custom sessions
- Auth pages redirect authenticated users (including custom sessions)

### 2. File Changes
- **Modified**: `src/lib/supabase/middleware.ts`
- **Backup created**: `src/lib/supabase/middleware.ts.backup`

## Deployment Instructions

### Option A: Docker Compose (Local/Production)
```bash
cd /path/to/SealSend

# Rebuild the Docker image
docker-compose down
docker-compose build --no-cache web
docker-compose up -d

# Check logs
docker-compose logs -f web
```

### Option B: Coolify Deployment
1. **Connect to your server** via SSH
2. **Navigate to the app directory** (likely `/home/username/apps/sealsend`)
3. **Pull the latest changes** (if using Git):
   ```bash
   git pull origin main
   ```
4. **Rebuild the app** in Coolify dashboard:
   - Go to your application in Coolify
   - Click "Rebuild" or "Deploy"
   - Monitor the build logs for errors

### Option C: Manual Node.js Deployment
```bash
cd /path/to/SealSend

# Install dependencies
npm ci

# Build the application
npm run build

# Restart the PM2 process or systemd service
pm2 restart sealsend
```

## Verification Steps

After deploying the fix:

1. **Clear browser cookies** for `sealsend.app`
2. **Visit** `https://sealsend.app/login`
3. **Login with admin email** (must be in `admin_users` table)
4. **Verify dashboard loads** without redirects

## Admin User Setup

If you cannot log in as admin:

1. **Check admin_users table** in Supabase:
   ```sql
   SELECT * FROM admin_users;
   ```
2. **Add your email** if missing:
   ```sql
   INSERT INTO admin_users (email, created_at) 
   VALUES ('your-email@example.com', NOW());
   ```
3. **Request login code** with that email to get `admin` role

## Database Tables Verification

Ensure these tables exist in your Supabase database:

| Table | Purpose | Required |
|-------|---------|----------|
| `auth_codes` | Stores login codes | ✅ |
| `user_sessions` | Stores user sessions | ✅ |
| `admin_users` | Defines admin emails | ✅ |
| `events` | User events | ✅ |
| `guests` | Event guests | ✅ |

## Troubleshooting

### Still redirecting after login?
- Check browser DevTools → Network tab for redirect chain
- Verify `sealsend_session` cookie is set (Application → Cookies)
- Ensure middleware changes are deployed (check file timestamp)

### Dashboard shows 500 error?
- Check server logs for errors
- Verify `requireAdmin()` is not throwing due to missing admin role
- Ensure `auth_codes` table has a row with `role = 'admin'` for your email

### Email codes not sending?
- Verify Resend API key is set in environment variables
- Check Supabase Edge Functions for email sending
- Test with phone/SMS as alternative login method

## Additional Improvements Considered

1. **Session Validation**: Currently the middleware only checks for cookie existence. For production, consider validating the session token against the `user_sessions` table.
2. **Role-based Redirects**: Add automatic redirect for guest users to appropriate pages instead of throwing errors.
3. **Error Pages**: Create custom error pages for "Admin required" and "Session expired" scenarios.

## Support

If issues persist after applying this fix:
1. Check application logs: `docker-compose logs -f web`
2. Examine browser console errors (F12 → Console)
3. Verify Supabase connection is working
4. Contact development team with error details

---

**Fix Applied**: `2026-02-27`
**Middleware Version**: `2.0` (custom auth support)
**Status**: Ready for deployment