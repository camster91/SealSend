"""Verify the built AAB against Expo config before retaining an unsigned candidate.

The default mode preserves the original single-ABI regression guard. The native
candidate workflow opts into Expo's checked-in/default ABI set while still
requiring the arm64 Hermes runtime needed by supported devices.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import argparse
import hashlib
import json
import os
import re
import subprocess
import xml.etree.ElementTree as ET


def verify_bundle(original, config_path, out, bundletool, env, allow_default_abis=False):
    expo = json.loads(config_path.read_text())['expo']
    version = expo.get('version')
    code = expo.get('android', {}).get('versionCode')
    if not isinstance(version, str) or not version.strip():
        raise ValueError('Expo version must be a non-empty string')
    if type(code) is not int or not 1 <= code <= 2100000000:
        raise ValueError('Expo android.versionCode must be a positive Play-compatible integer')

    # Read the protobuf manifest IN the actual AAB, not an intermediate Gradle XML.
    manifest = ET.fromstring(subprocess.check_output(
        ['java', '-jar', str(bundletool), 'dump', 'manifest',
         f'--bundle={original}', '--module=base'], text=True))
    android = '{http://schemas.android.com/apk/res/android}'
    package = manifest.attrib['package']
    if package != 'com.ashbi.sealsend' or package != expo['android']['package']:
        raise ValueError(f'Bundle package differs from SealSend Expo configuration: {package}')
    if manifest.get(android + 'versionName') != version:
        raise ValueError('Bundle versionName differs from Expo version')
    if manifest.get(android + 'versionCode') != str(code):
        raise ValueError('Bundle versionCode differs from Expo android.versionCode')
    permissions = {node.attrib[android + 'name'] for node in manifest.findall('uses-permission')}
    blocked = {'RECORD_AUDIO', 'READ_CONTACTS', 'WRITE_CONTACTS', 'READ_CALENDAR', 'WRITE_CALENDAR',
               'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO',
               'READ_MEDIA_AUDIO', 'SYSTEM_ALERT_WINDOW', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'}
    if 'android.permission.CAMERA' not in permissions or permissions.intersection(
            {'android.permission.' + p for p in blocked}):
        raise ValueError(f'Unexpected bundle permissions: {sorted(permissions)}')

    with ZipFile(original) as archive:
        entries = archive.namelist()
        assert 'base/assets/index.android.bundle' in entries
        assert any(n.startswith('base/lib/arm64-v8a/libhermes') for n in entries)
        abi_set = {n.split('/')[2] for n in entries if n.startswith('base/lib/') and n.endswith('.so')}
        assert 'arm64-v8a' in abi_set
        if not allow_default_abis:
            assert abi_set == {'arm64-v8a'}
        out.mkdir()
        with ZipFile(out / 'SealSend-unsigned.aab', 'w', ZIP_DEFLATED) as unsigned:
            for entry in archive.infolist():
                if re.fullmatch(r'META-INF/(?:MANIFEST\.MF|[^/]+\.(?:SF|RSA|DSA|EC))', entry.filename, re.I):
                    continue
                unsigned.writestr(entry, archive.read(entry))
    (out / 'source.json').write_text(json.dumps({
        'repository': env['GITHUB_REPOSITORY'], 'commit': env['GITHUB_SHA'],
        'runId': env['GITHUB_RUN_ID'], 'package': package, 'version': version, 'versionCode': code,
        'signed': False, 'apiOrigin': env['EXPO_PUBLIC_API_URL'],
        'permissions': sorted(permissions)}, indent=2) + '\n')
    (out / 'SHA256SUMS').write_text(''.join(
        hashlib.sha256(p.read_bytes()).hexdigest() + '  ' + p.name + '\n'
        for p in sorted(out.iterdir()) if p.is_file()))
    architecture_summary = 'Expo/default ABI set' if allow_default_abis else 'ARM64-only'
    print(f'Verified {architecture_summary} bundle, embedded JS, identity, version {version} ({code}) and bounded permissions; '
          'generated development signature removed.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundletool', type=Path, required=True)
    parser.add_argument('--allow-default-abis', action='store_true',
                        help="Accept Expo's default ABI set while requiring arm64-v8a Hermes.")
    args = parser.parse_args()
    verify_bundle(Path('apps/mobile/android/app/build/outputs/bundle/release/app-release.aab'),
                  Path('apps/mobile/app.json'),
                  Path(os.environ['RUNNER_TEMP']) / 'sealsend-android-artifact',
                  args.bundletool, os.environ, args.allow_default_abis)
