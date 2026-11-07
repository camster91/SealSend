#!/usr/bin/env bash
set -euo pipefail

# This signs only the generated simulator app in CI.  It deliberately uses
# Apple's ad-hoc identity and a temporary entitlement plist; no distribution
# certificate, provisioning profile, private key, or store artifact is used.
APP_PATH="${APP_PATH:?APP_PATH is required}"
OUTPUT_ROOT="${OUTPUT_ROOT:?OUTPUT_ROOT is required}"
BUNDLE_ID="${BUNDLE_ID:-com.ashbi.sealsend}"
TEAM_ID="${SEALSEND_TEAM_IDENTIFIER:-NVJ5UY3T2X}"
ENTITLEMENTS_PATH="${ENTITLEMENTS_PATH:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/sealsend-simulator.entitlements.plist}"

if [[ ! -d "$APP_PATH" || ! -s "$APP_PATH/SealSend" ]]; then
  echo "Simulator app is missing or incomplete: $APP_PATH" >&2
  exit 1
fi

mkdir -p "$OUTPUT_ROOT" "$(dirname "$ENTITLEMENTS_PATH")"

python3 - "$ENTITLEMENTS_PATH" "$BUNDLE_ID" "$TEAM_ID" <<'PY'
import plistlib
import sys
from pathlib import Path

output, bundle_id, team_id = sys.argv[1:]
plistlib.dump(
    {
        "application-identifier": f"{team_id}.{bundle_id}",
        "com.apple.developer.team-identifier": team_id,
        "get-task-allow": True,
        "keychain-access-groups": [f"{team_id}.{bundle_id}"],
    },
    Path(output).open("wb"),
    sort_keys=True,
)
PY

plutil -lint "$ENTITLEMENTS_PATH"

# The app and its embedded native code are built unsigned.  Deep ad-hoc
# signing is limited to this disposable simulator bundle and gives
# expo-secure-store the same public app/team/keychain identity as the
# existing signed IPA while retaining get-task-allow for simulator testing.
/usr/bin/codesign --force --deep --sign - \
  --entitlements "$ENTITLEMENTS_PATH" "$APP_PATH"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$APP_PATH"

{
  echo "entitlementsPath=$ENTITLEMENTS_PATH"
  echo "teamIdentifier=$TEAM_ID"
  echo "bundleIdentifier=$BUNDLE_ID"
  echo "keychainAccessGroup=$TEAM_ID.$BUNDLE_ID"
  /usr/bin/codesign -d --entitlements :- "$APP_PATH" 2>&1
} > "$OUTPUT_ROOT/code-signature.txt"

grep -q "$TEAM_ID.$BUNDLE_ID" "$OUTPUT_ROOT/code-signature.txt"
echo "Ad-hoc simulator signature verified for $BUNDLE_ID"
