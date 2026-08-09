#!/bin/sh
set -eu

dump_path="${1:-}"
app_image="${2:-}"
if [ -z "$dump_path" ] || [ -z "$app_image" ]; then
  echo "Usage: $0 /absolute/path/to/backup.dump application-image" >&2
  exit 64
fi
case "$dump_path" in /*) ;; *) echo "Backup path must be absolute" >&2; exit 64 ;; esac
if [ ! -f "$dump_path" ] || [ ! -s "$dump_path" ]; then
  echo "Backup is missing or empty: $dump_path" >&2
  exit 66
fi
docker image inspect "$app_image" >/dev/null
pg_restore --list "$dump_path" >/dev/null

suffix="$(date -u +%Y%m%dT%H%M%SZ)-$$"
network="sealsend-rehearsal-$suffix"
database="sealsend-rehearsal-db-$suffix"
application="sealsend-rehearsal-app-$suffix"
password="$(openssl rand -hex 24)"

cleanup() {
  docker rm -f "$application" "$database" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker network create "$network" >/dev/null
docker run -d --name "$database" --network "$network" --network-alias database \
  -e POSTGRES_PASSWORD="$password" -e POSTGRES_DB=sealsend postgres:16-alpine >/dev/null

attempt=0
until docker exec "$database" pg_isready -U postgres -d sealsend >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 30 ] || { echo "Isolated PostgreSQL did not become ready" >&2; exit 1; }
  sleep 1
done

docker cp "$dump_path" "$database:/tmp/sealsend.dump"
docker exec "$database" pg_restore --exit-on-error --no-owner --no-privileges -U postgres -d sealsend /tmp/sealsend.dump >/dev/null
table_count="$(docker exec "$database" psql -U postgres -d sealsend -At -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'")"
[ "$table_count" -ge 30 ] || { echo "Restore has only $table_count public tables" >&2; exit 1; }
for table in admin_users events guests rsvp_responses webhook_receipts user_subscriptions; do
  docker exec "$database" psql -U postgres -d sealsend -At -v ON_ERROR_STOP=1 -c "SELECT 1 FROM $table LIMIT 0" >/dev/null
done

docker run -d --name "$application" --network "$network" \
  -e DATABASE_URL="postgresql://postgres:$password@database:5432/sealsend" \
  -e SESSION_SECRET="$(openssl rand -hex 32)" -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e NEXT_PUBLIC_SITE_URL="http://127.0.0.1:3000" \
  -e PAYMENTS_TEST_ONLY=true -e COMMUNICATIONS_TEST_ONLY=true \
  "$app_image" >/dev/null

attempt=0
until docker exec "$application" curl --fail --silent --show-error http://127.0.0.1:3000/api/health >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 60 ] || { docker logs "$application" >&2; echo "Restored application did not become healthy" >&2; exit 1; }
  sleep 1
done
status="$(docker exec "$application" curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:3000/api/events)"
[ "$status" = "401" ] || { echo "Restored application auth boundary returned $status" >&2; exit 1; }

echo "Recovery rehearsal passed: image=$app_image tables=$table_count health=200 unauthenticated_events=401"
