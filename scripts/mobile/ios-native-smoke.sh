#!/usr/bin/env bash
set -euo pipefail

# This harness is intentionally separate from the candidate source checkout.
# It builds the frozen Release simulator app, launches it on ephemeral devices,
# and retains native framebuffer evidence. It never signs, logs in, or changes
# the app's API origin.

EXPECTED_COMMIT="${EXPECTED_COMMIT:-75f7cff4b1d53403d39ba88a00aa91fd9d612583}"
BUNDLE_ID="com.ashbi.sealsend"
EXPECTED_VERSION="0.1.0"
EXPECTED_BUILD="3"
API_ORIGIN="${EXPO_PUBLIC_API_URL:-https://sealsend.app}"
SOURCE_ROOT="${SOURCE_ROOT:?SOURCE_ROOT is required}"
HARNESS_ROOT="${HARNESS_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
APP_PATH="${APP_PATH:?APP_PATH is required}"
OUTPUT_ROOT="${OUTPUT_ROOT:-${GITHUB_WORKSPACE:-$PWD}/artifacts/ios-native-smoke}"
RUN_ROOT="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/sealsend-ios-native-smoke"
VERIFY_BIN="$RUN_ROOT/verify-ios-native-smoke"

mkdir -p "$OUTPUT_ROOT" "$RUN_ROOT"

actual_commit="$(git -C "$SOURCE_ROOT" rev-parse HEAD)"
if [[ "$actual_commit" != "$EXPECTED_COMMIT" ]]; then
  echo "Expected candidate source $EXPECTED_COMMIT but checked out $actual_commit" >&2
  exit 1
fi

if [[ "$API_ORIGIN" != "https://sealsend.app" ]]; then
  echo "Unexpected API origin: native smoke requires https://sealsend.app" >&2
  exit 1
fi

if [[ ! -d "$APP_PATH" || ! -s "$APP_PATH/SealSend" || ! -s "$APP_PATH/main.jsbundle" || ! -s "$APP_PATH/Info.plist" ]]; then
  echo "Release simulator app is incomplete: $APP_PATH" >&2
  exit 1
fi

if ! /usr/bin/codesign --verify --deep --strict "$APP_PATH" >"$RUN_ROOT/code-signature-verify.txt" 2>&1; then
  cat "$RUN_ROOT/code-signature-verify.txt" >&2
  echo "Release simulator app is not ad-hoc signed with CI entitlements" >&2
  exit 1
fi

signed_entitlements="$RUN_ROOT/signed-entitlements.txt"
/usr/bin/codesign -d --entitlements :- "$APP_PATH" >"$signed_entitlements" 2>&1 || {
  cat "$signed_entitlements" >&2
  echo "Unable to read simulator app entitlements" >&2
  exit 1
}
for entitlement in "application-identifier" "com.apple.developer.team-identifier" "keychain-access-groups"; do
  if ! grep -q "$entitlement" "$signed_entitlements"; then
    echo "Missing simulator entitlement: $entitlement" >&2
    cat "$signed_entitlements" >&2
    exit 1
  fi
done
cp "$signed_entitlements" "$OUTPUT_ROOT/signed-entitlements.txt"

swiftc "$HARNESS_ROOT/scripts/mobile/verify-ios-native-smoke.swift" \
  -o "$VERIFY_BIN" \
  -framework AppKit \
  -framework Vision

app_identity="$OUTPUT_ROOT/release-simulator-app-identity.txt"
{
  echo "appPath=$APP_PATH"
  /usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP_PATH/Info.plist"
  /usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP_PATH/Info.plist"
  /usr/libexec/PlistBuddy -c 'Print :CFBundleSupportedPlatforms' "$APP_PATH/Info.plist"
  file "$APP_PATH/SealSend"
  lipo -info "$APP_PATH/SealSend"
  otool -l "$APP_PATH/SealSend" | grep -A 5 'LC_BUILD_VERSION' || true
} >"$app_identity" 2>&1

# Preserve the exact signed simulator app used by this diagnostic. The
# candidate contains only the embedded release bundle and no credentials.
if [[ ! -f "$OUTPUT_ROOT/release-simulator-app.zip" ]]; then
  ditto -c -k --keepParent "$APP_PATH" "$OUTPUT_ROOT/release-simulator-app.zip"
