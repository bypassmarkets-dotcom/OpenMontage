"""Session-wide test safety net.

**No test may open a network connection.** Provider tools bill per call, so a
test that reaches a real endpoint costs the developer money — silently, and
every time CI runs. This blocks outbound sockets for the whole test session.

The guard is at the socket layer on purpose. Patching `requests` only covers
tools that use `requests`; the fleet also talks to vendor SDKs (google-cloud,
openai, boto3), `httpx`, and raw `urllib`. Everything bottoms out in
`socket.connect`, so that is where the wall goes.

Loopback is still allowed — local servers, ffmpeg RPC, and Backlot fixtures need it.

Loopback proxies are NOT a way around the wall. A proxy listening on
127.0.0.1 (a corporate agent, a sandbox egress proxy, `mitmproxy`, a SOCKS
tunnel) would otherwise relay a "loopback" connection straight out to a paid
API. Three layers close that hole:

1. Proxy environment variables (`HTTPS_PROXY`, `ALL_PROXY`, `npm_config_proxy`,
   ...) are removed from `os.environ` for the whole session, so HTTP clients
   and child processes stop routing through them. They are restored when the
   session ends.
2. Connections to the loopback endpoints those variables pointed at are refused.
3. The first bytes sent on every loopback TCP connection are inspected; a proxy
   handshake (`CONNECT host:port`, an absolute-URI request such as
   `GET http://api.example.com/`, or a SOCKS4/5 greeting) aimed at a
   non-loopback destination is refused. This catches proxies passed explicitly
   (`proxies=`, `proxy=`) or set via `monkeypatch.setenv` inside a test.

Ordinary local servers — including absolute-URI requests to a loopback host —
are unaffected.

Java reads its proxy from JVM flags, not from `HTTPS_PROXY`. The proxy
properties (`-Dhttps.proxyHost`, `-DsocksProxyHost`,
`-Djava.net.useSystemProxies`, ...) are removed from `JAVA_TOOL_OPTIONS`,
`_JAVA_OPTIONS`, `JDK_JAVA_OPTIONS` and the build-tool variables `MAVEN_OPTS`,
`GRADLE_OPTS`, `ANT_OPTS` and `SBT_OPTS` (including sbt's `-J-D...` form);
every other JVM flag is kept. Proxies set in build-tool config files
(`settings.xml`, `gradle.properties`, sbt `repositories`) are not touched.

The guard is installed in `pytest_configure`, before any test module is
imported, so network calls made at import/collection time are refused too.

To write a test that genuinely hits a live API:

    @pytest.mark.live_api
    def test_real_call():
        ...

Marked tests are **skipped by default** and only run with the env flag set:

    OPENMONTAGE_ALLOW_NETWORK=1 pytest -m live_api

Limitations — read before trusting this with a paid key:

* Child processes (node, npx, ffmpeg, java, python) are NOT socket-guarded.
  What they get is a proxy-free environment: `subprocess.Popen` (and so
  `run`, `check_output`, asyncio subprocesses) strips proxy variables and Java
  proxy flags from the env it passes on, explicit `env=` included. A child
  can still reach the internet by itself — directly where the host network
  allows it, or through a proxy named on its command line (`--proxy`,
  `-x`, `-Dhttps.proxyHost=` as an argument) or in its own config file.
  `os.system`, `os.exec*` and `os.posix_spawn` called directly with a custom
  env are not filtered either. Don't call paid APIs from a subprocess in tests.
* A TLS proxy (`https://127.0.0.1:...`) is only caught when its endpoint was
  in the environment at session start; its handshake can't be inspected.
* Native code that opens sockets without going through Python's `socket`
  module (some C extensions, gRPC core, libcurl) bypasses the guard.
"""

from __future__ import annotations

import os
import re
import socket
import subprocess
import weakref
from urllib.parse import urlsplit

import pytest

_ALLOW_ENV_FLAG = "OPENMONTAGE_ALLOW_NETWORK"

_LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1", "0.0.0.0", ""}

_real_connect = socket.socket.connect
_real_connect_ex = socket.socket.connect_ex
_real_create_connection = socket.create_connection
_real_send = socket.socket.send
_real_sendall = socket.socket.sendall
_real_sendmsg = getattr(socket.socket, "sendmsg", None)
_real_popen_init = subprocess.Popen.__init__
_guard_installed = False

