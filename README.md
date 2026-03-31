# SealSend — Digital Invitations & RSVP Platform

**SealSend** is a modern, high-performance SaaS platform for creating, sending, and tracking digital invitations with robust RSVP management. Built specifically for event organizers who need reliability and elegance.

## 🚀 Vision & Future Planning

SealSend represents the next generation of event management within the Nexus AI & GlowOS ecosystem. As part of our product consolidation and monetization strategy, SealSend is being prepared for a broader public SaaS launch.

**Upcoming Enhancements:**
- Integration with the GlowOS ecosystem for AI-generated event descriptions and automated guest communication.
- Premium tiers utilizing the 24-hour token reset model for high-volume senders.
- Advanced automated follow-ups via integrated Mailgun/Twilio services.

## 🏗 Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database & Auth:** Supabase (PostgreSQL, Row Level Security)
- **Styling:** Tailwind CSS + Radix UI Primitives
- **Communication:** Twilio (SMS) & Mailgun (Email)
- **Deployment:** Docker / Coolify

## ✨ Core Features

- **Seamless Authentication:** Passwordless login via 6-digit SMS or Email OTP.
- **Dynamic Dashboards:** Dedicated views for event hosts and guests.
- **RSVP Tracking:** Real-time metrics on attendance, plus-ones, and dietary restrictions.
- **Automated Reminders:** Scheduled dispatch of event updates to the guest list.

## 🛠 Getting Started (Development)

### Prerequisites
- Node.js 18+
- Supabase Project (Free Tier)
- Twilio & Mailgun accounts (for OTP and notifications)

### Setup

```bash
# Clone the repository
git clone https://github.com/camster91/SealSend.git
cd SealSend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# (Fill in your Supabase, Twilio, and Mailgun credentials)

# Start the development server
npm run dev
```

Visit `http://localhost:3000` to view the application.

## 🛳 Deployment

SealSend is fully Dockerized and optimized for VPS deployment via Coolify or Docker Compose. See `DEPLOYMENT_GUIDE.md` and `COOLIFY_DEPLOY.md` for detailed infrastructure setup instructions.

---
*Developed by Cameron Ashley / Nexus AI.*