fi

python3 - "$APP_PATH" "$BUNDLE_ID" "$EXPECTED_VERSION" "$EXPECTED_BUILD" <<'PY'
import plistlib
import sys
from pathlib import Path

app = Path(sys.argv[1])
expected = {
    "CFBundleIdentifier": sys.argv[2],
    "CFBundleShortVersionString": sys.argv[3],
    "CFBundleVersion": sys.argv[4],
}
with (app / "Info.plist").open("rb") as handle:
    info = plistlib.load(handle)
for key, value in expected.items():
    if info.get(key) != value:
        raise SystemExit(f"Unexpected {key}: {info.get(key)!r}; expected {value!r}")
if info.get("CFBundleSupportedPlatforms") != ["iPhoneSimulator"]:
    raise SystemExit(f"Expected simulator platform, got {info.get('CFBundleSupportedPlatforms')!r}")
PY

runtime_id="$(xcrun simctl list runtimes --json | python3 -c '
import json, sys
runtimes = []
for runtime in json.load(sys.stdin).get("runtimes", []):
    identifier = runtime.get("identifier", "")
    if runtime.get("isAvailable") and identifier.startswith("com.apple.CoreSimulator.SimRuntime.iOS-"):
        try:
            version = tuple(int(part) for part in runtime.get("version", "0").split("."))
        except ValueError:
            continue
        runtimes.append((version, identifier))
print(max(runtimes)[1] if runtimes else "")
')"
if [[ -z "$runtime_id" ]]; then
  echo "No available iOS Simulator runtime found" >&2
  exit 1
fi

device_type_id() {
  xcrun simctl list devicetypes --json | python3 -c '
import json, sys
wanted = set(sys.argv[1:])
for device in json.load(sys.stdin).get("devicetypes", []):
    if device.get("name") in wanted:
        print(device["identifier"])
        break
' "$@"
}

iphone_type="$(device_type_id 'iPhone 16 Pro Max')"
ipad_type="$(device_type_id 'iPad Pro 13-inch (M4)' 'iPad Pro (13-inch) (M4)')"
if [[ -z "$iphone_type" || -z "$ipad_type" ]]; then
  echo "Required iPhone 16 Pro Max and iPad Pro 13-inch (M4) simulator types are unavailable" >&2
  xcrun simctl list devicetypes --json >&2
  exit 1
fi

created_devices=()
CREATED_UDID=""
CONSOLE_LAUNCH_PID=""
LAUNCHED_APP_PID=""

stop_console_launcher() {
  local launcher_pid="${CONSOLE_LAUNCH_PID:-}"
  if [[ "$launcher_pid" =~ ^[0-9]+$ ]] && kill -0 "$launcher_pid" 2>/dev/null; then
    kill "$launcher_pid" 2>/dev/null || true
    for _ in 1 2 3 4 5; do
      kill -0 "$launcher_pid" 2>/dev/null || break
      sleep 1
    done
    kill -KILL "$launcher_pid" 2>/dev/null || true
    wait "$launcher_pid" 2>/dev/null || true
  fi
  CONSOLE_LAUNCH_PID=""
}

