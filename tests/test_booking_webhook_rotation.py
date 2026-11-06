"""Local-only checks. Windows ACL commands are mocked on non-Windows runners."""
import contextlib
import importlib.util
import io
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('rotation', Path(__file__).resolve().parents[1] / 'scripts/booking-webhook-rotation.py')
rotation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rotation)


class RotationTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix='rotation-test-'))
        self.created = self.root / 'candidate with spaces'
        self.created.mkdir()
        self.key = 'a' * 64  # Public fixture, never a production credential.

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def generate(self, windows=False):
        output = io.StringIO()
        with patch.object(rotation, 'IS_WINDOWS', windows), patch.object(rotation.tempfile, 'mkdtemp', return_value=str(self.created)), patch.object(rotation.secrets, 'token_hex', return_value=self.key), contextlib.redirect_stdout(output):
            result = rotation.create()
        return result, output.getvalue()

    @unittest.skipIf(os.name == 'nt', 'POSIX permissions')
    def test_posix_private_inputs_match_and_never_print_value(self):
        result, output = self.generate()
        self.assertEqual(result, self.created)
        self.assertNotIn(self.key, output)
        self.assertTrue((result / 'next.env').read_text() == f'BOOKING_WEBHOOK_SECRET_NEXT={self.key}\n')
        self.assertTrue((result / 'primary.env').read_text() == f'BOOKING_WEBHOOK_SECRET={self.key}\n')
        self.assertTrue((result / 'scheduler.stdin').read_text() == self.key + '\n')
        self.assertEqual(result.stat().st_mode & 0o777, 0o700)
        self.assertTrue(all(p.stat().st_mode & 0o777 == 0o600 for p in result.iterdir()))

    @unittest.skipIf(os.name == 'nt', 'POSIX no-process fixture')
    def test_create_never_calls_providers_or_cli(self):
        with patch.object(rotation.urllib.request, 'build_opener', side_effect=AssertionError('network')), patch.object(rotation.subprocess, 'run', side_effect=AssertionError('CLI')):
            self.generate()

    @unittest.skipUnless(os.name == 'nt', 'Requires native Windows/NTFS')
    def test_native_windows_acl(self):
        result, output = self.generate(windows=True)
        rotation.windows_acl(result)
        for item in result.iterdir():
            rotation.windows_acl(item)
        self.assertNotIn(self.key, output)

    def test_windows_protects_before_generation_and_checks_all_files(self):
        events = []
        with patch.object(rotation, 'windows_acl', side_effect=lambda p, protect=False: events.append(('acl', p.name, protect))), patch.object(rotation, 'IS_WINDOWS', True), patch.object(rotation.tempfile, 'mkdtemp', return_value=str(self.created)), patch.object(rotation.secrets, 'token_hex', side_effect=lambda n: events.append(('generated', n)) or self.key), contextlib.redirect_stdout(io.StringIO()):
            rotation.create()
        self.assertEqual(events[0], ('acl', self.created.name, True))
        generated = events.index(('generated', 32))
        self.assertGreater(generated, 0)
        self.assertEqual(len([e for e in events if e[0] == 'acl']), 10)

    def test_windows_acl_failure_writes_no_secret_and_cleans_only_new_directory(self):
        with patch.object(rotation, 'IS_WINDOWS', True), patch.object(rotation.tempfile, 'mkdtemp', return_value=str(self.created)), patch.object(rotation, 'windows_acl', side_effect=ValueError('ACL denied')), patch.object(rotation.secrets, 'token_hex') as generator:
            with self.assertRaises(ValueError):
                rotation.create()
            generator.assert_not_called()
        self.assertFalse(self.created.exists())
        self.assertTrue(self.root.exists())

    def test_windows_powershell_uses_literal_env_path_and_no_policy_bypass(self):
        p = Path('folder with spaces')
        response = subprocess.CompletedProcess([], 0, stdout='{"ok":true}', stderr='')
        with patch.object(rotation.subprocess, 'run', return_value=response) as run:
            rotation.windows_acl(p, protect=True)
        args, kwargs = run.call_args
        self.assertIn('-NoProfile', args[0])
        self.assertNotIn('-ExecutionPolicy', args[0])
        self.assertEqual(kwargs['env']['AUTO_STILO_ACL_PATH'], str(p))
        self.assertEqual(kwargs['env']['AUTO_STILO_ACL_PROTECT'], '1')
        self.assertTrue(kwargs['capture_output'])
        self.assertIn('SetAccessRuleProtection($true, $false)', args[0][-1])
        self.assertIn('Set-Acl -LiteralPath', args[0][-1])

    def test_windows_failure_details_are_not_echoed(self):
        response = subprocess.CompletedProcess([], 1, stdout=self.key, stderr=self.key)
        with patch.object(rotation.subprocess, 'run', return_value=response):
            with self.assertRaises(ValueError) as error:
                rotation.windows_acl(self.created)
        self.assertNotIn(self.key, str(error.exception))

    def test_empty_files_are_protected_before_writing(self):
        def acl(path, protect=False):
            if protect and path.is_file():
                self.assertEqual(path.read_bytes(), b'')
        with patch.object(rotation, 'windows_acl', side_effect=acl):
            self.generate(windows=True)

    def test_failure_diagnostic_is_allowlisted_and_contains_no_identity_or_values(self):
        import json
        response = subprocess.CompletedProcess([], 1, stdout=json.dumps({
            'ok': False, 'stage': 'set_acl', 'reason': 'exception',
            'exception': 'UnauthorizedAccessException', 'hresult': -2147024891,
            'private_value': self.key, 'path': 'private path', 'sid': 'private sid',
        }), stderr=self.key)
        with patch.object(rotation.subprocess, 'run', return_value=response):
            with self.assertRaises(rotation.PrivateAccessError) as error:
                rotation.windows_acl(self.created)
        message = str(error.exception)
        self.assertIn('stage=set_acl', message)
        self.assertIn('UnauthorizedAccessException', message)
        self.assertNotIn(self.key, message)
        self.assertNotIn('private path', message)
        self.assertNotIn('private sid', message)

    def test_diagnose_generates_no_key_and_makes_no_network_request(self):
        with patch.object(rotation, 'IS_WINDOWS', False), patch.object(rotation.tempfile, 'mkdtemp', return_value=str(self.created)), patch.object(rotation.secrets, 'token_hex') as generator, patch.object(rotation.urllib.request, 'build_opener') as network, contextlib.redirect_stdout(io.StringIO()):
            rotation.diagnose_access()
        generator.assert_not_called()
        network.assert_not_called()
        self.assertFalse(self.created.exists())

    @unittest.skipIf(os.name == 'nt', 'POSIX permissions and symlinks')
    def test_private_file_rejects_symlink_and_public_permissions(self):
        self.created.chmod(0o755)
        with patch.object(rotation, 'IS_WINDOWS', False):
            with self.assertRaises(ValueError):
                rotation.secure_dir(self.created)
        self.created.chmod(0o700)
        link = self.root / 'link'
        link.symlink_to(self.created, target_is_directory=True)
        with self.assertRaises(ValueError):
            rotation.check_private(link)

    @unittest.skipIf(os.name == 'nt', 'POSIX no-network fixture')
    def test_verify_rejects_bad_file_before_network(self):
        self.created.chmod(0o700)
        secret = self.created / 'scheduler.stdin'
        secret.write_text('invalid')
        secret.chmod(0o600)
        with patch.object(rotation, 'IS_WINDOWS', False), patch.object(rotation.urllib.request, 'build_opener') as network:
            with self.assertRaises(ValueError):
                rotation.verify(self.created)
            network.assert_not_called()


if __name__ == '__main__':
    unittest.main()