# Proxy env vars that were removed for the session: name -> original value.
_stripped_proxy_env: dict[str, str] = {}
# Loopback (host, port) pairs that the removed proxy variables pointed at.
_blocked_proxy_endpoints: set[tuple[str, int]] = set()
# Loopback TCP sockets whose first payload has not been inspected yet.
_unchecked_loopback_sockets: "weakref.WeakSet[socket.socket]" = weakref.WeakSet()

# Variables that configure proxies but don't follow the `*_proxy` naming rule.
_EXTRA_PROXY_ENV_VARS = {
    "cloudsdk_proxy_address",
    "cloudsdk_proxy_port",
    "cloudsdk_proxy_type",
    "cloudsdk_proxy_username",
    "cloudsdk_proxy_password",
}
# JVM options variables, and the system properties in them that route traffic
# through a proxy. Other properties (trustStore, nonProxyHosts, ...) are kept.
# Build tools (Maven, Gradle, Ant, sbt) start a JVM with their own *_OPTS.
_JAVA_OPTION_VARS = ("JAVA_TOOL_OPTIONS", "_JAVA_OPTIONS", "JDK_JAVA_OPTIONS",
                     "MAVEN_OPTS", "GRADLE_OPTS", "ANT_OPTS", "SBT_OPTS")
_JAVA_PROXY_PROPERTIES = frozenset({
    "http.proxyHost", "http.proxyPort", "http.proxyUser", "http.proxyPassword",
    "https.proxyHost", "https.proxyPort", "https.proxyUser", "https.proxyPassword",
    "ftp.proxyHost", "ftp.proxyPort",
    "socksProxyHost", "socksProxyPort", "socksProxyVersion",
    "java.net.socks.username", "java.net.socks.password",
    "java.net.useSystemProxies",
})
# One JVM option: unquoted run of non-space chars, with optional quoted parts.
_JAVA_TOKEN_RE = re.compile(r"""(?:[^\s"']+|"[^"]*"|'[^']*')+""")
# `-Dname=value`; sbt also forwards JVM flags as `-J-Dname=value`.
_JAVA_PROPERTY_RE = re.compile(r"""^(?:-J)?-D([^=\s]+)(?:=(.*))?$""", re.DOTALL)
_DEFAULT_PROXY_PORTS = {"http": 80, "https": 443, "socks": 1080, "socks4": 1080,
                        "socks4a": 1080, "socks5": 1080, "socks5h": 1080}


class NetworkCallInTestError(RuntimeError):
    """Raised when a test tries to open a non-loopback connection."""


def _network_allowed() -> bool:
    return os.environ.get(_ALLOW_ENV_FLAG, "").strip().lower() in {"1", "true", "yes"}


def _is_loopback(address) -> bool:
    """True for loopback TCP/UDP targets and for AF_UNIX socket paths."""
    if isinstance(address, (str, bytes)):
        return True  # AF_UNIX / abstract socket — local by definition
    if not isinstance(address, (tuple, list)) or not address:
        return True  # unrecognised shape; let the real call decide
    host = address[0]
    if isinstance(host, bytes):
        host = host.decode("utf-8", "replace")
    if not isinstance(host, str):
        return False
    host = host.strip("[]").lower()
    if host in _LOOPBACK_HOSTS:
        return True
    return host.startswith("127.")


def _is_proxy_env_var(name: str) -> bool:
    """True for proxy settings (HTTPS_PROXY, npm_config_proxy, ...), not NO_PROXY."""
    lowered = name.lower()
    if lowered in _EXTRA_PROXY_ENV_VARS:
        return True
    if lowered.endswith("no_proxy") or lowered.endswith("noproxy"):
        return False
    return lowered.endswith("_proxy")


def _proxy_endpoint(value: str) -> tuple[str, int] | None:
    """Parse a proxy URL (or bare host:port) into a (host, port) pair."""
    value = (value or "").strip()
    if not value:
        return None
    if "://" not in value:
        value = "http://" + value
    try:
        parts = urlsplit(value)
        host, port = parts.hostname, parts.port
    except ValueError:
        return None
    if not host:
        return None
    if port is None:
        port = _DEFAULT_PROXY_PORTS.get(parts.scheme.lower(), 80)
    return host.lower(), port