cleanup() {
  stop_console_launcher
  for udid in "${created_devices[@]}"; do
    xcrun simctl shutdown "$udid" >/dev/null 2>&1 || true
    xcrun simctl delete "$udid" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT

create_device() {
  local label="$1" type_id="$2"
  local name="SealSend native smoke ${label} ${GITHUB_RUN_ID:-local}"
  local bootstatus_log="$OUTPUT_ROOT/$label-bootstatus.log"
  CREATED_UDID="$(xcrun simctl create "$name" "$type_id" "$runtime_id")"
  created_devices+=("$CREATED_UDID")
  xcrun simctl boot "$CREATED_UDID" >/dev/null
  xcrun simctl bootstatus "$CREATED_UDID" -b >"$bootstatus_log" 2>&1
  cat "$bootstatus_log" >&2
}

run_bounded() {
  local timeout_seconds="$1" output_file="$2"
  shift 2
  "$@" >"$output_file" 2>&1 &
  local child="$!"
  local deadline=$((SECONDS + timeout_seconds))
  while kill -0 "$child" 2>/dev/null; do
    if (( SECONDS >= deadline )); then
      kill "$child" 2>/dev/null || true
      wait "$child" 2>/dev/null || true
      return 124
    fi
    sleep 1
  done
  wait "$child"
}

assert_live_pid() {
  local udid="$1" pid="$2" process_list
  process_list="$(xcrun simctl spawn "$udid" ps -p "$pid" -o pid=,comm= 2>&1 || true)"
  if awk -v expected="$pid" '$1 == expected { found = 1 } END { exit found ? 0 : 1 }' <<<"$process_list"; then
    LIVE_PROCESS_CHECK="simulator ps: $process_list"
    return 0
  fi
  # Current macOS 26 runtimes may not ship a spawnable `ps` binary. simctl's
  # launch response is still the authoritative app PID; kill -0 confirms that
  # the corresponding process remains live on the runner in that environment.
  if kill -0 "$pid" 2>/dev/null; then
    LIVE_PROCESS_CHECK="host kill -0 for simctl PID $pid (simulator ps unavailable: $process_list)"
    return 0
  fi
  LIVE_PROCESS_CHECK="$process_list"
  printf '%s\n' "$process_list"
  return 1
}

launch_with_console() {
  local udid="$1" bundle_id="$2" output_file="$3"
  local launcher_pid app_pid launch_status deadline
  : >"$output_file"
  LAUNCHED_APP_PID=""
  xcrun simctl launch --console "$udid" "$bundle_id" >"$output_file" 2>&1 &
  launcher_pid="$!"
  CONSOLE_LAUNCH_PID="$launcher_pid"
  deadline=$((SECONDS + 45))

  while kill -0 "$launcher_pid" 2>/dev/null; do
    app_pid="$(sed -nE 's/.*: ([0-9]+)$/\1/p' "$output_file" | tail -1 || true)"
    if [[ "$app_pid" =~ ^[0-9]+$ ]]; then
      sleep 2
      if assert_live_pid "$udid" "$app_pid" >/dev/null 2>&1; then
        printf 'consoleLauncherPid=%s\nappPid=%s\n' "$launcher_pid" "$app_pid" >>"$output_file"
        LAUNCHED_APP_PID="$app_pid"
        return 0
      fi
    fi
    if (( SECONDS >= deadline )); then
      stop_console_launcher
      return 124
    fi
    sleep 1
  done

  set +e
  wait "$launcher_pid"
  launch_status="$?"
  set -e
  CONSOLE_LAUNCH_PID=""
  app_pid="$(sed -nE 's/.*: ([0-9]+)$/\1/p' "$output_file" | tail -1 || true)"
  if [[ "$app_pid" =~ ^[0-9]+$ ]] && assert_live_pid "$udid" "$app_pid" >/dev/null 2>&1; then
    LAUNCHED_APP_PID="$app_pid"
    return 0
  fi
  return "$launch_status"
}

collect_launch_diagnostics() {
  local udid="$1" label="$2"
  local diagnostics_root="$OUTPUT_ROOT/$label-launch-diagnostics"
  mkdir -p "$diagnostics_root"
  run_bounded 30 "$diagnostics_root/unified-log.txt" \
    xcrun simctl spawn "$udid" log show --last 5m --style compact \
      --predicate 'eventMessage CONTAINS[c] "SealSend" OR process CONTAINS[c] "SealSend"' || true
  run_bounded 20 "$diagnostics_root/launchctl.txt" \
    xcrun simctl spawn "$udid" launchctl print system || true
  run_bounded 20 "$diagnostics_root/crash-reports.txt" \
    collect_host_crash_reports "$diagnostics_root" || true
}

collect_host_crash_reports() {
  local diagnostics_root="$1"
  local crash_paths="$diagnostics_root/crash-report-paths.txt"
  find "$HOME/Library/Logs/DiagnosticReports" -maxdepth 1 -type f \
    -iname '*SealSend*' -mmin -10 -print 2>/dev/null >"$crash_paths" || true
  while IFS= read -r crash_path; do
    [[ -f "$crash_path" ]] || continue
    cp "$crash_path" "$diagnostics_root/$(basename "$crash_path")"
  done <"$crash_paths"
}

record_installed_identity() {
  local udid="$1" label="$2" installed_app info_plist executable binary
  local installed_identifier installed_version installed_build installed_platform
  local signature_status entitlements_status
  local identity_file="$OUTPUT_ROOT/$label-installed-identity.txt"
  local signature_file="$OUTPUT_ROOT/$label-installed-code-signature.txt"
  local entitlements_file="$OUTPUT_ROOT/$label-installed-entitlements.txt"
  local container_error="$OUTPUT_ROOT/$label-installed-container-error.txt"
  if ! installed_app="$(xcrun simctl get_app_container "$udid" "$BUNDLE_ID" app 2>"$container_error")"; then
    cat "$container_error" >&2
    return 1
  fi
  info_plist="$installed_app/Info.plist"
  executable="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$info_plist")"
  binary="$installed_app/$executable"
  installed_identifier="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$info_plist")"
  installed_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$info_plist")"
  installed_build="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$info_plist")"
  installed_platform="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleSupportedPlatforms:0' "$info_plist")"
  if [[ "$installed_identifier" != "$BUNDLE_ID" || \
    "$installed_version" != "$EXPECTED_VERSION" || \
    "$installed_build" != "$EXPECTED_BUILD" || \
    "$installed_platform" != "iPhoneSimulator" ]]; then
    echo "Installed app identity mismatch: $installed_identifier $installed_version ($installed_build) $installed_platform" >&2
    return 1
  fi
  {
    echo "installedApp=$installed_app"
    echo "bundleIdentifier=$installed_identifier"
    echo "version=$installed_version"
    echo "build=$installed_build"
    echo "supportedPlatform=$installed_platform"
    echo "executable=$executable"
    file "$binary"
    lipo -info "$binary"
    otool -l "$binary" | grep -A 5 'LC_BUILD_VERSION' || true
  } >"$identity_file" 2>&1
  if /usr/bin/codesign --verify --deep --strict "$installed_app" >"$signature_file" 2>&1; then
    signature_status=0
  else
    signature_status="$?"
  fi
  if /usr/bin/codesign -d --entitlements :- "$installed_app" >"$entitlements_file" 2>&1; then
    entitlements_status=0
  else
    entitlements_status="$?"
  fi
  if (( signature_status != 0 )); then
    return "$signature_status"
  fi
  if (( entitlements_status != 0 )); then
    return "$entitlements_status"
  fi
}

