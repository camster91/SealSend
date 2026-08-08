#!/bin/sh
set -eu

url="${SEALSEND_HEALTH_URL:-https://sealsend.app/api/health}"
if curl --fail --silent --show-error --max-time 15 "$url" >/dev/null; then
  exit 0
fi

payload='{"service":"sealsend","event":"uptime_check_failed","healthUrl":"https://sealsend.app/api/health"}'
if [ -n "${ERROR_ALERT_WEBHOOK_URL:-}" ]; then
  curl --fail --silent --show-error --max-time 10 -X POST -H 'Content-Type: application/json' --data "$payload" "$ERROR_ALERT_WEBHOOK_URL" >/dev/null || true
fi
echo "SealSend health check failed" >&2
exit 1
