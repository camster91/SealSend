# SealSend

**Digital Invitations & RSVP Platform**

SealSend is a modern, high-performance SaaS platform for creating, sending, and tracking digital invitations with robust RSVP management. Built for event organizers who need reliability, elegance, and powerful automation.

## Features

### Authentication
- **Passwordless Login:** 6-digit SMS or Email OTP authentication
- **Secure Sessions:** JWT-based session management
- **Multi-device Support:** Seamless login across devices

### Event Management
- **Dynamic Dashboards:** Dedicated views for event hosts and guests
- **Custom Invitations:** Beautiful, customizable digital invitations
- **Guest Lists:** Manage guests, plus-ones, and dietary restrictions
- **QR Codes:** Automatic QR code generation for event entry

### RSVP Tracking
- **Real-time Metrics:** Track attendance, plus-ones, and responses
- **Automated Reminders:** Scheduled dispatch of event updates
- **Guest Communication:** SMS and email notifications via Twilio/Mailgun

### Integrations
- **Payment Processing:** Stripe integration for premium features
- **Calendar Export:** Add events to Google, Apple, or Outlook calendars

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| Database | Supabase (PostgreSQL with Row Level Security) |
| Authentication | Supabase Auth / Custom JWT |
| Styling | Tailwind CSS + Radix UI Primitives |
| SMS | Twilio |
| Email | Mailgun / Resend |
| Payments | Stripe |
| Deployment | Docker / Coolify |

## Prerequisites

- Node.js 18+
- Supabase project (Free Tier works)
- Twilio account (for SMS)
- Mailgun or Resend account (for email)
- Stripe account (for payments)

## Installation

```bash
# Clone the repository
git clone https://github.com/camster91/SealSend.git
cd SealSend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
```

### Environment Variables

```env
# Database (PostgreSQL)
DATABASE_URL=postgresql://sealsend:PASSWORD@db:5432/sealsend

# Twilio (SMS)
TWILIO_ACCOUNT_SID="your-account-sid"
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_PHONE_NUMBER="+1234567890"

# Mailgun (Email)
MAILGUN_API_KEY="your-api-key"
MAILGUN_DOMAIN="your-domain.com"

# Stripe
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Database Setup

```bash
# Run Supabase migrations
# See SUPABASE_SETUP.md for detailed instructions
```

## Usage

### Development

```bash
# Start development server
npm run dev
```

Visit `http://localhost:3000` to view the application.

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm run start
```

## Testing

```bash
# Run configuration tests
npm run test:config

# Test email delivery
npm run test:email

# Test SMS delivery
npm run test:sms

# Run all integration tests
npm run test:all
```

## Deployment

SealSend is fully Dockerized and optimized for VPS deployment.

### Docker Compose

```bash
docker-compose up -d
```

### Coolify

See `COOLIFY_DEPLOY.md` for detailed Coolify deployment instructions.

### Manual Deployment

See `DEPLOYMENT_GUIDE.md` and `MANUAL_DEPLOY.md` for step-by-step instructions.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Dashboard pages
│   ├── (event)/           # Event pages
│   └── api/               # API routes
├── components/             # React components
│   ├── ui/                # Base UI components
│   ├── invitations/       # Invitation components
│   └── dashboard/         # Dashboard components
├── lib/                    # Utility libraries
│   ├── db/                # Database client (PostgreSQL)
│   ├── twilio/            # Twilio helpers
│   └── stripe/            # Stripe helpers
└── types/                  # TypeScript types
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/otp` | Send OTP code |
| POST | `/api/auth/verify` | Verify OTP code |
| POST | `/api/events` | Create event |
| GET | `/api/events/:id` | Get event details |
| POST | `/api/invitations` | Send invitations |
| POST | `/api/rsvp` | Submit RSVP |

## Documentation

- `AUTHENTICATION_SYSTEM.md` - Auth architecture
- `DEPLOYMENT_GUIDE.md` - Deployment instructions
- `TESTING.md` - Testing guide
- `TROUBLESHOOT.md` - Common issues

## Roadmap

- [ ] GlowOS integration for AI-generated event descriptions
- [ ] Premium tiers with 24-hour token reset model
- [ ] Advanced automated follow-ups
- [ ] Calendar integration improvements

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push and open a Pull Request

## License

Proprietary - All rights reserved.

---
Developed by Cameron Ashley / Nexus AI.
