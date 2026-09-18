#!/usr/bin/env python3
"""Build and install the local background server. Tailscale routing is separate."""

from pathlib import Path
import os
import plistlib
import shutil
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parent
RUNTIME = Path.home() / "Library/Application Support/Cooperative Alignment"
LABEL = "local.cooperative-alignment.web"
PLIST = Path.home() / "Library/LaunchAgents" / f"{LABEL}.plist"
PORT = 18764

subprocess.run([sys.executable, str(ROOT / "build.py"), "--base-path", "/cooperative-alignment/"], check=True)
site = RUNTIME / "site"
logs = RUNTIME / "logs"
site.mkdir(parents=True, exist_ok=True)
logs.mkdir(parents=True, exist_ok=True)
PLIST.parent.mkdir(parents=True, exist_ok=True)
for asset in (ROOT / "public").iterdir():
    shutil.copyfile(asset, site / asset.name)
shutil.copyfile(ROOT / "server.py", RUNTIME / "server.py")

config = {
    "Label": LABEL,
    "ProgramArguments": [sys.executable, "-u", str(RUNTIME / "server.py")],
    "WorkingDirectory": str(RUNTIME),
    "RunAtLoad": True,
    "KeepAlive": True,
    "ThrottleInterval": 10,
    "ProcessType": "Background",
    "StandardOutPath": str(logs / "server.log"),
    "StandardErrorPath": str(logs / "server-error.log"),
}
PLIST.write_bytes(plistlib.dumps(config))
domain = f"gui/{os.getuid()}"
service = f"{domain}/{LABEL}"
loaded = subprocess.run(["launchctl", "print", service], capture_output=True).returncode == 0
if loaded:
    subprocess.run(["launchctl", "bootout", service], check=True)
subprocess.run(["launchctl", "bootstrap", domain, str(PLIST)], check=True)

for _ in range(50):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/", timeout=1) as response:
            assert response.status == 200
        print(f"Local service ready: http://127.0.0.1:{PORT}/")
        print(f"LaunchAgent: {PLIST}")
        break
    except (OSError, AssertionError):
        time.sleep(.1)
else:
    raise RuntimeError(f"Server did not start. Check {logs}")
