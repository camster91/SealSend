# SealSend Security Hardening Guide

## Overview
This guide covers security best practices for SealSend in production. The application is currently deployed with exposed API keys that should be rotated for security.

## Critical Security Actions

### 1. Rotate Exposed API Keys

The following keys are currently exposed in `.env.local` and should be rotated immediately:

#### Supabase Service Role Key
**Current Status**: Exposed in `.env.local`  
**Risk**: Allows full database access (bypasses RLS)  
**Rotation Steps**:
1. Log into [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to your project → Settings → API
3. Under "Project API keys", find "service_role" secret
4. Click "Reveal" then "Regenerate"
5. Update `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` with new value
6. Redeploy application: `npm run deploy:production`

#### Mailgun API Key
**Current Status**: Exposed in `.env.local` (actual key exposed - rotate immediately)  
**Risk**: Allows sending email from your domain, could be abused for spam  
**Rotation Steps**:
1. Log into [Mailgun Dashboard](https://app.mailgun.com)
2. Navigate to Settings → API Keys
3. Find the active key and click "Reset"
4. Update `MAILGUN_API_KEY` in `.env.local` with new value
5. Redeploy application

#### Titan Email Password
**Current Status**: Exposed in `.env.local` (actual password exposed - rotate immediately)  
**Risk**: Email account compromise  
**Rotation Steps**:
1. Log into [Titan Email](https://titan.email)
2. Go to Settings → Security → App Passwords
3. Generate a new app password
4. Update `TITAN_IMAP_PASSWORD` and `TITAN_SMTP_PASSWORD` in `.env.local`
5. Redeploy application

**Note**: Titan credentials are intended for Supabase Edge Functions (per comment in `.env.local`). Consider moving them to Supabase Edge Function environment variables.

#### Twilio Credentials
**Current Status**: Exposed in `.env.local`  
**Risk**: SMS sending abuse, financial cost  
**Rotation Steps**:
1. Log into [Twilio Console](https://console.twilio.com)
2. Navigate to Settings → API Keys
3. Create a new API Key (or regenerate existing)
4. Update `TWILIO_API_KEY_SID` and `TWILIO_API_KEY_SECRET` in `.env.local`
5. Keep `TWILIO_ACCOUNT_SID` (doesn't need rotation)
6. Redeploy application

### 2. Secure Environment Variables

**Never commit `.env.local` to version control**. Ensure it's in `.gitignore`:

```bash
# .gitignore
.env.local
.env.*.local
```

**Production Deployment** (Coolify/VPS):
- Use Coolify's "Environment Variables" section to set secrets
- Never store secrets in Dockerfile or docker-compose.yml
- Use secrets management for sensitive data

### 3. Implement Production Rate Limiting

**Current Status**: In-memory rate limiting (not distributed)  
**Solution**: Redis-based rate limiting with @upstash/ratelimit

#### Option A: Upstash Redis (Recommended)
1. Sign up at [Upstash](https://upstash.com/)
2. Create a Redis database
3. Get the REST URL and token
4. Add to `.env.local`:
   ```bash
   REDIS_URL=https://<user>:<token>@<host>:<port>
   ```
5. Already installed: `@upstash/redis` and `@upstash/ratelimit`
6. The application will automatically use Redis when `REDIS_URL` is set

#### Option B: Self-hosted Redis
1. Install Redis on your VPS:
   ```bash
   sudo apt update
   sudo apt install redis-server
   sudo systemctl enable redis
   ```
2. Configure Redis with password:
   ```bash
   # /etc/redis/redis.conf
   requirepass your-strong-password
   bind 127.0.0.1
   ```
3. Add to `.env.local`:
   ```bash
   REDIS_URL=redis://:your-strong-password@localhost:6379
   ```

#### Rate Limit Configuration
The application rate limits:
- `send-code`: 5 attempts per 10 minutes per IP
- `verify-code`: 10 attempts per 10 minutes per IP  
- `login-password`: 5 attempts per 10 minutes per IP
- `comment`: 15 attempts per 10 minutes per IP

### 4. Security Headers

**Implemented**: ✅ Added to middleware (`src/middleware.ts`)

Headers include:
- **Content-Security-Policy**: Restricts resources to trusted sources
- **Strict-Transport-Security**: Enforces HTTPS (1 year)
- **X-Frame-Options**: DENY (prevents clickjacking)
- **X-Content-Type-Options**: nosniff (prevents MIME sniffing)
- **Referrer-Policy**: strict-origin-when-cross-origin
- **Permissions-Policy**: Disables camera, microphone, geolocation
- **X-XSS-Protection**: 1; mode=block

**To customize CSP** for your specific needs, edit `src/middleware.ts`.

### 5. Database Security

#### Row Level Security (RLS)
Ensure all tables have RLS policies enabled:
```sql
-- Check RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

#### Regular Backups
Configure Supabase backups:
1. Supabase Dashboard → Database → Backups
2. Set up daily backups
3. Enable Point-in-Time Recovery

#### Audit Logs
Enable Supabase audit logging:
```sql
-- Enable pgAudit extension
CREATE EXTENSION IF NOT EXISTS pgaudit;
```

### 6. Monitoring & Alerting

#### Error Tracking
Consider adding error tracking:
- **Sentry**: `npm install @sentry/nextjs`
- **LogRocket**: For session replay

#### Uptime Monitoring
- **UptimeRobot**: Free tier for basic monitoring
- **Better Stack**: Advanced monitoring with alerts

#### Security Scanning
- **Snyk**: Dependency vulnerability scanning
- **GitHub Dependabot**: Automated security updates

### 7. Authentication Security

#### Session Management
- Sessions expire after 7 days
- Sessions validated against database on each request
- HTTP-only cookies

#### Password Security
- Admin passwords hashed with bcrypt (cost factor 12)
- No password storage in plaintext

#### OTP Security
- 6-digit codes expire after 10 minutes
- Rate limited to prevent brute force

### 8. Deployment Security

#### Docker Security
- Use non-root user in Dockerfile
- Scan images for vulnerabilities
- Keep base images updated

#### VPS Security
- Configure firewall (UFW):
  ```bash
  sudo ufw allow 22/tcp    # SSH
  sudo ufw allow 80/tcp    # HTTP
  sudo ufw allow 443/tcp   # HTTPS
  sudo ufw enable
  ```
- Regular system updates:
  ```bash
  sudo apt update && sudo apt upgrade -y
  ```

#### Coolify Security
- Keep Coolify updated
- Use Coolify's built-in SSL certificate management
- Enable automatic backups

### 9. Incident Response Plan

#### If API Keys Are Compromised
1. **Immediate Actions**:
   - Rotate all exposed keys (follow steps above)
   - Review access logs for suspicious activity
   - Check for unauthorized database changes
2. **Notification**:
   - Inform users if personal data may have been accessed
   - Update security documentation
3. **Prevention**:
   - Implement key rotation schedule (every 90 days)
   - Add key usage monitoring

#### If Database Is Compromised
1. Restore from backup
2. Force password reset for all users
3. Investigate attack vector

### 10. Regular Security Audits

#### Monthly Checklist
- [ ] Rotate API keys (optional but recommended)
- [ ] Review dependency vulnerabilities (`npm audit`)
- [ ] Check Supabase access logs
- [ ] Verify backups are working
- [ ] Update all packages (`npm update`)

#### Quarterly Checklist
- [ ] Full security review
- [ ] Penetration testing (consider using services like Intruder)
- [ ] Update security headers based on new requirements
- [ ] Review and update RLS policies

## Quick Start Security Hardening

For immediate security improvements:

1. **Rotate Supabase service role key** (highest priority)
2. **Set up Redis rate limiting** (Upstash free tier)
3. **Enable Cloudflare** for DDoS protection and additional security headers
4. **Implement Sentry** for error tracking

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Documentation](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/security)
- [Twilio Security Guidelines](https://www.twilio.com/docs/usage/security)

---

*Last Updated: March 2026*  
*For questions or assistance, consult the SealSend documentation or security team.*