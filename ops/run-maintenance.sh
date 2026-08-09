#!/bin/sh
set -eu

job="${1:-}"
case "$job" in
  reminders) endpoint="/api/cron/send-reminders" ;;
  announcements) endpoint="/api/cron/send-announcements" ;;
  cleanup) endpoint="/api/cron/cleanup-drafts" ;;
  cleanup-uploads) endpoint="/api/cron/cleanup-uploads" ;;
  delete-accounts) endpoint="/api/cron/delete-accounts" ;;
  host-lifecycle) endpoint="/api/cron/send-host-lifecycle" ;;
  *) echo "Usage: $0 reminders|announcements|cleanup|cleanup-uploads|delete-accounts|host-lifecycle" >&2; exit 64 ;;
esac

container="$(docker ps \
  --filter 'label=coolify.resourceName=seal-send' \
  --filter 'status=running' \
  --format '{{.Names}}' | head -n 1)"

if [ -z "$container" ]; then
  echo "SealSend application container is not running" >&2
  exit 1
fi

docker exec "$container" sh -c \
  'test -n "$CRON_SECRET" && curl --fail --silent --show-error --max-time 120 -X POST -H "Authorization: Bearer $CRON_SECRET" "http://127.0.0.1:3000'"$endpoint"'" >/dev/null'
