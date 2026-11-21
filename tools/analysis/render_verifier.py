"""Post-render verification gate for a final video deliverable.

Turns the compose stage's mandatory "probe the rendered file" checklist into a
deterministic, local tool. It inspects the real output file — it does not trust
the renderer's exit code — and returns two schema-valid artifacts:

- ``render_report``: the canonical compose-stage artifact (technical facts).
- ``final_review``: the automated part of the post-render self-review. Checks
  that need human/agent judgement (overlay layout, text readability, narration
  completeness against the script) are listed in
  ``final_review.metadata.pending_agent_checks`` — the agent must complete them
  before presenting the video.

Checks, each producing structured issues (``code``, ``severity``, ``check``,
``message``):

- container: file exists, non-trivial size, ffprobe parses it, video stream present
- integrity: full decode of every stream with ``ffmpeg -f null`` (no sampling)
- spec: duration (with tolerance), resolution, fps, video codec vs expectations
- visual: black segments (``blackdetect``) and frozen segments (``freezedetect``)
- audio: stream present when required, silence, clipping, long silence gaps
- spotcheck: evenly spaced review frames plus a contact sheet

Severity drives the verdict: any ``critical`` -> ``fail``; any ``major`` ->
``revise``; otherwise ``pass``. ``ToolResult.success`` is False only on
``fail``, so a caller that ignores ``data`` still cannot ship a broken file.

Every subprocess call has a timeout. Re-running on the same inputs rewrites the
same frame and report paths, so the tool is safe to retry.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, Optional

import jsonschema

from tools.base_tool import (
    BaseTool,
    Determinism,
    ExecutionMode,
    ResourceProfile,
    RetryPolicy,
    ToolResult,
    ToolRuntime,
    ToolStability,
    ToolTier,
)

SEVERITY_ORDER = ("critical", "major", "minor")

DEFAULTS: dict[str, Any] = {
    "duration_tolerance": 0.05,  # ±5%, matches the compose-director checklist
    "min_file_size_bytes": 1024,
    "black_min_seconds": 0.5,  # blackdetect reporting floor
    "black_max_seconds": 1.0,  # a single black run longer than this is major
    "black_pixel_threshold": 0.98,
    "freeze_min_seconds": 2.0,
    "freeze_noise": 0.001,
    "freeze_max_ratio": 0.5,  # mostly-frozen output reads as a slideshow
    "silence_threshold_db": -50.0,
    "silence_gap_seconds": 1.0,  # compose checklist: no silence gaps > 1s
    "silent_mean_db": -60.0,  # whole-track mean at or below this = silent
    "clip_max_db": -0.1,  # peak at or above this = clipping risk
    "sample_frames": 6,
}

_FPS_RE = re.compile(r"^(\d+)(?:/(\d+))?$")
_BLACK_RE = re.compile(
    r"black_start:\s*([\d.]+)\s+black_end:\s*([\d.]+)\s+black_duration:\s*([\d.]+)"
)
_FREEZE_START_RE = re.compile(r"freezedetect\.freeze_start:\s*([\d.]+)")
_FREEZE_END_RE = re.compile(r"freezedetect\.freeze_end:\s*([\d.]+)")
_SILENCE_START_RE = re.compile(r"silence_start:\s*(-?[\d.]+)")
_SILENCE_END_RE = re.compile(r"silence_end:\s*([\d.]+)")
_MEAN_VOL_RE = re.compile(r"mean_volume:\s*(-?[\d.]+|-inf)\s*dB")
_MAX_VOL_RE = re.compile(r"max_volume:\s*(-?[\d.]+|-inf)\s*dB")

_SCHEMAS_DIR = Path(__file__).resolve().parent.parent.parent / "schemas" / "artifacts"


# ---------------------------------------------------------------------------
# Pure helpers (unit-tested directly)
# ---------------------------------------------------------------------------


def parse_fps(rate: Optional[str]) -> Optional[float]:
    """Parse an ffprobe rate like ``30/1`` or ``30000/1001``; None if unusable."""
    if not rate:
        return None
    match = _FPS_RE.match(rate.strip())
    if not match:
        return None
    num = int(match.group(1))
    den = int(match.group(2) or 1)
    if num == 0 or den == 0:
        return None
    return round(num / den, 3)


def _db(value: str) -> float:
    return float("-inf") if value == "-inf" else float(value)


def parse_black_segments(log: str) -> list[dict[str, float]]:
    return [
        {"start": float(a), "end": float(b), "duration": float(c)}
        for a, b, c in _BLACK_RE.findall(log)
    ]


def parse_freeze_segments(log: str, media_duration: float) -> list[dict[str, float]]:
    """Pair freeze_start/freeze_end lines; an unterminated freeze runs to EOF."""
    starts = [float(x) for x in _FREEZE_START_RE.findall(log)]
    ends = [float(x) for x in _FREEZE_END_RE.findall(log)]
    segments = []
    for i, start in enumerate(starts):
        end = ends[i] if i < len(ends) else media_duration
        segments.append({"start": start, "end": end, "duration": round(end - start, 3)})
    return segments


def parse_silence_segments(log: str, media_duration: float) -> list[dict[str, float]]:
    starts = [max(0.0, float(x)) for x in _SILENCE_START_RE.findall(log)]
    ends = [float(x) for x in _SILENCE_END_RE.findall(log)]
    segments = []
    for i, start in enumerate(starts):
        end = ends[i] if i < len(ends) else media_duration
        segments.append({"start": start, "end": end, "duration": round(end - start, 3)})
    return segments


def parse_volume(log: str) -> dict[str, Optional[float]]:
    mean = _MEAN_VOL_RE.search(log)
    peak = _MAX_VOL_RE.search(log)
    return {
        "mean_volume_db": _db(mean.group(1)) if mean else None,
        "max_volume_db": _db(peak.group(1)) if peak else None,
    }


def sample_timestamps(duration: float, count: int) -> list[float]:
    """Evenly spaced bucket midpoints — never 0 or EOF, so seeks always land."""
    if duration <= 0 or count <= 0:
        return []
    return [round(duration * (i + 0.5) / count, 3) for i in range(count)]


def classify(issues: list[dict[str, Any]]) -> tuple[str, str]:
    """Map issues to (final_review.status, final_review.recommended_action)."""
    severities = {issue["severity"] for issue in issues}
    if "critical" in severities:
        unusable = any(
            issue["code"] in {"file_missing", "file_too_small", "invalid_container", "no_video_stream"}
            for issue in issues
        )
        return "fail", ("block" if unusable else "re_render")
    if "major" in severities:
        edit_codes = {"duration_out_of_tolerance", "black_segment", "mostly_frozen"}
        if any(issue["code"] in edit_codes for issue in issues if issue["severity"] == "major"):
            return "revise", "revise_edit"
        return "revise", "re_render"
    return "pass", "present_to_user"


def _issue(code: str, severity: str, check: str, message: str) -> dict[str, str]:
    if severity not in SEVERITY_ORDER:
        raise ValueError(f"unknown severity {severity!r}")
    return {"code": code, "severity": severity, "check": check, "message": message}


def _load_schema(name: str) -> dict[str, Any]:
    return json.loads((_SCHEMAS_DIR / f"{name}.schema.json").read_text(encoding="utf-8"))


def _atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
            handle.write("\n")
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


# ---------------------------------------------------------------------------
# Tool
# ---------------------------------------------------------------------------


class RenderVerifier(BaseTool):
    name = "render_verifier"
    version = "1.0.0"
    tier = ToolTier.CORE
    capability = "analysis"
    provider = "ffmpeg"
    stability = ToolStability.BETA
    execution_mode = ExecutionMode.SYNC
    determinism = Determinism.DETERMINISTIC
    runtime = ToolRuntime.LOCAL

    dependencies = ["cmd:ffmpeg", "cmd:ffprobe"]
    install_instructions = "Install FFmpeg (ffmpeg + ffprobe on PATH): https://ffmpeg.org/download.html"
    agent_skills = ["ffmpeg"]

    capabilities = [
        "verify_render",
        "full_decode_check",
        "black_frame_detection",
        "freeze_detection",
        "audio_silence_clipping_check",
        "build_render_report",
        "build_final_review",
    ]
    best_for = [
        "the mandatory post-render gate before presenting a video",
        "producing a schema-valid render_report and final_review from the real file",
        "catching truncated, corrupt, black, frozen, or silent renders",
    ]
    not_good_for = [
        "judging creative quality, overlay layout, or text readability (agent review)",
        "pre-render composition checks (use composition_validator)",
    ]

    input_schema = {
        "type": "object",
        "required": ["input_path", "output_dir"],
        "additionalProperties": False,
        "properties": {
            "input_path": {"type": "string", "minLength": 1, "description": "Rendered video to verify."},
            "output_dir": {
                "type": "string",
                "minLength": 1,
                "description": "Directory for review frames, contact sheet and report JSON. "
                "Use projects/<id>/renders/review/ so the Backlot board can see them.",
            },
            "expected": {
                "type": "object",
                "additionalProperties": False,
                "description": "What the render was supposed to be. Omitted fields are not checked.",
                "properties": {
                    "duration_seconds": {"type": "number", "exclusiveMinimum": 0},
                    "duration_tolerance": {"type": "number", "minimum": 0, "maximum": 1},
                    "width": {"type": "integer", "minimum": 1},
                    "height": {"type": "integer", "minimum": 1},
                    "fps": {"type": "number", "exclusiveMinimum": 0},
                    "video_codec": {"type": "string"},
                    "require_audio": {
                        "type": "boolean",
                        "description": "True: a missing/silent audio track is a failure. "
                        "False: a video-only output is fine. Omitted: reported as minor.",
                    },
                    "continuous_audio": {
                        "type": "boolean",
                        "description": "True for narration-led videos: silence gaps are major.",
                    },
                    "min_file_size_bytes": {"type": "integer", "minimum": 0},
                },
            },
            "thresholds": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    key: {"type": "number"}
                    for key in (
                        "black_min_seconds",
                        "black_max_seconds",
                        "black_pixel_threshold",
                        "freeze_min_seconds",
                        "freeze_noise",
                        "freeze_max_ratio",
                        "silence_threshold_db",
                        "silence_gap_seconds",
                        "silent_mean_db",
                        "clip_max_db",
                    )
                },
            },
            "sample_frames": {"type": "integer", "minimum": 4, "maximum": 24},
            "timestamps": {
                "type": "array",
                "items": {"type": "number", "minimum": 0},
                "minItems": 4,
                "description": "Explicit spot-check times (e.g. scene midpoints). Overrides sample_frames.",
            },
            "render_runtime_used": {"type": "string", "enum": ["remotion", "hyperframes", "ffmpeg"]},
            "render_runtime_locked": {
                "type": "string",
                "enum": ["remotion", "hyperframes", "ffmpeg"],
                "description": "Runtime locked at proposal; enables runtime-swap detection.",
            },
            "render_time_seconds": {"type": "number", "minimum": 0},
            "platform_target": {"type": "string"},
            "timeout_seconds": {
                "type": "integer",
                "minimum": 5,
                "maximum": 7200,
                "description": "Per-subprocess timeout. Default scales with media duration.",
            },
            "write_reports": {
                "type": "boolean",
                "default": True,
                "description": "Write render_report.json and final_review.json into output_dir.",
            },
        },
    }

    output_schema = {
        "type": "object",
        "required": ["status", "recommended_action", "issues", "render_report", "final_review", "metrics"],
        "properties": {
            "status": {"type": "string", "enum": ["pass", "revise", "fail"]},
            "recommended_action": {"type": "string"},
            "issues": {"type": "array"},
            "render_report": {"type": "object"},
            "final_review": {"type": "object"},
            "metrics": {"type": "object"},
            "frame_paths": {"type": "array"},
            "contact_sheet_path": {"type": ["string", "null"]},
            "report_paths": {"type": "object"},
        },
    }

    resource_profile = ResourceProfile(cpu_cores=2, ram_mb=512, vram_mb=0, disk_mb=50, network_required=False)
    # Local + deterministic: a transient failure (e.g. a timeout on a busy box)
    # is safe to re-run. Not applied automatically — BaseTool declares policy only.
    retry_policy = RetryPolicy(max_retries=1, backoff_seconds=1.0, retryable_errors=["timeout"])
    # Same path can hold a different file after a re-render: never serve a
    # verification result from the asset cache.
    idempotency_key_fields: list[str] = []
    side_effects = ["writes review frames, contact sheet and report JSON under output_dir"]
    user_visible_verification = [
        "Open the contact sheet and confirm every scene rendered as intended",
        "Complete final_review.metadata.pending_agent_checks before presenting",
    ]

    def estimate_cost(self, inputs: dict[str, Any]) -> float:
        return 0.0

    def estimate_runtime(self, inputs: dict[str, Any]) -> float:
        return 10.0

    # ------------------------------------------------------------------ run

    def execute(self, inputs: dict[str, Any]) -> ToolResult:
        started = time.time()
        try:
            jsonschema.validate(inputs, self.input_schema)
        except jsonschema.ValidationError as exc:
            return ToolResult(success=False, error=f"Invalid render_verifier inputs: {exc.message}")

        expected: dict[str, Any] = dict(inputs.get("expected") or {})
        thresholds = {**DEFAULTS, **(inputs.get("thresholds") or {})}
        video = Path(inputs["input_path"])
        out_dir = Path(inputs["output_dir"])
        issues: list[dict[str, Any]] = []
        metrics: dict[str, Any] = {"timings_seconds": {}}
        frame_paths: list[str] = []
        contact_sheet: Optional[str] = None

        probe = self._check_container(video, expected, thresholds, issues, metrics)
        duration = probe.get("duration_seconds") or 0.0
        timeout = int(inputs.get("timeout_seconds") or max(60, int(duration * 6) + 30))
        metrics["timeout_seconds"] = timeout

        if probe.get("has_video"):
            self._check_spec(probe, expected, thresholds, issues)
            self._check_integrity(video, timeout, issues, metrics)
            self._check_content(video, probe, expected, thresholds, timeout, issues, metrics)
            frame_paths, contact_sheet = self._sample_frames(
                video, out_dir, duration, inputs, timeout, issues, metrics
            )

        runtime_used = inputs.get("render_runtime_used")
        runtime_locked = inputs.get("render_runtime_locked")
        if runtime_used and runtime_locked and runtime_used != runtime_locked:
            issues.append(
                _issue(
                    "runtime_swap",
                    "major",
                    "promise",
                    f"Rendered with {runtime_used} but proposal locked {runtime_locked}; "
                    "needs a logged render_runtime_selection decision.",
                )
            )

        issues.sort(key=lambda i: SEVERITY_ORDER.index(i["severity"]))
        status, action = classify(issues)
        metrics["timings_seconds"]["total"] = round(time.time() - started, 3)

        render_report = self._build_render_report(video, probe, issues, metrics, inputs)
        final_review = self._build_final_review(
            video, probe, issues, metrics, status, action, frame_paths, contact_sheet, inputs, expected
        )

        report_paths: dict[str, str] = {}
        if inputs.get("write_reports", True):
            out_dir.mkdir(parents=True, exist_ok=True)
            review_path = out_dir / "final_review.json"
            report_path = out_dir / "render_report.json"
            render_report["final_review_ref"] = str(review_path)
            _atomic_write_json(review_path, final_review)
            _atomic_write_json(report_path, render_report)
            report_paths = {"render_report": str(report_path), "final_review": str(review_path)}

        # Guard our own contract: an invalid artifact here would only surface
        # later as a checkpoint failure, far from the cause.
        for name, artifact in (("render_report", render_report), ("final_review", final_review)):
            try:
                jsonschema.validate(artifact, _load_schema(name))
            except jsonschema.ValidationError as exc:
                return ToolResult(
                    success=False,
                    error=f"render_verifier produced an invalid {name}: {exc.message}",
                    data={"issues": issues, "metrics": metrics},
                )

        data = {
            "status": status,
            "recommended_action": action,
            "issues": issues,
            "issue_counts": {s: sum(1 for i in issues if i["severity"] == s) for s in SEVERITY_ORDER},
            "render_report": render_report,
            "final_review": final_review,
            "metrics": metrics,
            "frame_paths": frame_paths,
            "contact_sheet_path": contact_sheet,
            "report_paths": report_paths,
        }
        artifacts = [*frame_paths, *([contact_sheet] if contact_sheet else []), *report_paths.values()]
        elapsed = round(time.time() - started, 2)

        if status == "fail":
            summary = "; ".join(i["message"] for i in issues if i["severity"] == "critical")[:500]
            return ToolResult(
                success=False,
                error=f"Render verification failed: {summary}",
                data=data,
                artifacts=artifacts,
                duration_seconds=elapsed,
            )
        return ToolResult(success=True, data=data, artifacts=artifacts, duration_seconds=elapsed)

    # --------------------------------------------------------------- checks

    def _run(self, cmd: list[str], timeout: int) -> subprocess.CompletedProcess:
        """Run without raising on non-zero exit; callers interpret returncode."""
        return subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )

    def _check_container(
        self,
        video: Path,
        expected: dict[str, Any],
        thresholds: dict[str, Any],
        issues: list[dict[str, Any]],
        metrics: dict[str, Any],
    ) -> dict[str, Any]:
        probe: dict[str, Any] = {"valid_container": False, "has_video": False, "has_audio": False}
        if not video.is_file():
            issues.append(_issue("file_missing", "critical", "container", f"Output file not found: {video}"))
            return probe

        size = video.stat().st_size
        probe["file_size_bytes"] = size
        min_size = int(expected.get("min_file_size_bytes", thresholds["min_file_size_bytes"]))
        if size < min_size:
            issues.append(
                _issue("file_too_small", "critical", "container", f"Output is {size} bytes (< {min_size}).")
            )
            return probe

        t0 = time.time()
        try:
            proc = self._run(
                ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(video)],
                timeout=60,
            )
        except subprocess.TimeoutExpired:
            issues.append(_issue("probe_timeout", "critical", "container", "ffprobe timed out after 60s."))
            return probe
        metrics["timings_seconds"]["probe"] = round(time.time() - t0, 3)

        try:
            info = json.loads(proc.stdout or "{}")
        except json.JSONDecodeError:
            info = {}
        fmt = info.get("format") or {}
        streams = info.get("streams") or []
        if proc.returncode != 0 or not fmt:
            detail = (proc.stderr or "").strip().splitlines()[-1:] or ["no format information"]
            issues.append(
                _issue("invalid_container", "critical", "container", f"ffprobe cannot read the file: {detail[0]}")
            )
            return probe

        probe["valid_container"] = True
        probe["format_name"] = fmt.get("format_name", "")
        try:
            probe["duration_seconds"] = round(float(fmt.get("duration")), 3)
        except (TypeError, ValueError):
            probe["duration_seconds"] = 0.0

        vstreams = [s for s in streams if s.get("codec_type") == "video" and not (s.get("disposition") or {}).get("attached_pic")]
        astreams = [s for s in streams if s.get("codec_type") == "audio"]
        if not vstreams:
            issues.append(_issue("no_video_stream", "critical", "container", "File has no video stream."))
            return probe

        v = vstreams[0]
        probe.update(
            has_video=True,
            codec=v.get("codec_name", ""),
            width=int(v.get("width") or 0),
            height=int(v.get("height") or 0),
            pix_fmt=v.get("pix_fmt", ""),
            fps=parse_fps(v.get("avg_frame_rate")) or parse_fps(v.get("r_frame_rate")),
        )
        probe["resolution"] = f"{probe['width']}x{probe['height']}"
        try:
            probe["nb_frames"] = int(v.get("nb_frames"))
        except (TypeError, ValueError):
            probe["nb_frames"] = None
        if astreams:
            a = astreams[0]
            probe.update(
                has_audio=True,
                audio_codec=a.get("codec_name", ""),
                audio_channels=int(a.get("channels") or 0),
                audio_sample_rate=int(a.get("sample_rate") or 0),
            )
        if probe["duration_seconds"] <= 0:
            issues.append(_issue("zero_duration", "critical", "container", "Container reports zero duration."))
        return probe

    def _check_spec(
        self,
        probe: dict[str, Any],
        expected: dict[str, Any],
        thresholds: dict[str, Any],
        issues: list[dict[str, Any]],
    ) -> None:
        duration = probe.get("duration_seconds") or 0.0
        target = expected.get("duration_seconds")
        if target:
            tol = float(expected.get("duration_tolerance", thresholds["duration_tolerance"]))
            drift = abs(duration - target) / target
            if drift > tol:
                issues.append(
                    _issue(
                        "duration_out_of_tolerance",
                        "major",
                        "spec",
                        f"Duration {duration:.2f}s is {drift:.1%} off target {target:.2f}s (tolerance {tol:.0%}).",
                    )
                )
        for key, label in (("width", "Width"), ("height", "Height")):
            want = expected.get(key)
            if want and probe.get(key) != want:
                issues.append(
                    _issue("resolution_mismatch", "major", "spec", f"{label} is {probe.get(key)}, expected {want}.")
                )
        want_fps = expected.get("fps")
        if want_fps and (probe.get("fps") is None or abs(probe["fps"] - float(want_fps)) > 0.01):
            issues.append(_issue("fps_mismatch", "major", "spec", f"FPS is {probe.get('fps')}, expected {want_fps}."))
        want_codec = expected.get("video_codec")
        if want_codec and probe.get("codec") != want_codec:
            issues.append(
                _issue("codec_mismatch", "major", "spec", f"Video codec is {probe.get('codec')}, expected {want_codec}.")
            )
        if probe.get("pix_fmt") not in ("yuv420p", "yuvj420p", ""):
            issues.append(
                _issue(
                    "pixel_format",
                    "minor",
                    "spec",
                    f"Pixel format {probe.get('pix_fmt')} may not play on all devices (yuv420p is safest).",
                )
            )

        require_audio = expected.get("require_audio")
        if not probe.get("has_audio"):
            if require_audio:
                issues.append(
                    _issue("no_audio_stream", "critical", "audio", "No audio stream, but this video requires audio.")
                )
            elif require_audio is None:
                issues.append(
                    _issue(
                        "no_audio_stream",
                        "minor",
                        "audio",
                        "Video-only output. Some platforms expect an audio track; set expected.require_audio.",
                    )
                )

    def _check_integrity(
        self, video: Path, timeout: int, issues: list[dict[str, Any]], metrics: dict[str, Any]
    ) -> None:
        t0 = time.time()
        try:
            proc = self._run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(video), "-f", "null", "-"], timeout)
        except subprocess.TimeoutExpired:
            issues.append(_issue("decode_timeout", "critical", "integrity", f"Full decode exceeded {timeout}s."))
            return
        metrics["timings_seconds"]["decode"] = round(time.time() - t0, 3)
        errors = [line for line in (proc.stderr or "").splitlines() if line.strip()]
        metrics["decode_error_lines"] = len(errors)
        if proc.returncode != 0:
            issues.append(
                _issue(
                    "decode_failed",
                    "critical",
                    "integrity",
                    f"ffmpeg could not decode the whole file (exit {proc.returncode}): "
                    + (errors[-1] if errors else "no detail"),
                )
            )
        elif errors:
            issues.append(
                _issue(
                    "decode_errors",
                    "major",
                    "integrity",
                    f"{len(errors)} decoder error line(s), first: {errors[0][:200]}",
                )
            )

    def _check_content(
        self,
        video: Path,
        probe: dict[str, Any],
        expected: dict[str, Any],
        th: dict[str, Any],
        timeout: int,
        issues: list[dict[str, Any]],
        metrics: dict[str, Any],
    ) -> None:
        duration = probe.get("duration_seconds") or 0.0
        cmd = [
            "ffmpeg", "-nostdin", "-nostats", "-v", "info", "-i", str(video),
            "-map", "0:v:0",
            "-vf",
            f"blackdetect=d={th['black_min_seconds']}:pic_th={th['black_pixel_threshold']},"
            f"freezedetect=n={th['freeze_noise']}:d={th['freeze_min_seconds']}",
            "-f", "null", "-",
        ]
        if probe.get("has_audio"):
            cmd[cmd.index("-f"):cmd.index("-f")] = [
                "-map", "0:a:0",
                "-af", f"volumedetect,silencedetect=n={th['silence_threshold_db']}dB:d={th['silence_gap_seconds']}",
            ]
        t0 = time.time()
        try:
            proc = self._run(cmd, timeout)
        except subprocess.TimeoutExpired:
            issues.append(_issue("analysis_timeout", "major", "visual", f"Content analysis exceeded {timeout}s."))
            return
        metrics["timings_seconds"]["content_analysis"] = round(time.time() - t0, 3)
        log = proc.stderr or ""

        black = parse_black_segments(log)
        freeze = parse_freeze_segments(log, duration)
        metrics["black_segments"] = black
        metrics["freeze_segments"] = freeze
        frozen_total = sum(s["duration"] for s in freeze)
        metrics["frozen_ratio"] = round(frozen_total / duration, 3) if duration else 0.0
        metrics["black_total_seconds"] = round(sum(s["duration"] for s in black), 3)

        for seg in black:
            severity = "major" if seg["duration"] > th["black_max_seconds"] else "minor"
            issues.append(
                _issue(
                    "black_segment",
                    severity,
                    "visual",
                    f"Black frames {seg['start']:.2f}s–{seg['end']:.2f}s ({seg['duration']:.2f}s).",
                )
            )
        if duration and metrics["frozen_ratio"] > th["freeze_max_ratio"]:
            issues.append(
                _issue(
                    "mostly_frozen",
                    "major",
                    "visual",
                    f"{metrics['frozen_ratio']:.0%} of the video is frozen (> {th['freeze_max_ratio']:.0%}); "
                    "reads as a slideshow.",
                )
            )
        elif freeze:
            issues.append(
                _issue(
                    "frozen_segments",
                    "minor",
                    "visual",
                    f"{len(freeze)} static hold(s) ≥ {th['freeze_min_seconds']}s, "
                    f"{metrics['frozen_ratio']:.0%} of runtime. Confirm the holds are intentional.",
                )
            )

        if not probe.get("has_audio"):
            return
        volume = parse_volume(log)
        silence = parse_silence_segments(log, duration)
        metrics.update(volume)
        metrics["silence_segments"] = silence
        require_audio = expected.get("require_audio")
        mean_db = volume.get("mean_volume_db")
        peak_db = volume.get("max_volume_db")

        silent_track = mean_db is not None and mean_db <= th["silent_mean_db"]
        metrics["audio_silent"] = bool(silent_track)
        if silent_track:
            if require_audio:
                issues.append(
                    _issue("silent_audio", "critical", "audio", f"Audio track is silent (mean {mean_db} dB).")
                )
            else:
                issues.append(
                    _issue(
                        "silent_audio",
                        "minor",
                        "audio",
                        f"Audio track is present but silent (mean {mean_db} dB) — a placeholder track.",
                    )
                )
        elif silence:
            severity = "major" if expected.get("continuous_audio") else "minor"
            longest = max(s["duration"] for s in silence)
            issues.append(
                _issue(
                    "silence_gaps",
                    severity,
                    "audio",
                    f"{len(silence)} silence gap(s) > {th['silence_gap_seconds']}s, longest {longest:.2f}s.",
                )
            )
        if peak_db is not None and peak_db >= th["clip_max_db"]:
            issues.append(
                _issue("clipping", "major", "audio", f"Audio peaks at {peak_db} dBFS (≥ {th['clip_max_db']}); likely clipping.")
            )

    def _sample_frames(
        self,
        video: Path,
        out_dir: Path,
        duration: float,
        inputs: dict[str, Any],
        timeout: int,
        issues: list[dict[str, Any]],
        metrics: dict[str, Any],
    ) -> tuple[list[str], Optional[str]]:
        stamps = [t for t in (inputs.get("timestamps") or []) if t < duration] or sample_timestamps(
            duration, int(inputs.get("sample_frames") or DEFAULTS["sample_frames"])
        )
        frames_dir = out_dir / "frames"
        frames_dir.mkdir(parents=True, exist_ok=True)
        t0 = time.time()
        paths: list[str] = []
        for idx, ts in enumerate(stamps):
            target = frames_dir / f"frame_{idx:02d}_{ts:08.3f}s.png"
            try:
                proc = self._run(
                    ["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", f"{ts}", "-i", str(video),
                     "-frames:v", "1", str(target)],
                    timeout,
                )
            except subprocess.TimeoutExpired:
                proc = None
            if proc is not None and proc.returncode == 0 and target.is_file() and target.stat().st_size > 0:
                paths.append(str(target))
        metrics["timings_seconds"]["frames"] = round(time.time() - t0, 3)
        metrics["frame_timestamps"] = stamps
        if len(paths) < min(4, len(stamps)):
            issues.append(
                _issue(
                    "frame_extraction_failed",
                    "major",
                    "visual",
                    f"Only {len(paths)}/{len(stamps)} review frames could be extracted.",
                )
            )
            return paths, None


        sheet = out_dir / "contact_sheet.png"
        cols = 3
        rows = (len(paths) + cols - 1) // cols
        cmd = ["ffmpeg", "-nostdin", "-v", "error", "-y"]
        for p in paths:
            cmd += ["-i", p]
        # Frames come from one video, so they share a size: concat them into a
        # short stream and let `tile` lay out the grid (partial rows padded black).
        graph = (
            "".join(f"[{i}:v]" for i in range(len(paths)))
            + f"concat=n={len(paths)}:v=1:a=0,scale=480:-2,tile={cols}x{rows}:color=black[out]"
        )
        try:
            proc = self._run(cmd + ["-filter_complex", graph, "-map", "[out]", "-frames:v", "1", str(sheet)], timeout)
            if proc.returncode == 0 and sheet.is_file() and sheet.stat().st_size > 0:
                return paths, str(sheet)
        except subprocess.TimeoutExpired:
            pass
        issues.append(_issue("contact_sheet_failed", "minor", "visual", "Could not build the contact sheet."))
        return paths, None

    # -------------------------------------------------------------- reports

    def _build_render_report(
        self,
        video: Path,
        probe: dict[str, Any],
        issues: list[dict[str, Any]],
        metrics: dict[str, Any],
        inputs: dict[str, Any],
    ) -> dict[str, Any]:
        output: dict[str, Any] = {
            "path": str(video),
            "format": (video.suffix.lstrip(".") or probe.get("format_name", "unknown")).lower(),
            "resolution": probe.get("resolution", "unknown"),
            "duration_seconds": float(probe.get("duration_seconds") or 0.0),
        }
        for key in ("codec", "audio_codec", "fps", "file_size_bytes"):
            if probe.get(key) not in (None, ""):
                output[key] = probe[key]
        if inputs.get("platform_target"):
            output["platform_target"] = inputs["platform_target"]

        report: dict[str, Any] = {
            "version": "1.0",
            "outputs": [output],
            "warnings": [f"[{i['severity']}] {i['message']}" for i in issues],
            "verification_notes": [
                f"render_verifier {self.version}: container, full decode, spec, black/freeze, audio, "
                f"{len(metrics.get('frame_timestamps') or [])} spot frames",
            ],
            "metadata": {
                "verifier": {"name": self.name, "version": self.version},
                "issues": issues,
                "metrics": metrics,
            },
        }
        if inputs.get("render_time_seconds") is not None:
            report["render_time_seconds"] = inputs["render_time_seconds"]
        return report

    def _build_final_review(
        self,
        video: Path,
        probe: dict[str, Any],
        issues: list[dict[str, Any]],
        metrics: dict[str, Any],
        status: str,
        action: str,
        frame_paths: list[str],
        contact_sheet: Optional[str],
        inputs: dict[str, Any],
        expected: dict[str, Any],
    ) -> dict[str, Any]:
        def msgs(*checks: str) -> list[str]:
            return [i["message"] for i in issues if i["check"] in checks]

        codes = {i["code"] for i in issues}
        technical = {
            "valid_container": bool(probe.get("valid_container")),
            "duration_seconds": float(probe.get("duration_seconds") or 0.0),
            "resolution": probe.get("resolution", "unknown"),
            "has_audio": bool(probe.get("has_audio")),
            "issues": msgs("container", "integrity", "spec"),
        }
        if probe.get("fps") is not None:
            technical["fps"] = probe["fps"]
        if probe.get("codec"):
            technical["codec"] = probe["codec"]
        if probe.get("file_size_bytes") is not None:
            technical["file_size_bytes"] = probe["file_size_bytes"]

        visual: dict[str, Any] = {
            "frame_paths": frame_paths,
            "black_frames_detected": "black_segment" in codes,
            "issues": msgs("visual"),
        }
        if len(frame_paths) >= 4:
            visual["frames_sampled"] = len(frame_paths)

        audio: dict[str, Any] = {
            "unexpected_silence": bool(
                ("silent_audio" in codes and expected.get("require_audio"))
                or ("silence_gaps" in codes and expected.get("continuous_audio"))
                or ("no_audio_stream" in codes and expected.get("require_audio"))
            ),
            "clipping_detected": "clipping" in codes,
            "issues": msgs("audio"),
        }

        promise: dict[str, Any] = {"issues": msgs("promise")}
        used, locked = inputs.get("render_runtime_used"), inputs.get("render_runtime_locked")
        if used:
            promise["render_runtime_used"] = used
            if locked:
                promise["runtime_swap_detected"] = used != locked
                promise["runtime_swap_check"] = (
                    f"ok — rendered with locked runtime {locked}"
                    if used == locked
                    else f"detected — rendered with {used}, proposal locked {locked}"
                )
            else:
                promise["runtime_swap_check"] = "skipped — render_runtime_locked not provided"

        return {
            "version": "1.0",
            "output_path": str(video),
            "status": status,
            "checks": {
                "technical_probe": technical,
                "visual_spotcheck": visual,
                "audio_spotcheck": audio,
                "promise_preservation": promise,
                "subtitle_check": {"issues": []},
            },
            "issues_found": [f"[{i['severity']}] {i['message']}" for i in issues],
            "recommended_action": action,
            "metadata": {
                "automated_only": True,
                "verifier": {"name": self.name, "version": self.version},
                "contact_sheet_path": contact_sheet,
                "issue_counts": {s: sum(1 for i in issues if i["severity"] == s) for s in SEVERITY_ORDER},
                # Judgement the tool cannot make. The agent fills these in after
                # looking at the frames/contact sheet and listening to the audio.
                "pending_agent_checks": [
                    "visual_spotcheck.broken_overlays",
                    "visual_spotcheck.missing_assets",
                    "visual_spotcheck.unreadable_text",
                    "audio_spotcheck.narration_present",
                    "audio_spotcheck.music_present",
                    "audio_spotcheck.mix_intelligible",
                    "promise_preservation.delivery_promise_honored",
                    "subtitle_check",
                ],
            },
        }
