"""Prepare private local files or explicitly run an auth-only probe; never update secrets."""
import argparse
import datetime
import json
import os
import secrets
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

PROJECT = "jrzabortkpouqkwndpcq"
ENDPOINT = f"https://{PROJECT}.supabase.co/functions/v1/send-booking-push"
IS_WINDOWS = os.name == "nt"

# Only paths/flags cross this process boundary. No secret is passed to PowerShell.
WINDOWS_ACL_SCRIPT = r"""
$ErrorActionPreference = 'Stop'
$stage = 'get_identity'
function Fail-PrivateAcl([string]$reason) {
    [Console]::Out.Write((@{ok=$false; stage=$stage; reason=$reason} | ConvertTo-Json -Compress))
    exit 1
}
try {
    $path = $env:AUTO_STILO_ACL_PATH
    $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $stage = 'get_item'
    $item = Get-Item -LiteralPath $path -Force
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { Fail-PrivateAcl 'reparse_point' }
    if ($env:AUTO_STILO_ACL_PROTECT -eq '1') {
        $stage = 'build_acl'
        if ($item.PSIsContainer) {
            $acl = New-Object System.Security.AccessControl.DirectorySecurity
            $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
                $sid, [System.Security.AccessControl.FileSystemRights]::FullControl,
                [System.Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit',
                [System.Security.AccessControl.PropagationFlags]::None,
                [System.Security.AccessControl.AccessControlType]::Allow)
        } else {
            $acl = New-Object System.Security.AccessControl.FileSecurity
            $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
                $sid, [System.Security.AccessControl.FileSystemRights]::FullControl,
                [System.Security.AccessControl.AccessControlType]::Allow)
        }
        $acl.SetAccessRuleProtection($true, $false)
        $acl.SetOwner($sid)
        $acl.AddAccessRule($rule)
        $stage = 'set_acl'
        Set-Acl -LiteralPath $path -AclObject $acl
    }
    $stage = 'read_acl'
    $acl = Get-Acl -LiteralPath $path
    $stage = 'check_owner'
    if ($acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) { Fail-PrivateAcl 'owner_mismatch' }
    $stage = 'check_inheritance'
    if ($item.PSIsContainer -and -not $acl.AreAccessRulesProtected) { Fail-PrivateAcl 'unprotected_inheritance' }
    $stage = 'check_rules'
    $found = $false
    foreach ($rule in $acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])) {
        if ($rule.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow) {
            if ($rule.IdentityReference.Value -ne $sid.Value) { Fail-PrivateAcl 'other_principal_allowed' }
            if (($rule.FileSystemRights -band [System.Security.AccessControl.FileSystemRights]::FullControl) -eq [System.Security.AccessControl.FileSystemRights]::FullControl) { $found = $true }
        }
    }
    if (-not $found) { Fail-PrivateAcl 'full_control_missing' }
    [Console]::Out.Write('{"ok":true}')
} catch {
    $exception = $_.Exception
    while ($null -ne $exception.InnerException) { $exception = $exception.InnerException }
    [Console]::Out.Write((@{ok=$false; stage=$stage; reason='exception'; exception=$exception.GetType().Name; hresult=$exception.HResult} | ConvertTo-Json -Compress))
    exit 1
}
"""


class PrivateAccessError(ValueError):
    """Contains only allowlisted ACL diagnostics, never raw subprocess output."""