capture_screen() {
  local udid="$1" label="$2" width="$3" height="$4" tokens="$5" pid="$6"
  local screenshot="$OUTPUT_ROOT/$label.png"
  local verification_error="$OUTPUT_ROOT/$label-verification-error.txt"
  local launch_output="$7"
  local attempt=1
  local deadline=$((SECONDS + 90))
  local verification=""
  local process_check=""
  : > "$verification_error"

  while (( SECONDS < deadline )); do
    if ! assert_live_pid "$udid" "$pid"; then
      {
        printf 'label=%s\npid=%s\nlaunchOutput=%s\nliveProcessCheck=%s\n' "$label" "$pid" "$launch_output" "$LIVE_PROCESS_CHECK"
        printf 'attempt=%s\n' "$attempt"
      } > "$OUTPUT_ROOT/$label-failure.txt"
      echo "SealSend PID $pid is not live on simulator $udid ($label)" >&2
      return 1
    fi
    process_check="$LIVE_PROCESS_CHECK"

    xcrun simctl io "$udid" screenshot "$screenshot"
    if verification="$($VERIFY_BIN "$screenshot" "$width" "$height" "$tokens" 2>"$verification_error")"; then
      local sha256
      sha256="$(shasum -a 256 "$screenshot" | awk '{print $1}')"
      VERIFY_JSON="$verification" SHA256="$sha256" DEVICE_UDID="$udid" SOURCE_COMMIT="$actual_commit" \
        LABEL="$label" PID="$pid" LAUNCH_OUTPUT="$launch_output" PROCESS_CHECK="$process_check" \
        API_ORIGIN="$API_ORIGIN" python3 - "$OUTPUT_ROOT/$label.json" <<'PY'
import json
import os
import sys

payload = json.loads(os.environ["VERIFY_JSON"])
payload.update({
    "label": os.environ["LABEL"],
    "deviceUdid": os.environ["DEVICE_UDID"],
    "pid": int(os.environ["PID"]),
    "pidEvidence": "simctl launch numeric PID plus live-process check",
    "liveProcessCheck": os.environ["PROCESS_CHECK"],
    "launchOutput": os.environ["LAUNCH_OUTPUT"],
    "sourceCommit": os.environ["SOURCE_COMMIT"],
    "bundleId": "com.ashbi.sealsend",
    "apiOrigin": os.environ["API_ORIGIN"],
    "sha256": os.environ["SHA256"],
})
with open(sys.argv[1], "w", encoding="utf-8") as handle:
    json.dump(payload, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY
      printf '%s %s %s\n' "$label" "$pid" "$sha256"
      return 0
    fi
    echo "Native content not ready for $label (attempt $attempt, ${SECONDS}s elapsed): $(tr '\n' ' ' <"$verification_error")" >&2
    attempt=$((attempt + 1))
    sleep 5
  done

  {
    printf 'label=%s\npid=%s\nlaunchOutput=%s\nliveProcessCheck=%s\nattempts=%s\nelapsedSeconds=%s\n' \
      "$label" "$pid" "$launch_output" "$process_check" "$attempt" "$SECONDS"
    printf 'lastVerificationError='
    tr '\n' ' ' < "$verification_error"
    printf '\n'
  } > "$OUTPUT_ROOT/$label-failure.txt"
  echo "Native app content was not detected after ${SECONDS}s ($label); see $OUTPUT_ROOT/$label-failure.txt" >&2
  return 1
}

capture_device() {
  local label="$1" width="$2" height="$3" type_id="$4"
  local udid launch_output pid install_log launch_log install_status launch_status
  create_device "$label" "$type_id"
  udid="$CREATED_UDID"
  install_log="$OUTPUT_ROOT/$label-install.log"
  launch_log="$OUTPUT_ROOT/$label-launch.log"
  set +e
  run_bounded 180 "$install_log" xcrun simctl install "$udid" "$APP_PATH"
  install_status="$?"
  set -e
  if (( install_status != 0 )); then
    {
      printf 'label=%s\nudid=%s\ninstallStatus=%s\ninstallLog=%s\n' \
        "$label" "$udid" "$install_status" "$install_log"
      cat "$install_log"
    } > "$OUTPUT_ROOT/$label-install-failure.txt"
    echo "simctl install failed for $label (status $install_status); see $install_log" >&2
    return 1
  fi
  set +e
  record_installed_identity "$udid" "$label"
  local identity_status="$?"
  set -e
  if (( identity_status != 0 )); then
    collect_launch_diagnostics "$udid" "$label"
    echo "Installed SealSend identity verification failed for $label; see $OUTPUT_ROOT/$label-installed-*" >&2
    return 1
  fi
  set +e
  LAUNCHED_APP_PID=""
  launch_with_console "$udid" "$BUNDLE_ID" "$launch_log"
  launch_status="$?"
  pid="$LAUNCHED_APP_PID"
  set -e
  launch_output="$(cat "$launch_log")"
  if (( launch_status != 0 )); then
    collect_launch_diagnostics "$udid" "$label"
    {
      printf 'label=%s\nudid=%s\nlaunchStatus=%s\nlaunchLog=%s\n' \
        "$label" "$udid" "$launch_status" "$launch_log"
      cat "$launch_log"
    } > "$OUTPUT_ROOT/$label-launch-failure.txt"
    echo "simctl launch failed for $label (status $launch_status); see $launch_log" >&2
    return 1
  fi
  printf '%s\n' "$launch_output"
  if [[ ! "$pid" =~ ^[0-9]+$ ]]; then
    collect_launch_diagnostics "$udid" "$label"
    printf 'label=%s\nlaunchOutput=%s\n' "$label" "$launch_output" > "$OUTPUT_ROOT/$label-failure.txt"
    echo "simctl did not return a native app PID ($label): $launch_output" >&2
    return 1
  fi

  # Capture the source-owned first-run welcome screen, then use the ephemeral
  # XCTest UI target to activate the real Host a gathering accessibility
  # control. No guessed coordinates, deep links, injected JS, credentials, or
  # mocked network state are used.
  capture_screen "$udid" "$label-startup" "$width" "$height" \
    'good plans,host a gathering,sealsend,free host beta' "$pid" "$launch_output"
  UI_TEST_DEVICE_UDID="$udid" \
  UI_TEST_OUTPUT_ROOT="$OUTPUT_ROOT/$label-ui-test" \
  "$HARNESS_ROOT/scripts/mobile/run-sealsend-ui-test.sh"
  capture_screen "$udid" "$label-login" "$width" "$height" \
    'welcome host,email address,send sign-in code,sealsend' "$pid" "$launch_output"

  # Keep the console launcher attached through all liveness/UI checks. Stop it
  # only after this device's evidence is complete; the EXIT trap covers early
  # failures and preserves the parent-shell PID for cleanup.
  stop_console_launcher
  xcrun simctl shutdown "$udid" >/dev/null 2>&1 || true
  xcrun simctl delete "$udid" >/dev/null 2>&1 || true
}

app_binary_sha256="$(shasum -a 256 "$APP_PATH/SealSend" | awk '{print $1}')"
js_bundle_sha256="$(shasum -a 256 "$APP_PATH/main.jsbundle" | awk '{print $1}')"
xcode_version="$(xcodebuild -version | tr '\n' ' ')"
app_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP_PATH/Info.plist")"
app_build="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP_PATH/Info.plist")"

