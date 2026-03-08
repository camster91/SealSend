# SealSend Deployment Guide

## Overview
SealSend is deployed using Docker and Coolify on a VPS (187.77.26.99). The application uses Next.js 16 with Supabase PostgreSQL database.

## Environments

| Environment | URL | Branch | Purpose |
|-------------|-----|--------|---------|
| Production | https://sealsend.app | `master` | Live user-facing application |
| Local | http://localhost:3000 | Any | Development & testing |

## Prerequisites

### Local Development
- Node.js 20+
- npm or yarn
- Git
- Docker (optional, for database)

### Production Server
- VPS with Docker & Docker Compose
- Coolify (or similar container management)
- Domain name with DNS configured
- SSL certificate (auto-configured by Coolify)

## Local Development Setup

1. **Clone repository**
   ```bash
   git clone https://github.com/camster91/SealSend.git
   cd SealSend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

5. **Build for production**
   ```bash
   npm run build
   npm start
   ```

## Production Deployment

### Automated Deployment (Recommended)
Use the provided deployment scripts:

#### Coolify Deployment (VPS)
```bash
# On your VPS (requires SSH access)
./deploy-coolify.sh
```

This script:
1. Pulls latest code from `master` branch
2. Stops existing container
3. Cleans build cache
4. Builds new Docker image
5. Starts container
6. Performs health check

#### Manual Deployment Steps
If scripts fail, follow manual process:

1. **SSH to VPS**
   ```bash
   ssh root@187.77.26.99
   ```

2. **Navigate to service directory**
   ```bash
   cd /data/coolify/services/x8okwogw0so8s08oss04s088
   ```

3. **Pull latest code**
   ```bash
   git fetch origin master
   git reset --hard origin/master
   ```

4. **Rebuild and restart**
   ```bash
   docker-compose down
   docker-compose build --no-cache web
   docker-compose up -d
   ```

5. **Verify deployment**
   ```bash
   # Check container status
   docker-compose ps
   
   # Check logs
   docker-compose logs --tail=50 web
   
   # Health check
   curl -s -o /dev/null -w "%{http_code}" https://sealsend.app
   ```

### Environment Variables (Production)
Set these in Coolify dashboard → Environment Variables:

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` = `https://sealsend.app`

**Email (Mailgun):**
- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN` = `sealsend.app`
- `FROM_EMAIL` = `"SealSend <noreply@sealsend.app>"`

**SMS (Twilio, optional):**
- `TWILIO_ACCOUNT_SID`
- `TWILIO_API_KEY_SID`
- `TWILIO_API_KEY_SECRET`
- `TWILIO_MESSAGING_SERVICE_SID`

**Stripe (optional, for subscriptions):**
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_STANDARD_PRICE_ID`
- `STRIPE_PREMIUM_PRICE_ID`

**Redis (optional, for rate limiting):**
- `REDIS_URL`

### Docker Configuration
- `Dockerfile`: Multi-stage build for Next.js
- `docker-compose.yml`: Defines web service with environment
- `nginx.conf`: Production NGINX configuration (inside container)

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on push:
- **Lint**: ESLint validation
- **Build**: Next.js build with placeholder environment variables
- **Test**: Configuration validation

To enable full CI/CD with deployment, add secrets to GitHub repository:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Rollback Procedures

### Quick Rollback (Last Deployment)
```bash
# On VPS
cd /data/coolify/services/x8okwogw0so8s08oss04s088
git reset --hard HEAD~1
docker-compose down
docker-compose build --no-cache web
docker-compose up -d
```

### Database Rollback
If database changes cause issues:
1. Access Supabase dashboard
2. Navigate to Database → Backups
3. Restore from previous backup

## Monitoring & Logs

### Application Logs
```bash
# View container logs
docker-compose logs -f web

# View specific error logs
docker-compose logs web | grep -i error
```

### Performance Monitoring
- **Coolify**: Built-in resource monitoring
- **Supabase**: Database performance metrics
- **Custom**: Application health endpoint (`/api/health` - to be implemented)

### Health Checks
- **Homepage**: `curl -I https://sealsend.app` (expect HTTP 200)
- **API**: `curl -I https://sealsend.app/api/events` (expect HTTP 401 Unauthorized)
- **Database**: Check Supabase dashboard for connection status

## Troubleshooting

### Common Issues

#### "Container fails to start"
1. Check logs: `docker-compose logs web`
2. Common causes:
   - Missing environment variables
   - Database connection issues
   - Port conflicts (3000 already in use)

#### "Build fails"
1. Ensure Node.js version compatibility (20+)
2. Check for TypeScript errors: `npm run lint`
3. Verify all dependencies installed: `npm ci`

#### "Email/SMS not sending"
1. Verify API keys in environment variables
2. Check provider dashboards for errors
3. Verify domain verification (Mailgun)

#### "Rate limiting too strict"
1. Configure Redis for production: Set `REDIS_URL`
2. Adjust rate limits in `src/lib/rate-limit.ts`

### Support
- **GitHub Issues**: Bug reports and feature requests
- **Coolify Documentation**: Deployment and container management
- **Supabase Documentation**: Database and authentication

## Security Considerations

### Regular Updates
- Update dependencies: `npm update`
- Update Docker base images regularly
- Apply security patches to VPS

### Key Rotation
Rotate API keys periodically (see `SECURITY_GUIDE.md`):
- Supabase service role key
- Mailgun API key
- Twilio credentials
- Titan email password

### Backup Strategy
- **Database**: Daily automated backups via Supabase
- **Code**: GitHub repository
- **Environment variables**: Stored in Coolify (backup export)

---

*Last Updated: March 2026*  
*For deployment assistance, consult the SealSend documentation.*