def _loopback_proxy_endpoints(env: dict[str, str]) -> set[tuple[str, int]]:
    """Loopback endpoints referenced by proxy env vars (incl. CLOUDSDK_PROXY_*)."""
    endpoints: set[tuple[str, int]] = set()
    lowered = {k.lower(): v for k, v in env.items()}
    for name, value in env.items():
        if not _is_proxy_env_var(name) or name.lower().startswith("cloudsdk_proxy_"):
            continue
        endpoint = _proxy_endpoint(value)
        if endpoint and _is_loopback(endpoint):
            endpoints.add(endpoint)
    address = lowered.get("cloudsdk_proxy_address", "").strip()
    port = lowered.get("cloudsdk_proxy_port", "").strip()
    if address and port.isdigit():
        endpoint = (address.strip("[]").lower(), int(port))
        if _is_loopback(endpoint):
            endpoints.add(endpoint)
    return endpoints


def _java_property(token: str) -> tuple[str, str] | None:
    """`-Dname=value` / `-J-Dname=value` (optionally quoted) -> (name, value)."""
    match = _JAVA_PROPERTY_RE.match(token.replace('"', "").replace("'", ""))
    if not match:
        return None
    return match.group(1), match.group(2) or ""


def _strip_java_proxy_options(value: str) -> tuple[str, list[str]]:
    """Remove JVM proxy properties from a *_JAVA_OPTIONS value.

    Returns (cleaned value, removed tokens). Every other option is kept in
    its original order and spelling.
    """
    kept, removed = [], []
    for token in _JAVA_TOKEN_RE.findall(value or ""):
        prop = _java_property(token)
        if prop is not None and prop[0] in _JAVA_PROXY_PROPERTIES:
            removed.append(token)
        else:
            kept.append(token)
    return " ".join(kept), removed


def _java_proxy_endpoints(value: str) -> set[tuple[str, int]]:
    """Loopback proxy endpoints named by -D{http,https,ftp}.proxyHost / socksProxyHost."""
    props = dict(p for p in map(_java_property, _JAVA_TOKEN_RE.findall(value or "")) if p)
    endpoints: set[tuple[str, int]] = set()
    for prefix, default_port in (("http.proxy", 80), ("https.proxy", 443),
                                 ("ftp.proxy", 80), ("socksProxy", 1080)):
        host = props.get(prefix + "Host", "").strip().strip("[]").lower()
        port = props.get(prefix + "Port", "").strip()
        if not host:
            continue
        endpoint = (host, int(port) if port.isdigit() else default_port)
        if _is_loopback(endpoint):
            endpoints.add(endpoint)
    return endpoints


def _env_key(name) -> str:
    return name.decode("utf-8", "replace") if isinstance(name, bytes) else str(name)


def _sanitized_env(env) -> dict | None:
    """Copy of `env` without proxy variables or JVM proxy flags.

    Returns None when `env` has nothing to remove, so callers can leave it
    untouched. Works for str- and bytes-keyed mappings.
    """
    changed = False
    cleaned = {}
    for name, value in env.items():
        key = _env_key(name)
        if _is_proxy_env_var(key):
            changed = True
            continue
        if key in _JAVA_OPTION_VARS and value:
            as_text = value.decode("utf-8", "replace") if isinstance(value, bytes) else value
            stripped, removed = _strip_java_proxy_options(as_text)
            if removed:
                changed = True
                if not stripped:
                    continue
                value = stripped.encode() if isinstance(value, bytes) else stripped
        cleaned[name] = value
    return cleaned if changed else None


def _is_blocked_proxy_endpoint(address) -> bool:
    if not isinstance(address, (tuple, list)) or len(address) < 2:
        return False
    host = address[0]
    if isinstance(host, bytes):
        host = host.decode("utf-8", "replace")
    if not isinstance(host, str):
        return False
    host = host.strip("[]").lower()
    try:
        port = int(address[1])
    except (TypeError, ValueError):
        return False
    # Every 127.x / ::1 / localhost spelling may reach the same listener, so
    # match on port for any loopback host (all recorded endpoints are loopback).
    return _is_loopback((host,)) and any(port == p for _, p in _blocked_proxy_endpoints)