capture_device iphone-16-pro-max 1320 2868 "$iphone_type"
capture_device ipad-pro-13-m4 2064 2752 "$ipad_type"

HARNESS_COMMIT="$(git -C "$HARNESS_ROOT" rev-parse HEAD)" \
SOURCE_COMMIT="$actual_commit" RUNTIME_ID="$runtime_id" XCODE_VERSION="$xcode_version" \
APP_VERSION="$app_version" APP_BUILD="$app_build" APP_BINARY_SHA256="$app_binary_sha256" \
JS_BUNDLE_SHA256="$js_bundle_sha256" API_ORIGIN="$API_ORIGIN" OUTPUT_ROOT="$OUTPUT_ROOT" \
python3 - <<'PY'
import json
import os
from pathlib import Path

root = Path(os.environ["OUTPUT_ROOT"])

def read(name):
    with (root / name).open(encoding="utf-8") as handle:
        return json.load(handle)

payload = {
    "app": "SealSend",
    "bundleId": "com.ashbi.sealsend",
    "version": os.environ["APP_VERSION"],
    "build": os.environ["APP_BUILD"],
    "sourceCommit": os.environ["SOURCE_COMMIT"],
    "harnessCommit": os.environ["HARNESS_COMMIT"],
    "xcodeVersion": os.environ["XCODE_VERSION"],
    "runtimeId": os.environ["RUNTIME_ID"],
    "apiOrigin": os.environ["API_ORIGIN"],
    "mode": "Release simulator app with embedded JS bundle",
    "appBinarySha256": os.environ["APP_BINARY_SHA256"],
    "jsBundleSha256": os.environ["JS_BUNDLE_SHA256"],
    "devices": [read("iphone-16-pro-max-startup.json"), read("iphone-16-pro-max-login.json"),
                read("ipad-pro-13-m4-startup.json"), read("ipad-pro-13-m4-login.json")],
    "dataMode": "empty first-run; login screen reached by declared sealsend://login route; no credentials",
    "captureMethod": "xcrun simctl io screenshot after native simulator launch/openurl",
    "nativeContentVerification": "Vision OCR requires at least two source-owned UI tokens and exact native pixel dimensions",
}
with (root / "manifest.json").open("w", encoding="utf-8") as handle:
    json.dump(payload, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY

printf '%s\n' "SealSend native simulator smoke evidence written to $OUTPUT_ROOT"
