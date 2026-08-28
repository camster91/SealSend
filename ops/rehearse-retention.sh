#!/bin/sh
set -eu

source_dir="${1:-.}"
commit_label="${2:-uncommitted}"
if [ "${SEALSEND_RETENTION_REHEARSAL_CONFIRM:-}" != "isolated" ]; then
  echo "Set SEALSEND_RETENTION_REHEARSAL_CONFIRM=isolated to run the disposable retention rehearsal" >&2
  exit 64
fi
if [ ! -f "$source_dir/Dockerfile" ] || [ ! -f "$source_dir/src/lib/db/schema.sql" ]; then
  echo "Source directory must contain Dockerfile and src/lib/db/schema.sql" >&2
  exit 66
fi
case "$commit_label" in
  *[!A-Za-z0-9._-]*) echo "Commit label contains unsupported characters" >&2; exit 64 ;;
esac

suffix="$(date -u +%Y%m%dT%H%M%SZ)-$$"
prefix="sealsend-retention-ci-$suffix"
image="$prefix:$commit_label"
network="$prefix-network"
database="$prefix-db"
application="$prefix-app"
database_password="$(openssl rand -hex 24)"
cron_secret="$(openssl rand -hex 32)"
session_secret="$(openssl rand -hex 32)"

cleanup() {
  docker rm -f "$application" "$database" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  docker image rm -f "$image" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker build --pull -t "$image" "$source_dir" >/dev/null
docker network create "$network" >/dev/null
docker run -d --name "$database" --network "$network" --network-alias database \
  -e POSTGRES_PASSWORD="$database_password" -e POSTGRES_DB=sealsend_retention \
  postgres:16-alpine >/dev/null

attempt=0
until docker exec "$database" pg_isready -U postgres -d sealsend_retention >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 30 ] || { echo "Disposable PostgreSQL did not become ready" >&2; exit 1; }
  sleep 1
done

docker cp "$source_dir/src/lib/db/schema.sql" "$database:/tmp/schema.sql"
docker exec "$database" psql -v ON_ERROR_STOP=1 -U postgres -d sealsend_retention -f /tmp/schema.sql >/dev/null
docker exec -i "$database" psql -v ON_ERROR_STOP=1 -U postgres -d sealsend_retention >/dev/null <<'SQL'
INSERT INTO admin_users (id, email, password, name)
VALUES ('11111111-1111-4111-8111-111111111111', 'retention@example.test', 'not-a-login-hash', 'Retention QA');

INSERT INTO events (id, user_id, title, slug, status, updated_at) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'Warned long enough', 'retention-warned-long-enough', 'draft', NOW() - INTERVAL '100 days'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '11111111-1111-4111-8111-111111111111', 'Never warned', 'retention-never-warned', 'draft', NOW() - INTERVAL '100 days'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', '11111111-1111-4111-8111-111111111111', 'Warned too recently', 'retention-warned-too-recently', 'draft', NOW() - INTERVAL '100 days'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4', '11111111-1111-4111-8111-111111111111', 'Edited after warning', 'retention-edited-after-warning', 'draft', NOW() - INTERVAL '100 days'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5', '11111111-1111-4111-8111-111111111111', 'Warning window', 'retention-warning-window', 'draft', NOW() - INTERVAL '80 days');

INSERT INTO host_lifecycle_notifications
  (user_id, event_id, notification_type, scope_key, sent_at)
SELECT user_id, id, 'stale_draft_warning',
       'stale_draft_warning:' || id::text || ':' || EXTRACT(EPOCH FROM updated_at)::bigint::text || ':90',
       NOW() - INTERVAL '15 days'
  FROM events WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

INSERT INTO host_lifecycle_notifications
  (user_id, event_id, notification_type, scope_key, sent_at)
SELECT user_id, id, 'stale_draft_warning',
       'stale_draft_warning:' || id::text || ':' || EXTRACT(EPOCH FROM updated_at)::bigint::text || ':90',
       NOW() - INTERVAL '10 days'
  FROM events WHERE id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';

INSERT INTO host_lifecycle_notifications
  (user_id, event_id, notification_type, scope_key, sent_at)
SELECT user_id, id, 'stale_draft_warning',
       'stale_draft_warning:' || id::text || ':0:90',
       NOW() - INTERVAL '15 days'
  FROM events WHERE id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4';
SQL

docker run -d --name "$application" --network "$network" \
  -e DATABASE_URL="postgresql://postgres:$database_password@database:5432/sealsend_retention" \
  -e SESSION_SECRET="$session_secret" -e JWT_SECRET="$session_secret" \
  -e CRON_SECRET="$cron_secret" -e NEXT_PUBLIC_SITE_URL="http://127.0.0.1:3000" \
  -e PAYMENTS_TEST_ONLY=true -e COMMUNICATIONS_TEST_ONLY=true \
  -e ENABLE_HOST_LIFECYCLE_EMAILS=false -e ENABLE_STALE_DRAFT_CLEANUP=true \
  -e STALE_DRAFT_RETENTION_DAYS=90 -e STALE_DRAFT_WARNING_DAYS=14 \
  "$image" >/dev/null

attempt=0
until docker exec "$application" curl --fail --silent --show-error http://127.0.0.1:3000/api/health >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 60 ] || { docker logs "$application" >&2; echo "Disposable application did not become healthy" >&2; exit 1; }
  sleep 1
done

lifecycle_json="$(docker exec "$application" curl --fail --silent --show-error \
  -H "Authorization: Bearer $cron_secret" http://127.0.0.1:3000/api/cron/send-host-lifecycle)"
printf '%s' "$lifecycle_json" | grep -F '"enabled":false' >/dev/null
printf '%s' "$lifecycle_json" | grep -F '"candidates":6' >/dev/null

cleanup_json="$(docker exec "$application" curl --fail --silent --show-error \
  -H "Authorization: Bearer $cron_secret" http://127.0.0.1:3000/api/cron/cleanup-drafts)"
printf '%s' "$cleanup_json" | grep -F '"candidates":4' >/dev/null
printf '%s' "$cleanup_json" | grep -F '"warnedCandidates":1' >/dev/null
printf '%s' "$cleanup_json" | grep -F '"blockedWithoutWarning":3' >/dev/null
printf '%s' "$cleanup_json" | grep -F '"deleted":1' >/dev/null

remaining_events="$(docker exec "$database" psql -U postgres -d sealsend_retention -At -c \
  "SELECT COUNT(*) FROM events WHERE status = 'draft' AND updated_at < NOW() - INTERVAL '90 days'")"
[ "$remaining_events" = "3" ] || { echo "Expected three blocked stale drafts, found $remaining_events" >&2; exit 1; }
deleted_event="$(docker exec "$database" psql -U postgres -d sealsend_retention -At -c \
  "SELECT COUNT(*) FROM events WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'")"
[ "$deleted_event" = "0" ] || { echo "Fully warned draft was not deleted" >&2; exit 1; }

echo "Retention rehearsal passed: commit=$commit_label schema=PostgreSQL16 candidates=4 warned=1 blocked=3 deleted=1 remaining_events=$remaining_events lifecycle_candidates=6"
