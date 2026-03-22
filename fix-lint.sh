#!/bin/bash
cd /tmp/sealsend-stripe

# 1. Fix empty interface in Card.tsx
sed -i 's/interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}/type CardProps = React.HTMLAttributes<HTMLDivElement>/' src/components/ui/Card.tsx

# 2. Fix unescaped quotes in dashboard page
sed -i "s/doesn't/doesn\&apos;t/g; s/won't/won\&apos;t/g; s/can't/can\&apos;t/g; s/it's/it\&apos;s/g; s/you're/you\&apos;re/g" src/app/\(dashboard\)/dashboard/page.tsx
sed -i "s/doesn't/doesn\&apos;t/g; s/won't/won\&apos;t/g; s/can't/can\&apos;t/g; s/it's/it\&apos;s/g" src/app/events/\[eventId\]/guest/page.tsx

# 3. Fix unused imports in event detail page
sed -i '/^import.*query.*from/d' src/app/\(dashboard\)/events/\[eventId\]/page.tsx 2>/dev/null
sed -i "s/import { AutoRemindersToggle } from/\/\/ import { AutoRemindersToggle } from/" src/app/\(dashboard\)/events/\[eventId\]/page.tsx 2>/dev/null
sed -i "s/import { TIERS } from/\/\/ import { TIERS } from/" src/app/\(dashboard\)/events/\[eventId\]/page.tsx 2>/dev/null

# 4. Fix unused queryOne in webhook
sed -i 's/import { query, queryOne }/import { query }/' src/app/api/webhooks/stripe/route.ts

# 5. Fix unused queryOne in cron
sed -i 's/import { query, queryOne }/import { query }/' src/app/api/cron/send-reminders/route.ts 2>/dev/null

echo "Basic fixes applied"