def _proxy_request_target(data: bytes) -> str | None:
    """If `data` opens a proxy handshake to a non-loopback host, describe it.

    Recognises HTTP `CONNECT host:port`, absolute-URI HTTP requests
    (`GET http://host/...`, the form plain-HTTP proxies receive) and SOCKS4/5
    greetings. Returns None for anything else, including proxy-style requests
    whose target is itself loopback.
    """
    if not data:
        return None
    first = data[0]
    # SOCKS5 greeting: VER=5, NMETHODS, METHODS[NMETHODS].
    if first == 0x05 and len(data) >= 3 and len(data) == 2 + data[1] and data[1] >= 1:
        return "SOCKS5 handshake"
    # SOCKS4/4a request: VER=4, CMD=1|2, DSTPORT(2), DSTIP(4), USERID, NUL.
    if first == 0x04 and len(data) >= 9 and data[1] in (1, 2) and data.endswith(b"\x00"):
        return "SOCKS4 handshake"

    line = data.split(b"\r\n", 1)[0].split(b"\n", 1)[0][:2048]
    pieces = line.split()
    if len(pieces) < 2:
        return None
    try:
        method = pieces[0].decode("ascii").upper()
        target = pieces[1].decode("ascii", "replace")
    except UnicodeDecodeError:
        return None
    if not method.isalpha():
        return None
    if method == "CONNECT":
        endpoint = _proxy_endpoint(target)
    elif "://" in target:
        endpoint = _proxy_endpoint(target)
    else:
        return None
    if endpoint is None or _is_loopback(endpoint):
        return None
    return f"{method} {target}"


def _inspect_first_payload(sock, data) -> None:
    """Refuse a proxy handshake on a loopback socket (first payload only)."""
    if sock not in _unchecked_loopback_sockets:
        return
    try:
        payload = bytes(data)
    except TypeError:
        return
    if not payload:
        return
    _unchecked_loopback_sockets.discard(sock)
    target = _proxy_request_target(payload)
    if target is not None:
        try:
            peer = sock.getpeername()
        except OSError:
            peer = "a loopback address"
        raise _blocked_via_proxy(peer, target)


def _blocked_via_proxy(proxy, target) -> NetworkCallInTestError:
    return NetworkCallInTestError(
        f"Blocked a proxied network connection ({target}) through the loopback\n"
        f"proxy at {proxy!r} during a test.\n"
        f"\n"
        f"A proxy on 127.0.0.1 relays to the real internet, so it does not count\n"
        f"as loopback. Mock the transport instead, or mark the test\n"
        f"@pytest.mark.live_api and run it deliberately with {_ALLOW_ENV_FLAG}=1."
    )


def _blocked(address) -> NetworkCallInTestError:
    return NetworkCallInTestError(
        f"Blocked a network connection to {address!r} during a test.\n"
        f"\n"
        f"Tests must not call real endpoints — provider APIs bill per request.\n"
        f"Mock the transport instead (see tests/tools/test_atlas_video.py for the\n"
        f"fake-`requests` pattern), or mark the test @pytest.mark.live_api and run\n"
        f"it deliberately with {_ALLOW_ENV_FLAG}=1."
    )


def _check_target(sock, address) -> None:
    if not _is_loopback(address):
        raise _blocked(address)
    if _is_blocked_proxy_endpoint(address):
        raise _blocked_via_proxy(tuple(address[:2]), "connection to the session proxy")
    if sock is not None and sock.family in (socket.AF_INET, socket.AF_INET6) \
            and sock.type & socket.SOCK_STREAM:
        _unchecked_loopback_sockets.add(sock)


def _guarded_connect(self, address, *args, **kwargs):
    _check_target(self, address)
    return _real_connect(self, address, *args, **kwargs)


def _guarded_connect_ex(self, address, *args, **kwargs):
    _check_target(self, address)
    return _real_connect_ex(self, address, *args, **kwargs)


def _guarded_create_connection(address, *args, **kwargs):
    _check_target(None, address)
    return _real_create_connection(address, *args, **kwargs)


def _guarded_send(self, data, *args, **kwargs):
    _inspect_first_payload(self, data)
    return _real_send(self, data, *args, **kwargs)


def _guarded_sendall(self, data, *args, **kwargs):
    _inspect_first_payload(self, data)
    return _real_sendall(self, data, *args, **kwargs)


