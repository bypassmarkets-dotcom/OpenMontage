"""render_verifier: pure helpers (unit) and real ffmpeg fixtures (integration).

Fixtures are synthesized with ffmpeg's lavfi sources, so every failure mode the
verifier claims to catch is exercised against an actual file — not a mock.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import jsonschema
import pytest

from tools.analysis.render_verifier import (
    RenderVerifier,
    classify,
    parse_black_segments,
    parse_fps,
    parse_freeze_segments,
    parse_silence_segments,
    parse_volume,
    sample_timestamps,
)

REPO = Path(__file__).resolve().parents[2]
SCHEMAS = REPO / "schemas" / "artifacts"

needs_ffmpeg = pytest.mark.skipif(
    not (shutil.which("ffmpeg") and shutil.which("ffprobe")), reason="ffmpeg/ffprobe not installed"
)


def _schema(name: str) -> dict:
    return json.loads((SCHEMAS / f"{name}.schema.json").read_text(encoding="utf-8"))


# ---------------------------------------------------------------- unit


@pytest.mark.parametrize(
    "rate, expected",
    [("30/1", 30.0), ("30000/1001", 29.97), ("25", 25.0), ("0/0", None), ("", None), (None, None), ("abc", None)],
)
def test_parse_fps(rate, expected) -> None:
    assert parse_fps(rate) == expected


def test_parse_black_segments() -> None:
    log = (
        "[blackdetect @ 0x1] black_start:1 black_end:3.0333 black_duration:2.0333\n"
        "[blackdetect @ 0x1] black_start:5.5 black_end:6 black_duration:0.5\n"
    )
    assert parse_black_segments(log) == [
        {"start": 1.0, "end": 3.0333, "duration": 2.0333},
        {"start": 5.5, "end": 6.0, "duration": 0.5},
    ]


def test_parse_freeze_segments_closes_unterminated_freeze_at_eof() -> None:
    log = (
        "[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 1.5\n"
        "[freezedetect @ 0x1] lavfi.freezedetect.freeze_end: 4\n"
        "[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 8\n"
    )
    assert parse_freeze_segments(log, 10.0) == [
        {"start": 1.5, "end": 4.0, "duration": 2.5},
        {"start": 8.0, "end": 10.0, "duration": 2.0},
    ]


def test_parse_silence_and_volume() -> None:
    log = (
        "[silencedetect @ 0x1] silence_start: -0.002\n"
        "[silencedetect @ 0x1] silence_end: 2.5 | silence_duration: 2.5\n"
        "[Parsed_volumedetect_0 @ 0x1] mean_volume: -20.5 dB\n"
        "[Parsed_volumedetect_0 @ 0x1] max_volume: -inf dB\n"
    )
    assert parse_silence_segments(log, 9.0) == [{"start": 0.0, "end": 2.5, "duration": 2.5}]
    volume = parse_volume(log)
    assert volume["mean_volume_db"] == -20.5
    assert volume["max_volume_db"] == float("-inf")
    assert parse_volume("nothing") == {"mean_volume_db": None, "max_volume_db": None}


def test_sample_timestamps_are_inside_the_media() -> None:
    stamps = sample_timestamps(10.0, 4)
    assert stamps == [1.25, 3.75, 6.25, 8.75]
    assert sample_timestamps(0, 4) == [] and sample_timestamps(5, 0) == []


@pytest.mark.parametrize(
    "issues, expected",
    [
        ([], ("pass", "present_to_user")),
        ([{"code": "silent_audio", "severity": "minor"}], ("pass", "present_to_user")),
        ([{"code": "black_segment", "severity": "major"}], ("revise", "revise_edit")),
        ([{"code": "clipping", "severity": "major"}], ("revise", "re_render")),
        ([{"code": "decode_failed", "severity": "critical"}], ("fail", "re_render")),
        ([{"code": "invalid_container", "severity": "critical"}], ("fail", "block")),
    ],
)
def test_classify(issues, expected) -> None:
    assert classify(issues) == expected


def test_rejects_invalid_inputs_without_touching_disk(tmp_path) -> None:
    tool = RenderVerifier()
    missing_dir = tool.execute({"input_path": "x.mp4"})
    assert not missing_dir.success and "output_dir" in missing_dir.error
    bad_key = tool.execute({"input_path": "x.mp4", "output_dir": str(tmp_path / "o"), "expected": {"bogus": 1}})
    assert not bad_key.success and "Invalid render_verifier inputs" in bad_key.error
    too_few = tool.execute({"input_path": "x.mp4", "output_dir": str(tmp_path / "o"), "sample_frames": 2})
    assert not too_few.success
    assert not (tmp_path / "o").exists()


def test_contract_fields() -> None:
    info = RenderVerifier().get_info()
    assert info["name"] == "render_verifier"
    assert info["capability"] == "analysis"
    assert info["determinism"] == "deterministic"
    assert RenderVerifier().estimate_cost({}) == 0.0
    # A verification result must never be replayed from the asset cache.
    assert RenderVerifier.idempotency_key_fields == []


# --------------------------------------------------------- integration


def _ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", *args], check=True)


@pytest.fixture(scope="module")
def media(tmp_path_factory) -> dict[str, Path]:
    if not (shutil.which("ffmpeg") and shutil.which("ffprobe")):
        pytest.skip("ffmpeg/ffprobe not installed")
    root = tmp_path_factory.mktemp("render_verifier_media")
    out: dict[str, Path] = {}
    enc = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast"]
    aac = ["-c:a", "aac", "-shortest"]

    out["good"] = root / "good.mp4"
    _ffmpeg("-f", "lavfi", "-i", "testsrc2=s=640x360:r=30:d=4",
             "-f", "lavfi", "-i", "sine=f=440:r=48000:d=4", *enc, *aac, str(out["good"]))

    out["video_only"] = root / "video_only.mp4"
    _ffmpeg("-f", "lavfi", "-i", "testsrc2=s=640x360:r=30:d=4", *enc, str(out["video_only"]))

    out["black_gap"] = root / "black_gap.mp4"
    _ffmpeg("-f", "lavfi", "-i", "testsrc2=s=640x360:r=30:d=5",
             "-f", "lavfi", "-i", "sine=f=440:r=48000:d=5",
             "-vf", "drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='between(t,1,3)'",
             *enc, *aac, str(out["black_gap"]))

    out["frozen"] = root / "frozen.mp4"
    _ffmpeg("-f", "lavfi", "-i", "smptebars=s=640x360:r=30:d=6",
             "-f", "lavfi", "-i", "sine=f=440:r=48000:d=6", *enc, *aac, str(out["frozen"]))

    out["silent"] = root / "silent.mp4"
    _ffmpeg("-f", "lavfi", "-i", "testsrc2=s=640x360:r=30:d=4",
             "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "4", *enc, *aac, str(out["silent"]))

    out["clipping"] = root / "clipping.mp4"
    _ffmpeg("-f", "lavfi", "-i", "testsrc2=s=640x360:r=30:d=4",
             "-f", "lavfi", "-i", "sine=f=440:r=48000:d=4", "-af", "volume=30dB",
             *enc, *aac, str(out["clipping"]))

    # Truncated: the moov atom of a non-faststart MP4 lives at the end.
    out["truncated"] = root / "truncated.mp4"
    data = out["good"].read_bytes()
    out["truncated"].write_bytes(data[: len(data) // 2])

    out["tiny"] = root / "tiny.mp4"
    out["tiny"].write_bytes(b"\x00" * 100)
    return out


def _verify(path: Path, tmp_path: Path, **extra) -> tuple:
    out_dir = tmp_path / "review"
    result = RenderVerifier().execute({"input_path": str(path), "output_dir": str(out_dir), **extra})
    codes = {i["code"]: i["severity"] for i in result.data.get("issues", [])}
    return result, codes, out_dir


@needs_ffmpeg
def test_good_render_passes_and_artifacts_are_schema_valid(media, tmp_path) -> None:
    result, codes, out_dir = _verify(
        media["good"],
        tmp_path,
        expected={"duration_seconds": 4, "width": 640, "height": 360, "fps": 30,
                  "video_codec": "h264", "require_audio": True},
        render_runtime_used="ffmpeg",
        render_runtime_locked="ffmpeg",
        platform_target="test",
        render_time_seconds=1.5,
    )
    assert result.success, result.error
    assert result.data["status"] == "pass"
    assert codes == {}
    report, review = result.data["render_report"], result.data["final_review"]
    jsonschema.validate(report, _schema("render_report"))
    jsonschema.validate(review, _schema("final_review"))
    output = report["outputs"][0]
    assert output["resolution"] == "640x360" and output["fps"] == 30.0 and output["codec"] == "h264"
    assert output["audio_codec"] == "aac" and output["platform_target"] == "test"
    assert review["checks"]["technical_probe"]["has_audio"] is True
    assert review["checks"]["promise_preservation"]["runtime_swap_detected"] is False
    assert review["checks"]["visual_spotcheck"]["frames_sampled"] == 6
    assert review["metadata"]["pending_agent_checks"], "agent judgement must stay explicit"

    # Every claimed artifact exists; reports on disk equal the returned data.
    assert all(Path(p).is_file() for p in result.artifacts)
    assert Path(result.data["contact_sheet_path"]).stat().st_size > 0
    assert json.loads((out_dir / "final_review.json").read_text()) == review
    on_disk = json.loads((out_dir / "render_report.json").read_text())
    assert on_disk == report and report["final_review_ref"] == str(out_dir / "final_review.json")


@needs_ffmpeg
def test_rerun_is_idempotent(media, tmp_path) -> None:
    first, _, out_dir = _verify(media["good"], tmp_path)
    second, _, _ = _verify(media["good"], tmp_path)
    assert first.data["status"] == second.data["status"]
    assert first.data["issues"] == second.data["issues"]
    assert sorted(first.artifacts) == sorted(second.artifacts)
    # No stray temp files from the atomic writes.
    assert not [p for p in out_dir.iterdir() if p.name.startswith(".")]


@needs_ffmpeg
def test_video_only_depends_on_audio_expectation(media, tmp_path) -> None:
    neutral, codes, _ = _verify(media["video_only"], tmp_path)
    assert neutral.success and codes == {"no_audio_stream": "minor"}

    ok, codes, _ = _verify(media["video_only"], tmp_path, expected={"require_audio": False})
    assert ok.success and codes == {}

    required, codes, _ = _verify(media["video_only"], tmp_path, expected={"require_audio": True})
    assert not required.success
    assert required.data["status"] == "fail" and codes["no_audio_stream"] == "critical"
    assert required.data["final_review"]["checks"]["audio_spotcheck"]["unexpected_silence"] is True


@needs_ffmpeg
def test_black_gap_is_major(media, tmp_path) -> None:
    result, codes, _ = _verify(media["black_gap"], tmp_path)
    assert result.success  # revise is actionable, not a hard failure
    assert result.data["status"] == "revise" and result.data["recommended_action"] == "revise_edit"
    assert codes["black_segment"] == "major"
    seg = result.data["metrics"]["black_segments"][0]
    assert 0.9 <= seg["start"] <= 1.1 and 1.8 <= seg["duration"] <= 2.2
    assert result.data["final_review"]["checks"]["visual_spotcheck"]["black_frames_detected"] is True


@needs_ffmpeg
def test_frozen_video_reads_as_slideshow(media, tmp_path) -> None:
    result, codes, _ = _verify(media["frozen"], tmp_path)
    assert codes.get("mostly_frozen") == "major"
    assert result.data["metrics"]["frozen_ratio"] > 0.5


@needs_ffmpeg
def test_silent_track_severity_follows_expectation(media, tmp_path) -> None:
    placeholder, codes, _ = _verify(media["silent"], tmp_path)
    assert placeholder.success and codes == {"silent_audio": "minor"}
    required, codes, _ = _verify(media["silent"], tmp_path, expected={"require_audio": True})
    assert not required.success and codes["silent_audio"] == "critical"


@needs_ffmpeg
def test_clipping_detected(media, tmp_path) -> None:
    result, codes, _ = _verify(media["clipping"], tmp_path)
    assert codes.get("clipping") == "major"
    assert result.data["final_review"]["checks"]["audio_spotcheck"]["clipping_detected"] is True


@needs_ffmpeg
def test_spec_mismatches(media, tmp_path) -> None:
    result, codes, _ = _verify(
        media["good"],
        tmp_path,
        expected={"duration_seconds": 10, "width": 1920, "height": 1080, "fps": 25, "video_codec": "hevc"},
    )
    for code in ("duration_out_of_tolerance", "resolution_mismatch", "fps_mismatch", "codec_mismatch"):
        assert codes.get(code) == "major", code
    assert result.data["status"] == "revise"


@needs_ffmpeg
def test_runtime_swap_detected(media, tmp_path) -> None:
    result, codes, _ = _verify(media["good"], tmp_path, render_runtime_used="ffmpeg", render_runtime_locked="remotion")
    assert codes.get("runtime_swap") == "major"
    promise = result.data["final_review"]["checks"]["promise_preservation"]
    assert promise["runtime_swap_detected"] is True and promise["runtime_swap_check"].startswith("detected")


@needs_ffmpeg
@pytest.mark.parametrize("name, code", [("truncated", "invalid_container"), ("tiny", "file_too_small")])
def test_broken_files_fail_and_block(media, tmp_path, name, code) -> None:
    result, codes, _ = _verify(media[name], tmp_path)
    assert not result.success
    assert codes.get(code) == "critical"
    assert result.data["status"] == "fail" and result.data["recommended_action"] == "block"
    # Even a failed verification yields schema-valid artifacts for the checkpoint.
    jsonschema.validate(result.data["render_report"], _schema("render_report"))
    jsonschema.validate(result.data["final_review"], _schema("final_review"))


@needs_ffmpeg
def test_missing_file_fails(tmp_path) -> None:
    result, codes, _ = _verify(tmp_path / "nope.mp4", tmp_path)
    assert not result.success and codes == {"file_missing": "critical"}


@needs_ffmpeg
def test_timeout_is_reported_not_raised(media, tmp_path, monkeypatch) -> None:
    real_run = RenderVerifier._run

    def slow_decode(self, cmd, timeout):
        if "-f" in cmd and "null" in cmd and "blackdetect" not in " ".join(cmd):
            raise subprocess.TimeoutExpired(cmd, timeout)
        return real_run(self, cmd, timeout)

    monkeypatch.setattr(RenderVerifier, "_run", slow_decode)
    result, codes, _ = _verify(media["good"], tmp_path, timeout_seconds=5)
    assert codes.get("decode_timeout") == "critical"
    assert result.data["status"] == "fail" and result.data["recommended_action"] == "re_render"
