"""Meta-tests: prove the session network guard actually blocks paid calls.

If these fail, every other test in the suite is one bug away from spending money.
"""

from __future__ import annotations

import socket

import pytest

from tools.graphics.atlas_image import AtlasImage
from tools.video.atlas_video import AtlasVideo


class TestGuardBlocksOutbound:

    def test_raw_socket_connect_is_blocked(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        with pytest.raises(Exception) as exc:
            sock.connect(("api.atlascloud.ai", 443))
        assert "Blocked a network connection" in str(exc.value)

    def test_create_connection_is_blocked(self):
        with pytest.raises(Exception) as exc:
            socket.create_connection(("api.atlascloud.ai", 443), timeout=5)
        assert "Blocked a network connection" in str(exc.value)

    def test_requests_cannot_reach_a_provider(self):
        requests = pytest.importorskip("requests")
        with pytest.raises(Exception):
            requests.get("https://api.atlascloud.ai/api/v1/model/prediction/x", timeout=5)

    def test_loopback_still_permitted(self):
        """Local servers and fixtures must keep working."""
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.bind(("127.0.0.1", 0))
        server.listen(1)
        port = server.getsockname()[1]
        try:
            client = socket.create_connection(("127.0.0.1", port), timeout=5)
            client.close()
        finally:
            server.close()


class TestPaidToolsCannotSpend:
    """The guard must hold even with a real key present in the environment."""

    def test_atlas_image_fails_instead_of_billing(self, monkeypatch, tmp_path):
        monkeypatch.setenv("ATLASCLOUD_API_KEY", "sk-looks-real-but-must-not-be-used")
        result = AtlasImage().execute({
            "prompt": "this must never reach the API",
            "output_path": str(tmp_path / "nope.png"),
        })
        assert result.success is False
        assert result.cost_usd == 0.0

    def test_atlas_video_fails_instead_of_billing(self, monkeypatch, tmp_path):
        monkeypatch.setenv("ATLASCLOUD_API_KEY", "sk-looks-real-but-must-not-be-used")
        result = AtlasVideo().execute({
            "prompt": "this must never reach the API",
            "output_path": str(tmp_path / "nope.mp4"),
        })
        assert result.success is False
        assert result.cost_usd == 0.0


class TestLiveApiMarkerIsSkipped:

    @pytest.mark.live_api
    def test_this_should_never_run_by_default(self):
        raise AssertionError(
            "A @live_api test executed without OPENMONTAGE_ALLOW_NETWORK=1 — "
            "the opt-in gate is broken and real spending is possible."
        )


# ---------------------------------------------------------------------------
# Loopback-proxy bypass regressions.
#
# A proxy listening on 127.0.0.1 passes the "loopback is allowed" rule but
# relays traffic to the real internet. These tests stand up a *fake* proxy in
# this process — it only records bytes, it never forwards anything — and prove
# that no client can hand it a request bound for an external host.
# ---------------------------------------------------------------------------

import http.server
import os
import sys
import threading

_guard = sys.modules.get("tests.conftest")
if _guard is None:  # pragma: no cover - depends on pytest import mode
    from tests import conftest as _guard


class _FakeProxy:
    """Loopback listener that records whatever a client sends it.

    Replies `200 Connection established` so that, if the guard were broken,
    a client would happily proceed — the recorded bytes then expose the leak.
    """

    def __init__(self):
        self._server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._server.bind(("127.0.0.1", 0))
        self._server.listen(8)
        self._server.settimeout(0.2)
        self.port = self._server.getsockname()[1]
        self.url = f"http://127.0.0.1:{self.port}"
        self.received: list[bytes] = []
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._serve, daemon=True)
        self._thread.start()

    def _serve(self):
        while not self._stop.is_set():
            try:
                conn, _ = self._server.accept()
            except (socket.timeout, OSError):
                continue
            with conn:
                conn.settimeout(0.5)
                try:
                    data = conn.recv(65536)
                except (socket.timeout, OSError):
                    data = b""
                if data:
                    self.received.append(data)
                    try:
                        conn.sendall(b"HTTP/1.1 200 Connection established\r\n\r\n")
                    except OSError:
                        pass

    def close(self):
        self._stop.set()
        self._thread.join(timeout=2)
        self._server.close()

    def assert_nothing_relayed(self):
        self.close()
        assert self.received == [], (
            f"Loopback proxy received a request for an external host: {self.received!r}"
        )


