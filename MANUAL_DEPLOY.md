# Manual Deployment Guide

If automatic deployment via Coolify doesn't work, follow these steps.

## Step 1: SSH into VPS

```bash
ssh root@187.77.26.99
```

## Step 2: Navigate to Service Directory

```bash
cd /data/coolify/services/x8okwogw0so8s08oss04s088
```

## Step 3: Pull Latest Code

```bash
git pull origin master
```

Expected output:
```
Updating 153b334..42e8849
Fast-forward
 ...
```

## Step 4: Rebuild Container

```bash
docker-compose down
docker-compose build --no-cache web
docker-compose up -d
```

This will take 2-5 minutes. Watch for:
- `Building web` - compiling the Next.js app
- `Creating x8okwogw0so8s08oss04s088-web` - starting container

## Step 5: Verify Container is Running

```bash
docker ps --filter "name=x8okwogw0so8s08oss04s088"
```

Should show:
```
STATUS: Up X seconds (healthy)
```

## Step 6: Check Logs

```bash
docker-compose logs --tail=50 web
```

Look for:
- `Ready started server on 0.0.0.0:3000` - Server is ready
- No red error messages

## Step 7: Apply Database Migration

Go to: https://supabase.com/dashboard/project/vtbreowxqfcvwegpfnwn/sql/new

Paste and run:

```sql
-- Add last_login_at column
ALTER TABLE guests ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Update invite_status constraint
ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_invite_status_check;
ALTER TABLE guests ADD CONSTRAINT guests_invite_status_check 
    CHECK (invite_status IN ('not_sent', 'sent', 'failed', 'accepted'));
```

Verify:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'guests' AND column_name = 'last_login_at';
-- Should return: last_login_at
```

## Step 8: Test Site

```bash
curl -I https://sealsend.app
```

Should return `HTTP/2 200`

## Troubleshooting

### Container won't start
```bash
docker-compose logs web | tail -100
```
Check for build errors.

### Database connection errors
Verify environment variables:
```bash
docker exec x8okwogw0so8s08oss04s088-web printenv | grep SUPABASE
```

### Site returns 404
Check if build succeeded:
```bash
docker exec x8okwogw0so8s08oss04s088-web ls -la /app/.next/
```

### Need to force rebuild
```bash
docker-compose down -v
docker system prune -a  # WARNING: removes all unused images
docker-compose build --no-cache
docker-compose up -d
```

## Verification Checklist

- [ ] Git pull successful (commit `42e8849`)
- [ ] Container running (`docker ps` shows it)
- [ ] Site responds with HTTP 200
- [ ] Database migration applied (last_login_at column exists)
- [ ] invite_status constraint includes 'accepted'
- [ ] Can access https://sealsend.app/dashboard
- [ ] Can access https://sealsend.app/invite/accept
