"""Prepare a local Admin credential bundle; Vercel values are updated separately."""

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import secrets

import bcrypt


def build_bundle(username):
    username = username.strip()
    if not username or len(username.encode("utf-8")) > 256:
        raise ValueError("Admin username must contain 1-256 UTF-8 bytes")
    password = secrets.token_urlsafe(30)
    password_bytes = password.encode("utf-8")
    assert 14 <= len(password) and len(password_bytes) <= 72
    return {
        "status": "pending_vercel_rotation",
        "environment": "Production",
        "username": username,
        "password": password,
        "password_hash": bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=12)).decode("ascii"),
        "session_secret": secrets.token_urlsafe(48),
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
    }


def write_bundle(destination, bundle):
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        json.dump(bundle, stream, indent=2, ensure_ascii=False)
        stream.write("\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--username", default="fireartro")
    local_app_data = os.environ.get("LOCALAPPDATA")
    if not local_app_data:
        parser.error("LOCALAPPDATA is required; no credential file was created")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(local_app_data) / "FireArtRo" / "admin-credentials.json",
    )
    arguments = parser.parse_args()
    write_bundle(arguments.output, build_bundle(arguments.username))
    print(f"Credential bundle prepared at: {arguments.output}")
    print("Status: pending Vercel Production rotation. Do not commit or share this file.")


if __name__ == "__main__":
    main()