@pytest.fixture
def fake_proxy():
    proxy = _FakeProxy()
    try:
        yield proxy
    finally:
        proxy.close()


@pytest.fixture
def local_http_server():
    """A real loopback HTTP server, standing in for legitimate local fixtures."""

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802 - stdlib naming
            body = b"local-ok"
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown()
        server.server_close()


def _assert_blocked(exc_info):
    """The guard's error may arrive wrapped by an HTTP client — search the chain."""
    seen, err = [], exc_info.value
    while err is not None and len(seen) < 10:
        seen.append(f"{type(err).__name__}: {err}")
        err = err.__cause__ or err.__context__
    text = "\n".join(seen)
    assert "Blocked a" in text, f"expected the network guard to refuse; got:\n{text}"


class TestProxyEnvironmentIsNeutralised:

    def test_no_proxy_env_vars_survive_into_the_session(self):
        leftover = sorted(k for k in os.environ if _guard._is_proxy_env_var(k))
        assert leftover == [], f"proxy env vars still set during tests: {leftover}"

    @pytest.mark.parametrize("name, expected", [
        ("HTTPS_PROXY", True), ("http_proxy", True), ("ALL_PROXY", True),
        ("npm_config_https_proxy", True), ("GLOBAL_AGENT_HTTPS_PROXY", True),
        ("CLOUDSDK_PROXY_ADDRESS", True),
        ("NO_PROXY", False), ("no_proxy", False), ("npm_config_noproxy", False),
        ("GLOBAL_AGENT_NO_PROXY", False), ("OPENAI_API_KEY", False),
    ])
    def test_proxy_env_var_detection(self, name, expected):
        assert _guard._is_proxy_env_var(name) is expected

    def test_loopback_proxy_endpoints_are_parsed(self):
        endpoints = _guard._loopback_proxy_endpoints({
            "HTTPS_PROXY": "http://127.0.0.1:41151",
            "all_proxy": "socks5h://localhost",
            "HTTP_PROXY": "http://proxy.corp.example:3128",  # not loopback: already blocked
            "CLOUDSDK_PROXY_ADDRESS": "127.0.0.1",
            "CLOUDSDK_PROXY_PORT": "9999",
            "NO_PROXY": "localhost,127.0.0.1",
        })
        assert endpoints == {("127.0.0.1", 41151), ("localhost", 1080), ("127.0.0.1", 9999)}

    def test_connecting_to_the_session_proxy_endpoint_is_refused(self, fake_proxy):
        _guard._blocked_proxy_endpoints.add(("127.0.0.1", fake_proxy.port))
        try:
            for host in ("127.0.0.1", "localhost"):
                with pytest.raises(_guard.NetworkCallInTestError) as exc:
                    socket.create_connection((host, fake_proxy.port), timeout=2)
                _assert_blocked(exc)
        finally:
            _guard._blocked_proxy_endpoints.discard(("127.0.0.1", fake_proxy.port))
        fake_proxy.assert_nothing_relayed()


