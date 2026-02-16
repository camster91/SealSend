# Seal and Send Enhanced Authentication System

## Overview
We've built a comprehensive authentication system with multiple login methods for both admins and guests.

## Features

### 1. **Multiple Authentication Methods**
- **Email Magic Links** - 6-digit codes sent via email
- **SMS OTP** - 6-digit codes sent via SMS (Twilio)
- **Password Login** - Traditional password for admins

### 2. **Role-Based Access**
- **Admin Users** - Full access to dashboard, event management
- **Guest Users** - Limited access to specific events

### 3. **Secure Session Management**
- JWT-based sessions with 7-day expiry
- Secure HTTP-only cookies
- Automatic session cleanup

## Database Schema

### Tables Created:
1. **`auth_codes`** - Temporary login codes (15min expiry)
2. **`admin_users`** - Admin user accounts with passwords
3. **`user_sessions`** - Active user sessions

### Sample Admin User:
- Email: `admin@example.com`
- Password: `admin123`

## API Endpoints

### 1. Send Login Code
```
POST /api/auth/send-code
{
  "method": "email" | "phone",
  "email": "user@example.com",  // for email method
  "phone": "+1234567890",       // for phone method
  "eventId": "uuid"             // optional for guest access
}
```

### 2. Verify Code
```
POST /api/auth/verify-code
{
  "method": "email" | "phone",
  "email": "user@example.com",
  "phone": "+1234567890",
  "code": "123456",
  "eventId": "uuid"             // optional for guest access
}
```

## Pages Created

### 1. **Admin Login** (`/login`)
- Multi-method login selector (email/SMS/password)
- Role detection (admin vs guest)

### 2. **Guest Login** (`/events/[eventId]/guest`)
- Event-specific guest access
- Email or SMS verification
- Event context display

### 3. **Admin Dashboard** (`/dashboard`)
- Protected admin-only route
- Event statistics
- Event management

## Environment Variables Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxx

# SMS (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
TWILIO_API_KEY_SID=SKxxxxxxxxxx
TWILIO_API_KEY_SECRET=xxxxxxxxxx
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxx
```

## Setup Instructions

### 1. Run Database Migrations
```bash
# Apply the auth tables migration
supabase db push
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Copy `.env.example` to `.env.local` and fill in your credentials.

### 4. Run the Application
```bash
npm run dev
```

## Security Features

1. **Rate Limiting** - Codes expire after 15 minutes
2. **One-Time Use** - Codes are deleted after verification
3. **HTTP-only Cookies** - Session tokens not accessible to JavaScript
4. **Role Validation** - Middleware checks user roles for each route
5. **Event Scoping** - Guests only access their assigned events

## Usage Examples

### Admin Login:
1. Visit `/login`
2. Choose "Email" method
3. Enter admin email
4. Check email for 6-digit code
5. Enter code to access dashboard

### Guest Access:
1. Visit `/events/[eventId]/guest`
2. Choose "Email" or "SMS"
3. Enter contact information
4. Receive and enter code
5. Access event-specific features

### Password Login (Admin):
1. Visit `/login`
2. Choose "Password" method
3. Enter email and password
4. Immediate access to dashboard

## Testing

### Test Admin Account:
- Email: `admin@example.com`
- Password: `admin123`

### Test Guest Flow:
1. Create an event in the dashboard
2. Note the event ID
3. Visit `/events/[eventId]/guest`
4. Test email/SMS verification

## Next Steps

1. **Password Hashing** - Implement bcrypt for secure password storage
2. **Rate Limiting** - Add API rate limiting
3. **Email Templates** - Customize email/SMS templates
4. **Social Login** - Add Google/OAuth providers
5. **2FA** - Add two-factor authentication for admins
6. **Audit Logging** - Track login attempts and access

## Troubleshooting

### Common Issues:

1. **Emails not sending**
   - Check Resend API key
   - Verify sender domain in Resend

2. **SMS not sending**
   - Check Twilio credentials
   - Verify phone number format (+1XXXXXXXXXX)

3. **Database errors**
   - Run migrations: `supabase db push`
   - Check Supabase connection

4. **Session issues**
   - Clear browser cookies
   - Check middleware configuration