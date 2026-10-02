"""Focused regression runner with credentials removed and sockets blocked."""

import errno
import os
import socket
import threading
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
sys.dont_write_bytecode = True
for name in tuple(os.environ):
    if any(part in name.upper() for part in (
        "MONGO", "RESEND", "TURNSTILE", "ADMIN_", "SECRET", "TOKEN", "PASSWORD",
        "API_KEY", "BLOB", "VERCEL", "FIREART_AUTH_TEST", "DB_NAME",
    )):
        os.environ.pop(name, None)
os.environ["PYTEST_DISABLE_PLUGIN_AUTOLOAD"] = "1"
os.environ["PYTHONDONTWRITEBYTECODE"] = "1"
import dotenv
dotenv.load_dotenv = lambda *args, **kwargs: False
original_connect = socket.socket.connect
original_socketpair = socket.socketpair
internal_pair = threading.local()

def isolated_socketpair(*args, **kwargs):
    internal_pair.active = True
    try:
        return original_socketpair(*args, **kwargs)
    finally:
        internal_pair.active = False

def denied_connect(sock, address, *args, **kwargs):
    if getattr(internal_pair, "active", False) and address[0] in {"127.0.0.1", "::1"}:
        return original_connect(sock, address, *args, **kwargs)
    raise OSError(errno.ENETUNREACH, "Network disabled by offline regression runner")

socket.socketpair = isolated_socketpair
socket.socket.connect = denied_connect
socket.socket.connect_ex = lambda *args, **kwargs: errno.ENETUNREACH
socket.socket.sendto = denied_connect
sys.path.insert(0, str(root))
sys.path.insert(0, str(root / "backend"))
import pytest

raise SystemExit(pytest.main([
    *([
        "backend/tests/test_quote_recovery.py",
        "backend/tests/test_quotes.py",
        "backend/tests/test_quote_admin.py",
        "backend/tests/test_multipart_security.py",
    ] if not any(not argument.startswith("-") for argument in sys.argv[1:]) else []),
    *sys.argv[1:],
    "-q", "--tb=short", "-p", "no:cacheprovider", "-p", "pytest_asyncio.plugin",
    "-o", "asyncio_default_fixture_loop_scope=function",
]))