class TestLoopbackProxyCannotBypassGuard:

    def test_raw_http_connect_through_loopback_proxy_is_blocked(self, fake_proxy):
        sock = socket.create_connection(("127.0.0.1", fake_proxy.port), timeout=2)
        try:
            with pytest.raises(_guard.NetworkCallInTestError) as exc:
                sock.sendall(b"CONNECT api.openai.com:443 HTTP/1.1\r\n"
                             b"Host: api.openai.com:443\r\n\r\n")
            _assert_blocked(exc)
        finally:
            sock.close()
        fake_proxy.assert_nothing_relayed()

    def test_absolute_uri_request_through_loopback_proxy_is_blocked(self, fake_proxy):
        sock = socket.create_connection(("127.0.0.1", fake_proxy.port), timeout=2)
        try:
            with pytest.raises(_guard.NetworkCallInTestError):
                sock.send(b"GET http://api.example.com/v1/x HTTP/1.1\r\n"
                          b"Host: api.example.com\r\n\r\n")
        finally:
            sock.close()
        fake_proxy.assert_nothing_relayed()

    @pytest.mark.parametrize("greeting", [
        b"\x05\x01\x00",                                   # SOCKS5, no-auth
        b"\x05\x02\x00\x02",                               # SOCKS5, two methods
        b"\x04\x01\x01\xbb\x08\x08\x08\x08user\x00",       # SOCKS4 CONNECT 8.8.8.8:443
    ])
    def test_socks_handshake_through_loopback_is_blocked(self, fake_proxy, greeting):
        sock = socket.create_connection(("127.0.0.1", fake_proxy.port), timeout=2)
        try:
            with pytest.raises(_guard.NetworkCallInTestError):
                sock.sendall(greeting)
        finally:
            sock.close()
        fake_proxy.assert_nothing_relayed()

    def test_requests_via_https_proxy_env_is_blocked(self, fake_proxy, monkeypatch):
        requests = pytest.importorskip("requests")
        monkeypatch.setenv("HTTPS_PROXY", fake_proxy.url)
        monkeypatch.setenv("https_proxy", fake_proxy.url)
        monkeypatch.delenv("NO_PROXY", raising=False)
        monkeypatch.delenv("no_proxy", raising=False)
        with pytest.raises(Exception) as exc:
            requests.get("https://api.openai.com/v1/models", timeout=5)
        _assert_blocked(exc)
        fake_proxy.assert_nothing_relayed()

    def test_requests_via_http_proxy_env_is_blocked(self, fake_proxy, monkeypatch):
        requests = pytest.importorskip("requests")
        monkeypatch.setenv("HTTP_PROXY", fake_proxy.url)
        monkeypatch.setenv("http_proxy", fake_proxy.url)
        monkeypatch.delenv("NO_PROXY", raising=False)
        monkeypatch.delenv("no_proxy", raising=False)
        with pytest.raises(Exception) as exc:
            requests.get("http://api.example.com/v1/models", timeout=5)
        _assert_blocked(exc)
        fake_proxy.assert_nothing_relayed()

    def test_requests_with_explicit_proxies_is_blocked(self, fake_proxy):
        requests = pytest.importorskip("requests")
        proxies = {"http": fake_proxy.url, "https": fake_proxy.url}
        with pytest.raises(Exception) as exc:
            requests.get("https://api.atlascloud.ai/api/v1/x", proxies=proxies, timeout=5)
        _assert_blocked(exc)
        fake_proxy.assert_nothing_relayed()

    def test_httpx_with_explicit_proxy_is_blocked(self, fake_proxy):
        httpx = pytest.importorskip("httpx")
        with httpx.Client(proxy=fake_proxy.url, timeout=5) as client:
            with pytest.raises(Exception) as exc:
                client.get("https://api.openai.com/v1/models")
        _assert_blocked(exc)
        fake_proxy.assert_nothing_relayed()

    def test_urllib_via_proxy_env_is_blocked(self, fake_proxy, monkeypatch):
        import urllib.request
        monkeypatch.setenv("http_proxy", fake_proxy.url)
        monkeypatch.delenv("no_proxy", raising=False)
        monkeypatch.delenv("NO_PROXY", raising=False)
        with pytest.raises(Exception) as exc:
            urllib.request.urlopen("http://api.example.com/v1/models", timeout=5)
        _assert_blocked(exc)
        fake_proxy.assert_nothing_relayed()