def _guarded_sendmsg(self, buffers, *args, **kwargs):
    buffers = list(buffers)
    _inspect_first_payload(self, b"".join(bytes(b) for b in buffers))
    return _real_sendmsg(self, buffers, *args, **kwargs)


# Index of `env` among Popen's positional parameters (args is index 0).
_POPEN_ENV_POSITION = 10


def _guarded_popen_init(self, *args, **kwargs):
    """Hand child processes an environment with no proxy settings in it."""
    if len(args) > _POPEN_ENV_POSITION:
        env = args[_POPEN_ENV_POSITION]
        cleaned = _sanitized_env(os.environ if env is None else env)
        if cleaned is not None:
            args = (*args[:_POPEN_ENV_POSITION], cleaned, *args[_POPEN_ENV_POSITION + 1:])
    else:
        env = kwargs.get("env")
        cleaned = _sanitized_env(os.environ if env is None else env)
        if cleaned is not None:
            kwargs["env"] = cleaned
    return _real_popen_init(self, *args, **kwargs)


def _install_guard() -> None:
    """Refuse non-loopback sockets and proxy hand-offs for the session."""
    global _guard_installed
    if _guard_installed:
        return
    socket.socket.connect = _guarded_connect
    socket.socket.connect_ex = _guarded_connect_ex
    socket.create_connection = _guarded_create_connection
    socket.socket.send = _guarded_send
    socket.socket.sendall = _guarded_sendall
    if _real_sendmsg is not None:
        socket.socket.sendmsg = _guarded_sendmsg
    subprocess.Popen.__init__ = _guarded_popen_init
    _guard_installed = True


def _uninstall_guard() -> None:
    global _guard_installed
    if not _guard_installed:
        return
    socket.socket.connect = _real_connect
    socket.socket.connect_ex = _real_connect_ex
    socket.create_connection = _real_create_connection
    socket.socket.send = _real_send
    socket.socket.sendall = _real_sendall
    if _real_sendmsg is not None:
        socket.socket.sendmsg = _real_sendmsg
    subprocess.Popen.__init__ = _real_popen_init
    _guard_installed = False


@pytest.fixture(scope="session", autouse=True)
def _block_network():
    """Keep the guard in place for the whole session.

    It is installed in `pytest_configure` (before test modules are imported);
    this fixture re-asserts it in case a plugin or test restored the originals.
    """
    if not _network_allowed():
        _install_guard()
    yield


def _strip_proxy_env() -> None:
    """Remove proxy settings from os.environ and remember loopback proxies."""
    proxy_env = {k: v for k, v in os.environ.items() if _is_proxy_env_var(k)}
    _blocked_proxy_endpoints.update(_loopback_proxy_endpoints(proxy_env))
    for name, value in proxy_env.items():
        _stripped_proxy_env[name] = value
        del os.environ[name]
    for name in _JAVA_OPTION_VARS:
        value = os.environ.get(name)
        if not value:
            continue
        cleaned, removed = _strip_java_proxy_options(value)
        if not removed:
            continue
        _blocked_proxy_endpoints.update(_java_proxy_endpoints(value))
        _stripped_proxy_env[name] = value
        if cleaned:
            os.environ[name] = cleaned
        else:
            del os.environ[name]


def _restore_proxy_env() -> None:
    for name, value in _stripped_proxy_env.items():
        os.environ[name] = value
    _stripped_proxy_env.clear()
    _blocked_proxy_endpoints.clear()


def pytest_configure(config):
    # Runs before collection: test modules are imported with the proxy env
    # already gone and the socket guard already in place.
    if not _network_allowed():
        _strip_proxy_env()
        _install_guard()
    config.addinivalue_line(
        "markers",
        "live_api: test performs a real, billable API call. Skipped unless "
        f"{_ALLOW_ENV_FLAG}=1 is set.",
    )


def pytest_unconfigure(config):
    _uninstall_guard()
    _restore_proxy_env()


def pytest_collection_modifyitems(config, items):
    """Skip live_api tests unless the operator explicitly opted in."""
    if _network_allowed():
        return
    skip = pytest.mark.skip(
        reason=f"live API test — costs money; set {_ALLOW_ENV_FLAG}=1 to run"
    )
    for item in items:
        if "live_api" in item.keywords:
            item.add_marker(skip)
