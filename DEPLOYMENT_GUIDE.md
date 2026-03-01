# SealSend Deployment Guide

## Quick Deploy (Manual)

Since automated SSH is timing out, run these commands directly on your VPS:

### Step 1: SSH into your VPS
```bash
ssh root@187.77.26.99
```

### Step 2: Run Deployment Commands
```bash
cd /data/coolify/services/x8okwogw0so8s08oss04s088

# Pull latest code
git pull origin master

# Stop existing containers
docker-compose down

# Build new image (takes 2-5 minutes)
docker-compose build --no-cache web

# Start containers
docker-compose up -d

# Check status
docker ps --filter "name=x8okwogw0so8s08oss04s088"
```

### Step 3: Verify Deployment
```bash
# Check site is responding
curl -I http://localhost:3000

# View logs
docker-compose logs -f web
```

---

## Testing Checklist

After deployment, test these core features:

### 1. Homepage
- [ ] Visit https://sealsend.app
- [ ] Page loads without errors
- [ ] Navigation links work
- [ ] "Sign in" button visible

### 2. Login
- [ ] Click "Sign in" → goes to /login
- [ ] Enter email → code sent
- [ ] Enter code → logged in
- [ ] Redirected to dashboard

### 3. Dashboard
- [ ] Dashboard loads
- [ ] Shows user name/email
- [ ] "Create Event" button visible
- [ ] Stats cards displayed

### 4. Create Event
- [ ] Click "Create Event"
- [ ] Fill in event details
- [ ] Upload design (optional)
- [ ] Add guests
- [ ] Publish event

### 5. Event Management
- [ ] View created event
- [ ] Edit event details
- [ ] Add more guests
- [ ] Send invitations

### 6. Guest Experience
- [ ] Guest receives invitation email
- [ ] Clicks magic link
- [ ] Auto-logged in
- [ ] Can view event and RSVP

### 7. Logout
- [ ] Click "Sign out" in sidebar
- [ ] Session cleared
- [ ] Redirected to homepage

---

## Troubleshooting

### Site returns 502/503
```bash
# Check container status
docker ps

# Restart container
docker-compose restart web

# View error logs
docker-compose logs web | tail -50
```

### Database connection errors
- Check Supabase is accessible
- Verify environment variables:
```bash
docker exec x8okwogw0so8s08oss04s088-web printenv | grep SUPABASE
```

### Build failures
```bash
# Clean build
docker-compose down -v
docker system prune -a -f
docker-compose build --no-cache
docker-compose up -d
```

---

## Current Status

**Latest Commit:** `b4c5491` - docs: add core features status document

**Features in this deploy:**
- Modern homepage with animations
- Working login/logout flow
- Unified dashboard for all users
- Event creation wizard
- Guest invitation system
- Magic link auto-login

---

## Support

If deployment fails:
1. Check Coolify dashboard: https://coolify.io
2. Verify DNS: sealsend.app → 187.77.26.99
3. Check container logs for errors
4. Ensure Supabase database is accessible
