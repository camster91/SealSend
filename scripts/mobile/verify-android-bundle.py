"""Verify the built AAB against Expo config before retaining an unsigned candidate."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import argparse
import hashlib
import json
import os
import re
import subprocess
import xml.etree.ElementTree as ET


def verify_bundle(original, config_path, out, bundletool, env):
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
        assert {n.split('/')[2] for n in entries if n.startswith('base/lib/') and n.endswith('.so')} == {'arm64-v8a'}
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
    print(f'Verified ARM64 bundle, embedded JS, identity, version {version} ({code}) and bounded permissions; '
          'generated development signature removed.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundletool', type=Path, required=True)
    args = parser.parse_args()
    verify_bundle(Path('apps/mobile/android/app/build/outputs/bundle/release/app-release.aab'),
                  Path('apps/mobile/app.json'),
                  Path(os.environ['RUNNER_TEMP']) / 'sealsend-android-artifact',
                  args.bundletool, os.environ)
