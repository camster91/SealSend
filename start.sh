#!/bin/sh
# Start script for SealSend with runtime environment variables

# Export runtime environment variables
export MAILGUN_API_KEY="${MAILGUN_API_KEY:-}"
export MAILGUN_DOMAIN="${MAILGUN_DOMAIN:-}"
export FROM_EMAIL="${FROM_EMAIL:-}"

# Start the Next.js standalone server
exec node server.js
