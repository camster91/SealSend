#!/bin/sh
set -eu

backup_root="/opt/sealsend/backups/automated"
container="sealsend-postgres"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="$backup_root/sealsend-$timestamp.dump"
partial="$archive.partial"

mkdir -p "$backup_root"
chmod 700 "$backup_root"
trap 'rm -f "$partial"' EXIT HUP INT TERM

if ! docker inspect "$container" >/dev/null 2>&1; then
  echo "SealSend PostgreSQL container was not found" >&2
  exit 1
fi

docker exec "$container" sh -c \
  'pg_dump --format=custom --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  > "$partial"

test -s "$partial"
docker exec -i "$container" pg_restore --list < "$partial" >/dev/null
chmod 600 "$partial"
mv "$partial" "$archive"
trap - EXIT HUP INT TERM

find "$backup_root" -type f -name 'sealsend-*.dump' -mtime +30 -delete
echo "$archive"