def windows_acl(path, protect=False):
    windows_root = os.environ.get("SystemRoot", r"C:\Windows")
    executable = Path(windows_root) / "System32/WindowsPowerShell/v1.0/powershell.exe"
    env = os.environ.copy()
    env.update(AUTO_STILO_ACL_PATH=str(path), AUTO_STILO_ACL_PROTECT="1" if protect else "0")
    try:
        result = subprocess.run(
            [str(executable), "-NoProfile", "-NonInteractive", "-Command", WINDOWS_ACL_SCRIPT],
            env=env, capture_output=True, text=True, timeout=30, check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        raise PrivateAccessError("Windows ACL: stage=start_powershell; reason=unavailable_or_timeout. No secret displayed.") from None
    try:
        data = json.loads(result.stdout) if len(result.stdout) < 2048 else {}
    except (ValueError, TypeError):
        data = {}
    if result.returncode == 0 and isinstance(data, dict) and data.get("ok") is True:
        return
    if not isinstance(data, dict):
        data = {}
    stages = {"get_identity", "get_item", "build_acl", "set_acl", "read_acl", "check_owner", "check_inheritance", "check_rules"}
    reasons = {"reparse_point", "owner_mismatch", "unprotected_inheritance", "other_principal_allowed", "full_control_missing", "exception"}
    types = {"UnauthorizedAccessException", "SecurityException", "ArgumentException", "PlatformNotSupportedException", "NotSupportedException", "IOException", "Win32Exception", "MethodException", "CommandNotFoundException"}
    stage = data.get("stage") if data.get("stage") in stages else "powershell_response"
    reason = data.get("reason") if data.get("reason") in reasons else "no_safe_diagnostic"
    exception = data.get("exception") if data.get("exception") in types else "unspecified"
    code = data.get("hresult") if type(data.get("hresult")) is int else 0
    raise PrivateAccessError(f"Windows ACL: stage={stage}; reason={reason}; exception={exception}; hresult={code}. No secret displayed.")


def check_private(path, directory=False):
    if path.is_symlink():
        raise ValueError("Private paths must not be symbolic links.")
    if IS_WINDOWS:
        if str(path).startswith("\\\\"):
            raise ValueError("Use a local private folder, not a network share.")
        windows_acl(path)
    else:
        if path.stat().st_uid != os.getuid() or path.stat().st_mode & 0o077:
            raise ValueError("Private paths must belong to you, with directory 700 / file 600 permissions.")
    if directory and not path.is_dir():
        raise ValueError("The private directory does not exist.")


def secure_dir(value):
    path = Path(value).absolute()
    check_private(path, directory=True)
    path = path.resolve()
    repo = Path(__file__).resolve().parents[1]
    if path == repo or repo in path.parents:
        raise ValueError("Use a private directory outside the repository.")
    return path


def create():
    path = Path(tempfile.mkdtemp(prefix="auto-stilo-webhook-rotation-"))
    try:
        # Protect the empty directory BEFORE generating or writing any secret.
        if IS_WINDOWS:
            windows_acl(path, protect=True)
        else:
            os.chmod(path, 0o700)
        secure_dir(path)
        key = secrets.token_hex(32)
        created = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        files = {
            "next.env": f"BOOKING_WEBHOOK_SECRET_NEXT={key}\n",
            "primary.env": f"BOOKING_WEBHOOK_SECRET={key}\n",
            "scheduler.stdin": key + "\n",
            "metadata.json": json.dumps({"createdAt": created, "bits": 256, "productionConfigured": False}, indent=2) + "\n",
        }
        for name, content in files.items():
            target = path / name
            fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
                if IS_WINDOWS:
                    windows_acl(target, protect=True)
                stream.write(content)
            check_private(target)
    except Exception:
        # Only this fresh, task-owned directory; no pre-existing user files.
        shutil.rmtree(path)
        raise
    print("Private files created. Secret value was not printed. Directory: " + str(path))
    return path


def diagnose_access():
    """Exercise the same ACL path using only an empty directory and empty file."""
    path = Path(tempfile.mkdtemp(prefix="auto-stilo-acl-diagnostic-"))
    try:
        if IS_WINDOWS:
            windows_acl(path, protect=True)
        else:
            os.chmod(path, 0o700)
        secure_dir(path)
        target = path / "empty-probe"
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8"):
            if IS_WINDOWS:
                windows_acl(target, protect=True)
            check_private(target)
        print("ACL diagnostic passed for an empty directory and file. No secret generated; no network call.")
    finally:
        shutil.rmtree(path)


def verify(directory):
    path = secure_dir(directory)
    target = path / "scheduler.stdin"
    check_private(target)
    if target.stat().st_size not in (64, 65, 66):
        raise ValueError("Invalid private file format.")
    key = target.read_text(encoding="utf-8").strip()
    if len(key) != 64 or any(c not in "0123456789abcdef" for c in key):
        raise ValueError("Invalid private file format.")

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None

    request = urllib.request.Request(
        ENDPOINT, data=b'{"type":"ROTATION_AUTH_PROBE"}',
        headers={"Content-Type": "application/json", "x-booking-webhook-secret": key}, method="POST",
    )
    try:
        # Explicit verify-next only; create never performs any network call.
        urllib.request.build_opener(NoRedirect()).open(request, timeout=15)
    except urllib.error.HTTPError as error:
        data = error.read(1024)
        if error.code == 400 and json.loads(data) == {"error": "Invalid booking event"}:
            print("PASS: new secret accepted. Auth-only probe; database and push not exercised.")
            return
        print("FAIL: auth-only probe returned HTTP " + str(error.code) + ". Response body omitted.")
        raise SystemExit(1)
    raise ValueError("Unexpected probe response; no production migration has been confirmed.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["create", "verify-next", "diagnose-access"])
    parser.add_argument("--directory")
    args = parser.parse_args()
    if args.command == "create":
        create()
    elif args.command == "diagnose-access":
        diagnose_access()
    elif args.directory:
        verify(args.directory)
    else:
        parser.error("--directory is required for verify-next")


if __name__ == "__main__":
    try:
        main()
    except ValueError as error:
        # Only curated messages, never arbitrary exception text/HTTP headers.
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
    except Exception:
        print("Operation failed. No secret values, headers or response bodies were logged.", file=sys.stderr)
        raise SystemExit(1)
