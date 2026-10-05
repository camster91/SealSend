#!/bin/sh
set -eu

# Run on the SealSend VPS. The operations secret is read only inside the
# running container and is never written to stdout or passed through argv.
# Coolify app was recreated as resource "sealsend" (formerly "seal-send");
# accept either so the cron keeps working across both setups.
container=""
for resource in sealsend seal-send; do
  container="$(docker ps \
    --filter "label=coolify.resourceName=$resource" \
    --filter 'status=running' \
    --format '{{.Names}}' | head -n 1)"
  [ -n "$container" ] && break
done

if [ -z "$container" ]; then
  echo "SealSend application container is not running" >&2
  exit 1
fi

docker exec "$container" sh -c '
  test -n "$OPERATIONS_SECRET"
  curl --fail --silent --show-error --max-time 30 \
    -H "Authorization: Bearer $OPERATIONS_SECRET" \
    http://127.0.0.1:3000/api/operations/readiness
'