class TestLocalServersStillWork:

    def test_requests_reaches_local_http_server(self, local_http_server):
        requests = pytest.importorskip("requests")
        resp = requests.get(local_http_server + "/health", timeout=5)
        assert resp.status_code == 200
        assert resp.text == "local-ok"

    def test_httpx_reaches_local_http_server(self, local_http_server):
        httpx = pytest.importorskip("httpx")
        resp = httpx.get(local_http_server + "/health", timeout=5)
        assert resp.status_code == 200
        assert resp.text == "local-ok"

    def test_urllib_reaches_local_http_server(self, local_http_server):
        import urllib.request
        with urllib.request.urlopen(local_http_server + "/health", timeout=5) as resp:
            assert resp.read() == b"local-ok"

    def test_absolute_uri_to_a_loopback_host_is_allowed(self, local_http_server):
        """A loopback proxy forwarding to *another loopback service* is harmless."""
        port = int(local_http_server.rsplit(":", 1)[1])
        sock = socket.create_connection(("127.0.0.1", port), timeout=5)
        try:
            sock.sendall(f"GET {local_http_server}/health HTTP/1.1\r\n"
                         f"Host: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n".encode())
            assert sock.recv(4096).startswith(b"HTTP/1.")
        finally:
            sock.close()

    def test_binary_protocol_on_loopback_is_not_mistaken_for_a_proxy(self, fake_proxy):
        sock = socket.create_connection(("127.0.0.1", fake_proxy.port), timeout=2)
        try:
            sock.sendall(b"\x05hello-binary-frame")
            sock.sendall(b"PING\r\n")
        finally:
            sock.close()


