import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from zipfile import ZipFile

SCRIPT = Path(__file__).resolve().parents[1] / 'verify-android-bundle.py'
spec = importlib.util.spec_from_file_location('android_bundle', SCRIPT)
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class AndroidBundleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bundle = self.root / 'app-release.aab'
        self.config = self.root / 'app.json'
        self.out = self.root / 'artifact'
        self.env = dict(GITHUB_REPOSITORY='camster91/SealSend', GITHUB_SHA='a' * 40,
                        GITHUB_RUN_ID='123', EXPO_PUBLIC_API_URL='https://sealsend.app')
        with ZipFile(self.bundle, 'w') as archive:
            for name in ['base/assets/index.android.bundle', 'base/lib/arm64-v8a/libhermes.so',
                         'base/manifest/AndroidManifest.xml', 'META-INF/MANIFEST.MF',
                         'META-INF/ANDROID.SF', 'META-INF/ANDROID.RSA']:
                archive.writestr(name, b'payload')

    def verify(self, version='0.1.0', code=1, bundle_version=None, bundle_code=None,
               package='com.ashbi.sealsend', extra_permission=''):
        self.config.write_text(json.dumps({'expo': {'version': version, 'android': {
            'versionCode': code, 'package': 'com.ashbi.sealsend'}}}))
        manifest = f'''<manifest xmlns:android="http://schemas.android.com/apk/res/android"
            package="{package}" android:versionName="{bundle_version or version}"
            android:versionCode="{code if bundle_code is None else bundle_code}">
            <uses-permission android:name="android.permission.CAMERA"/>{extra_permission}</manifest>'''
        with patch.object(verifier.subprocess, 'check_output', return_value=manifest) as dump:
            verifier.verify_bundle(self.bundle, self.config, self.out, Path('bundletool.jar'), self.env)
            dump.assert_called_once_with(['java', '-jar', 'bundletool.jar', 'dump', 'manifest',
                                         f'--bundle={self.bundle}', '--module=base'], text=True)

    def test_current_and_incremented_versions_and_checksum_source_identity(self):
        for version, code in [('0.1.0', 1), ('0.2.0', 2), ('2.3.4', 42)]:
            with self.subTest(version=version, code=code):
                self.verify(version, code)
                source = json.loads((self.out / 'source.json').read_text())
                self.assertEqual((source['version'], source['versionCode']), (version, code))
                self.assertEqual(source['repository'], self.env['GITHUB_REPOSITORY'])
                self.assertEqual(source['commit'], self.env['GITHUB_SHA'])
                self.assertEqual(source['runId'], self.env['GITHUB_RUN_ID'])
                self.assertIs(source['signed'], False)
                checksums = (self.out / 'SHA256SUMS').read_text().splitlines()
                self.assertEqual({line.split('  ')[1] for line in checksums},
                                 {'SealSend-unsigned.aab', 'source.json'})
                for line in checksums:
                    digest, name = line.split('  ')
                    self.assertEqual(digest, hashlib.sha256((self.out / name).read_bytes()).hexdigest())
                with ZipFile(self.out / 'SealSend-unsigned.aab') as unsigned, ZipFile(self.bundle) as original:
                    self.assertFalse(any(n.startswith('META-INF/') for n in unsigned.namelist()))
                    for name in unsigned.namelist():
                        self.assertEqual(unsigned.read(name), original.read(name))
                for path in self.out.iterdir():
                    path.unlink()
                self.out.rmdir()

    def test_rejects_bundle_version_name_mismatch(self):
        with self.assertRaisesRegex(ValueError, 'versionName'):
            self.verify('0.2.0', 2, bundle_version='0.1.0')
        self.assertFalse(self.out.exists())

    def test_rejects_bundle_version_code_mismatch(self):
        with self.assertRaisesRegex(ValueError, 'versionCode'):
            self.verify('0.2.0', 2, bundle_code=1)
        self.assertFalse(self.out.exists())

    def test_rejects_missing_or_invalid_config_versions(self):
        for version, code in [(None, 1), ('', 1), ('0.1.0', None), ('0.1.0', '2'),
                              ('0.1.0', True), ('0.1.0', 0), ('0.1.0', 2.5), ('0.1.0', 2100000001)]:
            with self.subTest(version=version, code=code), self.assertRaises(ValueError):
                self.verify(version, code)
        self.assertFalse(self.out.exists())

    def test_rejects_wrong_package_or_blocked_permissions(self):
        with self.assertRaisesRegex(ValueError, 'package'):
            self.verify(package='com.other.app')
        with self.assertRaisesRegex(ValueError, 'permissions'):
            self.verify(extra_permission='<uses-permission android:name="android.permission.RECORD_AUDIO"/>')
        self.assertFalse(self.out.exists())

    def test_rejects_missing_javascript_hermes_or_wrong_architecture(self):
        for entries in [
            ['base/lib/arm64-v8a/libhermes.so'],
            ['base/assets/index.android.bundle', 'base/lib/arm64-v8a/libother.so'],
            ['base/assets/index.android.bundle', 'base/lib/arm64-v8a/libhermes.so',
             'base/lib/x86_64/libhermes.so'],
        ]:
            with self.subTest(entries=entries):
                with ZipFile(self.bundle, 'w') as archive:
                    for name in entries:
                        archive.writestr(name, b'payload')
                with self.assertRaises(AssertionError):
                    self.verify()
                self.assertFalse(self.out.exists())

    def test_bundletool_failure_does_not_create_artifacts(self):
        self.config.write_text(json.dumps({'expo': {'version': '0.1.0', 'android': {
            'versionCode': 1, 'package': 'com.ashbi.sealsend'}}}))
        with patch.object(verifier.subprocess, 'check_output', side_effect=verifier.subprocess.CalledProcessError(1, 'java')):
            with self.assertRaises(verifier.subprocess.CalledProcessError):
                verifier.verify_bundle(self.bundle, self.config, self.out, Path('bundletool.jar'), self.env)
        self.assertFalse(self.out.exists())


if __name__ == '__main__':
    unittest.main()
