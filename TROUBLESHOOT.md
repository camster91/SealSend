# Troubleshooting: New Homepage Not Showing

## Quick Checks

### 1. Verify Deployment Status

SSH into your VPS and check:

```bash
ssh root@187.77.26.99

# Check if container is running
docker ps | grep x8okwogw0so8s08oss04s088

# Should show something like:
# x8okwogw0so8s08oss04s088-web   Up 5 minutes   0.0.0.0:3000->3000/tcp
```

### 2. Check Git Commit

```bash
cd /data/coolify/services/x8okwogw0so8s08oss04s088
git log --oneline -3
```

Should show:
```
9dfaa81 docs: add deployment guide and testing checklist
b4c5491 docs: add core features status document
0073579 docs: add SaaS overhaul summary
```

If not, run:
```bash
git pull origin master
```

### 3. Clear Browser Cache

**Chrome/Edge:**
- Press `Ctrl+Shift+R` (hard refresh)
- Or open DevTools (F12) → Right click refresh button → "Empty cache and hard reload"

**Firefox:**
- `Ctrl+F5` or `Ctrl+Shift+R`

**Safari:**
- `Cmd+Option+E` (empty cache) then `Cmd+R` (reload)

### 4. Check if Build Completed

```bash
cd /data/coolify/services/x8okwogw0so8s08oss04s088
docker-compose logs web | tail -30
```

Look for:
- "Ready started server on 0.0.0.0:3000" (success)
- Any error messages

### 5. Force Redeploy

If the above doesn't work:

```bash
cd /data/coolify/services/x8okwogw0so8s08oss04s088

# Stop everything
docker-compose down -v

# Clean up old images
docker system prune -a -f

# Fresh pull
git fetch origin
git reset --hard origin/master

# Rebuild
docker-compose build --no-cache web
docker-compose up -d

# Verify
docker ps
```

---

## Verify New Homepage

After clearing cache, check for these NEW elements:

### OLD homepage had:
- Simple white background
- Basic text "SealSend" 
- Simple "Get Started" button
- No animations

### NEW homepage has:
- **Gradient background** (purple to blue)
- **Animated hero section** with floating mockup
- **Beta badge** "Now in Beta — All features free!"
- **Two CTA buttons**: "Create Your Invitation" + "See How It Works"
- **Social proof**: User avatars + "2,000+ events created"
- **Dark features section** with 8 feature cards
- **4-step How It Works** with animated line
- **Testimonials section**

---

## Still Not Working?

Check these files exist on VPS:

```bash
cd /data/coolify/services/x8okwogw0so8s08oss04s088

# Should exist:
ls -la src/app/(marketing)/page.tsx
ls -la src/components/marketing/Hero.tsx
ls -la src/components/marketing/FeaturesGrid.tsx
```

If files missing, the git pull failed.

---

## Nuclear Option

If nothing works, rebuild from scratch:

```bash
cd /data/coolify/services/x8okwogw0so8s08oss04s088

# Backup env
cp .env.local /tmp/env-backup

# Remove everything
docker-compose down -v
docker system prune -a -f
cd ..
rm -rf x8okwogw0so8s08oss04s088

# Reclone
git clone https://github.com/camster91/SealSend.git x8okwogw0so8s08oss04s088
cd x8okwogw0so8s08oss04s088

# Restore env
cp /tmp/env-backup .env.local

# Build and run
docker-compose build --no-cache web
docker-compose up -d
```

---

## Need Help?

Send me:
1. Output of `docker ps`
2. Output of `git log --oneline -3`
3. Screenshot of what you see at https://sealsend.app