class TestFakeKeyThroughLoopbackProxyCannotSpend:
    """A fake key plus a loopback proxy must still produce zero real calls."""

    def test_atlas_image_with_fake_key_and_proxy_env(self, fake_proxy, monkeypatch, tmp_path):
        monkeypatch.setenv("ATLASCLOUD_API_KEY", "sk-fake-key-for-tests-only")
        for name in ("HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "ALL_PROXY"):
            monkeypatch.setenv(name, fake_proxy.url)
        monkeypatch.delenv("NO_PROXY", raising=False)
        monkeypatch.delenv("no_proxy", raising=False)
        result = AtlasImage().execute({
            "prompt": "this must never reach the API",
            "output_path": str(tmp_path / "nope.png"),
        })
        assert result.success is False
        assert result.cost_usd == 0.0
        assert not (tmp_path / "nope.png").exists()
        fake_proxy.assert_nothing_relayed()

    def test_atlas_video_with_fake_key_and_explicit_proxy(self, fake_proxy, monkeypatch, tmp_path):
        monkeypatch.setenv("ATLASCLOUD_API_KEY", "sk-fake-key-for-tests-only")
        monkeypatch.setenv("HTTPS_PROXY", fake_proxy.url)
        monkeypatch.setenv("https_proxy", fake_proxy.url)
        monkeypatch.delenv("NO_PROXY", raising=False)
        monkeypatch.delenv("no_proxy", raising=False)
        result = AtlasVideo().execute({
            "prompt": "this must never reach the API",
            "output_path": str(tmp_path / "nope.mp4"),
        })
        assert result.success is False
        assert result.cost_usd == 0.0
        fake_proxy.assert_nothing_relayed()


# ---------------------------------------------------------------------------
# Java proxy flags (JAVA_TOOL_OPTIONS / _JAVA_OPTIONS / JDK_JAVA_OPTIONS).
# ---------------------------------------------------------------------------

import asyncio
import json
import shutil
import subprocess

_SANDBOX_STYLE_JAVA_OPTS = (
    "-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts "
    "-Djavax.net.ssl.trustStoreType=JKS "
    "-Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=41151 "
    "-Dhttp.nonProxyHosts=localhost|127.0.0.1|::1|127.*|*.svc.cluster.local "
    "-Djdk.http.auth.tunneling.disabledSchemes= "
    "-Djdk.http.auth.proxying.disabledSchemes="
)


class TestJavaProxyOptions:

    def test_only_proxy_properties_are_removed(self):
        cleaned, removed = _guard._strip_java_proxy_options(_SANDBOX_STYLE_JAVA_OPTS)
        assert removed == ["-Dhttps.proxyHost=127.0.0.1", "-Dhttps.proxyPort=41151"]
        assert cleaned == (
            "-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts "
            "-Djavax.net.ssl.trustStoreType=JKS "
            "-Dhttp.nonProxyHosts=localhost|127.0.0.1|::1|127.*|*.svc.cluster.local "
            "-Djdk.http.auth.tunneling.disabledSchemes= "
            "-Djdk.http.auth.proxying.disabledSchemes="
        )

    @pytest.mark.parametrize("flag", [
        "-Dhttp.proxyHost=127.0.0.1", "-Dhttp.proxyPort=8080",
        "-Dhttps.proxyHost=proxy.corp", "-Dhttps.proxyPort=3128",
        "-Dhttps.proxyUser=u", "-Dhttps.proxyPassword=p",
        "-Dftp.proxyHost=127.0.0.1", "-DsocksProxyHost=127.0.0.1",
        "-DsocksProxyPort=1080", "-DsocksProxyVersion=5",
        "-Djava.net.socks.username=u", "-Djava.net.useSystemProxies=true",
        '"-Dhttps.proxyHost=127.0.0.1"', "'-DsocksProxyHost=localhost'",
    ])
    def test_each_proxy_property_is_removed(self, flag):
        cleaned, removed = _guard._strip_java_proxy_options(f"-Xmx256m {flag} -ea")
        assert removed == [flag]
        assert cleaned == "-Xmx256m -ea"

    @pytest.mark.parametrize("flag", [
        "-Xmx256m", "-XX:+UnlockDiagnosticVMOptions",
        "-XX:DisableIntrinsic=_base64_encodeBlock,_base64_decodeBlock",
        "-Dhttp.nonProxyHosts=localhost", "-DsocksNonProxyHosts=localhost",
        "-Djavax.net.ssl.trustStore=/x", "-Dhttps.protocols=TLSv1.3",
        "-Dmy.app.proxyHostLabel=keep", '-Dfile.encoding="UTF-8"',
        "-javaagent:/opt/agent.jar",
    ])
    def test_unrelated_jvm_options_are_kept(self, flag):
        cleaned, removed = _guard._strip_java_proxy_options(flag)
        assert removed == []
        assert cleaned == flag

    def test_java_proxy_endpoints_are_recorded(self):
        assert _guard._java_proxy_endpoints(_SANDBOX_STYLE_JAVA_OPTS) == {("127.0.0.1", 41151)}
        assert _guard._java_proxy_endpoints(
            "-DsocksProxyHost=localhost -Dhttp.proxyHost=127.0.0.1"
        ) == {("localhost", 1080), ("127.0.0.1", 80)}
        # A remote proxy host is already unreachable via the socket guard.
        assert _guard._java_proxy_endpoints("-Dhttps.proxyHost=proxy.corp") == set()

    def test_session_java_options_have_no_proxy_properties(self):
        for name in _guard._JAVA_OPTION_VARS:
            value = os.environ.get(name, "")
            _, removed = _guard._strip_java_proxy_options(value)
            assert removed == [], f"{name} still carries proxy flags: {removed}"

    def test_sanitized_env_drops_java_var_left_empty(self):
        cleaned = _guard._sanitized_env({
            "JDK_JAVA_OPTIONS": "-Dhttps.proxyHost=127.0.0.1",
            "_JAVA_OPTIONS": "-Xss2m -DsocksProxyHost=127.0.0.1",
            "KEEP": "1",
        })
        assert cleaned == {"_JAVA_OPTIONS": "-Xss2m", "KEEP": "1"}

    @pytest.mark.skipif(shutil.which("java") is None, reason="java not installed")
    def test_real_jvm_sees_no_proxy_even_when_handed_one(self):
        """Ask the actual JVM which system properties it ends up with.

        `-XShowSettings:properties -version` only prints settings and exits —
        no network access.
        """
        env = dict(os.environ)
        env["JAVA_TOOL_OPTIONS"] = "-Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=41151 -Dom.marker=kept"
        env["_JAVA_OPTIONS"] = "-DsocksProxyHost=127.0.0.1 -DsocksProxyPort=1080"
        env["JDK_JAVA_OPTIONS"] = "-Djava.net.useSystemProxies=true"
        out = subprocess.run(
            ["java", "-XshowSettings:properties", "-version"],
            env=env, capture_output=True, text=True, timeout=60,
        )
        settings = out.stdout + out.stderr
        assert "om.marker = kept" in settings
        for prop in ("https.proxyHost", "https.proxyPort", "socksProxyHost",
                     "socksProxyPort", "java.net.useSystemProxies"):
            assert f"{prop} =" not in settings, f"JVM still received {prop}"


# ---------------------------------------------------------------------------
# Child processes receive no proxy configuration.
# ---------------------------------------------------------------------------

_DUMP_ENV = "import json, os; print(json.dumps(dict(os.environ)))"
_PROXY_LADEN_ENV = {
    "HTTPS_PROXY": "http://127.0.0.1:41151",
    "http_proxy": "http://127.0.0.1:41151",
    "ALL_PROXY": "socks5h://127.0.0.1:1080",
    "npm_config_https_proxy": "http://127.0.0.1:41151",
    "GLOBAL_AGENT_HTTPS_PROXY": "http://127.0.0.1:41151",
    "CLOUDSDK_PROXY_ADDRESS": "127.0.0.1",
    "JAVA_TOOL_OPTIONS": "-Xmx64m -Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=41151",
    "NO_PROXY": "localhost,127.0.0.1",
    "OM_GUARD_MARKER": "kept",
}


def _child_env(**kwargs) -> dict:
    out = subprocess.run([sys.executable, "-c", _DUMP_ENV], capture_output=True,
                         text=True, check=True, timeout=30, **kwargs)
    return json.loads(out.stdout)


def _assert_proxy_free(env: dict):
    leaked = sorted(k for k in env if _guard._is_proxy_env_var(k))
    assert leaked == [], f"child process received proxy variables: {leaked}"
    for name in _guard._JAVA_OPTION_VARS:
        _, removed = _guard._strip_java_proxy_options(env.get(name, ""))
        assert removed == [], f"child {name} still carries {removed}"


class TestSubprocessesGetNoProxy:

    def test_explicit_env_is_filtered(self):
        env = {**os.environ, **_PROXY_LADEN_ENV}
        child = _child_env(env=env)
        _assert_proxy_free(child)
        assert child["OM_GUARD_MARKER"] == "kept"
        assert child["NO_PROXY"] == "localhost,127.0.0.1"
        assert child["JAVA_TOOL_OPTIONS"] == "-Xmx64m"

    def test_callers_env_dict_is_not_mutated(self):
        env = {**os.environ, **_PROXY_LADEN_ENV}
        snapshot = dict(env)
        _child_env(env=env)
        assert env == snapshot

    def test_inherited_env_is_filtered_even_after_monkeypatch(self, monkeypatch):
        for name, value in _PROXY_LADEN_ENV.items():
            monkeypatch.setenv(name, value)
        child = _child_env()
        _assert_proxy_free(child)
        assert child["OM_GUARD_MARKER"] == "kept"

    def test_positional_env_argument_is_filtered(self):
        env = {**os.environ, **_PROXY_LADEN_ENV}
        # Popen(args, bufsize, executable, stdin, stdout, stderr, preexec_fn,
        #       close_fds, shell, cwd, env)
        proc = subprocess.Popen([sys.executable, "-c", _DUMP_ENV], -1, None, None,
                                subprocess.PIPE, None, None, True, False, None, env)
        out, _ = proc.communicate(timeout=30)
        _assert_proxy_free(json.loads(out))

    def test_bytes_keyed_env_is_filtered(self):
        env = {k.encode(): v.encode() for k, v in {**os.environ, **_PROXY_LADEN_ENV}.items()}
        _assert_proxy_free(_child_env(env=env))

    def test_asyncio_subprocess_is_filtered(self):
        async def run():
            proc = await asyncio.create_subprocess_exec(
                sys.executable, "-c", _DUMP_ENV,
                env={**os.environ, **_PROXY_LADEN_ENV},
                stdout=asyncio.subprocess.PIPE,
            )
            out, _ = await proc.communicate()
            return json.loads(out)

        child = asyncio.run(run())
        _assert_proxy_free(child)
        assert child["OM_GUARD_MARKER"] == "kept"

    @pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
    def test_node_child_sees_no_proxy(self):
        script = ("const k=Object.keys(process.env).filter(n=>/_proxy$/i.test(n)"
                  "&&!/no_?proxy$/i.test(n));console.log(JSON.stringify(k))")
        out = subprocess.run(["node", "-e", script], env={**os.environ, **_PROXY_LADEN_ENV},
                             capture_output=True, text=True, check=True, timeout=30)
        assert json.loads(out.stdout) == []

    def test_clean_env_is_passed_through_untouched(self):
        assert _guard._sanitized_env({"PATH": "/usr/bin", "NO_PROXY": "localhost"}) is None


# ---------------------------------------------------------------------------
# Build-tool JVM variables: MAVEN_OPTS, GRADLE_OPTS, ANT_OPTS, SBT_OPTS.
# ---------------------------------------------------------------------------

_BUILD_TOOL_VARS = ("MAVEN_OPTS", "GRADLE_OPTS", "ANT_OPTS", "SBT_OPTS")


class TestBuildToolJavaOptions:

    def test_build_tool_vars_are_covered(self):
        for name in _BUILD_TOOL_VARS:
            assert name in _guard._JAVA_OPTION_VARS

    @pytest.mark.parametrize("name", _BUILD_TOOL_VARS)
    def test_proxy_flags_removed_and_other_options_kept(self, name):
        value = ("-Xmx2g -XX:+UseG1GC -Dmaven.repo.local=/tmp/m2 -Dorg.gradle.daemon=false "
                 "-Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=41151 "
                 "-Dhttp.nonProxyHosts=localhost -DsocksProxyHost=127.0.0.1 -Dfile.encoding=UTF-8")
        cleaned = _guard._sanitized_env({name: value, "KEEP": "1"})
        assert cleaned == {
            name: "-Xmx2g -XX:+UseG1GC -Dmaven.repo.local=/tmp/m2 -Dorg.gradle.daemon=false "
                  "-Dhttp.nonProxyHosts=localhost -Dfile.encoding=UTF-8",
            "KEEP": "1",
        }

    def test_sbt_forwarded_jvm_flags_are_handled(self):
        cleaned, removed = _guard._strip_java_proxy_options(
            "-J-Xmx2G -J-Dhttps.proxyHost=127.0.0.1 -J-Dhttps.proxyPort=41151 "
            "-Dsbt.override.build.repos=true -J-Dsbt.log.noformat=true"
        )
        assert removed == ["-J-Dhttps.proxyHost=127.0.0.1", "-J-Dhttps.proxyPort=41151"]
        assert cleaned == "-J-Xmx2G -Dsbt.override.build.repos=true -J-Dsbt.log.noformat=true"

    def test_sbt_forwarded_proxy_endpoint_is_recorded(self):
        assert _guard._java_proxy_endpoints(
            "-J-Dhttps.proxyHost=127.0.0.1 -J-Dhttps.proxyPort=8888"
        ) == {("127.0.0.1", 8888)}

    @pytest.mark.parametrize("name", _BUILD_TOOL_VARS)
    def test_var_with_only_proxy_flags_is_dropped(self, name):
        assert _guard._sanitized_env({name: "-Dhttp.proxyHost=127.0.0.1 -Dhttp.proxyPort=3128"}) == {}

    @pytest.mark.parametrize("name", _BUILD_TOOL_VARS)
    def test_var_without_proxy_flags_is_untouched(self, name):
        assert _guard._sanitized_env({name: "-Xmx1g -Dmaven.test.skip=true"}) is None

    @pytest.mark.parametrize("name", _BUILD_TOOL_VARS)
    def test_session_env_is_stripped_at_startup(self, name, monkeypatch):
        """_strip_proxy_env cleans the var in place and restore puts it back."""
        original = "-Xmx512m -Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=45678"
        monkeypatch.setenv(name, original)
        saved_env = dict(_guard._stripped_proxy_env)
        saved_endpoints = set(_guard._blocked_proxy_endpoints)
        try:
            _guard._strip_proxy_env()
            assert os.environ[name] == "-Xmx512m"
            assert ("127.0.0.1", 45678) in _guard._blocked_proxy_endpoints
            assert _guard._stripped_proxy_env[name] == original
        finally:
            _guard._stripped_proxy_env.clear()
            _guard._stripped_proxy_env.update(saved_env)
            _guard._blocked_proxy_endpoints.clear()
            _guard._blocked_proxy_endpoints.update(saved_endpoints)

    def test_child_process_gets_cleaned_build_tool_vars(self):
        env = {**os.environ,
               "MAVEN_OPTS": "-Xmx1g -Dhttps.proxyHost=127.0.0.1",
               "GRADLE_OPTS": "-Dorg.gradle.daemon=false -DsocksProxyHost=127.0.0.1",
               "ANT_OPTS": "-Dhttp.proxyHost=127.0.0.1 -Dhttp.proxyPort=3128",
               "SBT_OPTS": "-J-Xss4m -J-Dhttps.proxyHost=127.0.0.1"}
        child = _child_env(env=env)
        _assert_proxy_free(child)
        assert child["MAVEN_OPTS"] == "-Xmx1g"
        assert child["GRADLE_OPTS"] == "-Dorg.gradle.daemon=false"
        assert "ANT_OPTS" not in child
        assert child["SBT_OPTS"] == "-J-Xss4m"


# ---------------------------------------------------------------------------
# OPENMONTAGE_ALLOW_NETWORK must be a deliberate, manual opt-in.
# ---------------------------------------------------------------------------

from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]


