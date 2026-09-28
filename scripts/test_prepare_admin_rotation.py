import json

import bcrypt
import pytest

from scripts.prepare_admin_rotation import build_bundle, write_bundle


def test_bundle_contains_a_strong_password_and_valid_bcrypt_hash():
    bundle = build_bundle("fireartro")
    password = bundle["password"].encode("utf-8")
    assert bundle["username"] == "fireartro"
    assert 14 <= len(bundle["password"])
    assert len(password) <= 72
    assert bcrypt.checkpw(password, bundle["password_hash"].encode("ascii"))
    assert len(bundle["session_secret"].encode("utf-8")) >= 32
    assert bundle["status"] == "pending_vercel_rotation"


def test_bundle_is_written_once_without_printing_secrets(tmp_path, capsys):
    bundle = build_bundle("fireartro")
    destination = tmp_path / "private" / "admin-credentials.json"
    write_bundle(destination, bundle)
    assert json.loads(destination.read_text(encoding="utf-8")) == bundle
    assert bundle["password"] not in capsys.readouterr().out
    with pytest.raises(FileExistsError):
        write_bundle(destination, bundle)
