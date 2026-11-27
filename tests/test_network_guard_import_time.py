"""Meta-test: the network guard is already active while test modules import.

The probe below runs at *import* time, during collection. It targets
192.0.2.1 — TEST-NET-1 (RFC 5737), reserved for documentation and never
routed — so even if the guard were missing, nothing could reach a real
service; the connect would just time out.
"""

from __future__ import annotations

import os
import socket
import sys

_guard = sys.modules.get("tests.conftest")
if _guard is None:  # pragma: no cover - depends on pytest import mode
    from tests import conftest as _guard


def _probe_import_time_network() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(0.2)
    try:
        sock.connect(("192.0.2.1", 443))
    except _guard.NetworkCallInTestError:
        return "blocked"
    except OSError as exc:  # guard missing: the unroutable address timed out
        return f"unguarded ({type(exc).__name__})"
    else:  # pragma: no cover - TEST-NET-1 should never accept
        return "connected"
    finally:
        sock.close()


_IMPORT_TIME_RESULT = _probe_import_time_network()
_IMPORT_TIME_PROXY_VARS = sorted(k for k in os.environ if _guard._is_proxy_env_var(k))
_IMPORT_TIME_CONNECT = socket.socket.connect
_IMPORT_TIME_POPEN_INIT = __import__("subprocess").Popen.__init__


def test_socket_guard_active_during_module_import():
    assert _IMPORT_TIME_RESULT == "blocked", (
        f"a connect() at import time was {_IMPORT_TIME_RESULT} — the guard must be "
        "installed before collection (pytest_configure), not in a fixture"
    )


def test_guard_functions_were_installed_before_import():
    assert _IMPORT_TIME_CONNECT is _guard._guarded_connect
    assert _IMPORT_TIME_POPEN_INIT is _guard._guarded_popen_init


def test_proxy_env_already_stripped_at_import_time():
    assert _IMPORT_TIME_PROXY_VARS == []


def test_guard_still_installed_during_tests():
    assert socket.socket.connect is _guard._guarded_connect
    assert socket.create_connection is _guard._guarded_create_connection