class TestNetworkEscapeHatchIsDeliberate:

    def test_flag_is_not_set_in_this_session(self):
        assert _guard._ALLOW_ENV_FLAG == "OPENMONTAGE_ALLOW_NETWORK"
        assert not _guard._network_allowed()
        assert socket.socket.connect is _guard._guarded_connect

    @pytest.mark.parametrize("value", ["1", "true", "TRUE", "yes", " Yes "])
    def test_only_explicit_truthy_values_open_the_hatch(self, value, monkeypatch):
        monkeypatch.setenv("OPENMONTAGE_ALLOW_NETWORK", value)
        assert _guard._network_allowed() is True

    @pytest.mark.parametrize("value", ["", "0", "false", "no", "off", "2", "y", "enable"])
    def test_other_values_keep_the_guard(self, value, monkeypatch):
        monkeypatch.setenv("OPENMONTAGE_ALLOW_NETWORK", value)
        assert _guard._network_allowed() is False

    def test_unset_keeps_the_guard(self, monkeypatch):
        monkeypatch.delenv("OPENMONTAGE_ALLOW_NETWORK", raising=False)
        assert _guard._network_allowed() is False

    def test_no_project_config_turns_the_flag_on(self):
        """Makefile, CI, pytest config and env templates must never set the flag."""
        candidates = [
            _REPO_ROOT / "Makefile",
            _REPO_ROOT / "pytest.ini",
            _REPO_ROOT / "setup.py",
            _REPO_ROOT / "setup.cfg",
            _REPO_ROOT / "pyproject.toml",
            _REPO_ROOT / "tox.ini",
            _REPO_ROOT / ".env.example",
            _REPO_ROOT / ".env",
            *sorted((_REPO_ROOT / ".github").rglob("*.yml")),
            *sorted((_REPO_ROOT / ".github").rglob("*.yaml")),
        ]
        offenders = [
            str(path.relative_to(_REPO_ROOT))
            for path in candidates
            if path.is_file() and "OPENMONTAGE_ALLOW_NETWORK" in path.read_text(errors="replace")
        ]
        assert offenders == [], f"network escape hatch referenced in config: {offenders}"
