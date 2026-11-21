"""End-to-end: animated-explainer run from checkpoints through a real render to
a verified compose checkpoint.

Planning stages use schema-valid sample artifacts (the agent's creative work is
not what this test exercises). From ``edit`` on, everything is real: source
clips are synthesized with ffmpeg, ``video_compose`` renders the cut list via
the FFmpeg runtime, ``render_verifier`` inspects the actual file, and the
compose checkpoint is written with its render_report and final_review.

Also covered: a broken render is caught and recorded as a failed compose
checkpoint, the run resumes at ``compose``, and a fixed re-render advances the
pipeline to ``publish``.

Opt-in heavy variant: set OPENMONTAGE_E2E_REMOTION=1 to also render the
checked-in ``code-to-screen`` demo with Remotion and verify it.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

import jsonschema
import pytest

from lib.checkpoint import (
    get_next_stage,
    init_project,
    read_checkpoint,
    write_checkpoint,
)
from schemas.artifacts import validate_artifact
from tests.contracts.test_phase0_contracts import sample_artifact
from tools.analysis.render_verifier import RenderVerifier
from tools.base_tool import ToolResult
from tools.video.video_compose import VideoCompose

REPO = Path(__file__).resolve().parents[2]
PIPELINE = "animated-explainer"
PROJECT = "e2e-verified-compose"

pytestmark = pytest.mark.skipif(
    not (shutil.which("ffmpeg") and shutil.which("ffprobe")), reason="ffmpeg/ffprobe not installed"
)

PRE_COMPOSE = [
    ("research", "research_brief"),
    ("proposal", "proposal_packet"),
    ("script", "script"),
    ("scene_plan", "scene_plan"),
    ("assets", "asset_manifest"),
]


def _ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", *args], check=True)


def _approve_planning_stages(pipeline_dir: Path) -> None:
    for stage, artifact in PRE_COMPOSE:
        write_checkpoint(
            pipeline_dir,
            PROJECT,
            stage,
            "completed",
            {artifact: sample_artifact(artifact)},
            pipeline_type=PIPELINE,
            human_approved=True,
        )


def _make_sources(assets: Path) -> tuple[list[Path], Path]:
    (assets / "video").mkdir(parents=True, exist_ok=True)
    (assets / "audio").mkdir(parents=True, exist_ok=True)
    clips = []
    # Three visually distinct, constantly moving scenes (no black, no freeze).
    sources = [
        "testsrc2=s=640x360:r=30",
        "mandelbrot=s=640x360:r=30",
        "life=s=640x360:mold=10:ratio=0.5:r=30",
    ]
    for i, source in enumerate(sources):
        clip = assets / "video" / f"scene-{i + 1}.mp4"
        _ffmpeg("-f", "lavfi", "-i", source, "-t", "3",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", str(clip))
        clips.append(clip)
    narration = assets / "audio" / "narration.wav"
    _ffmpeg("-f", "lavfi", "-i", "sine=f=330:r=48000:d=9", "-af", "volume=-6dB", str(narration))
    return clips, narration


def _edit_decisions(clips: list[Path]) -> dict:
    decisions = sample_artifact("edit_decisions")
    decisions["cuts"] = [
        {"id": f"cut-{i + 1}", "source": str(clip), "in_seconds": 0, "out_seconds": 3}
        for i, clip in enumerate(clips)
    ]
    decisions["render_runtime"] = "ffmpeg"
    validate_artifact("edit_decisions", decisions)
    return decisions


def _render(decisions: dict, narration: Path, output: Path) -> None:
    result = VideoCompose().execute(
        {
            "operation": "compose",
            "edit_decisions": {
                "cuts": [
                    {"source": c["source"], "in_seconds": c["in_seconds"], "out_seconds": c["out_seconds"]}
                    for c in decisions["cuts"]
                ]
            },
            "audio_path": str(narration),
            "codec": "libx264",
            "crf": 23,
            "preset": "ultrafast",
            "output_path": str(output),
        }
    )
    assert result.success, result.error


def _verify(video: Path, review_dir: Path, decisions: dict) -> ToolResult:
    total = sum(c["out_seconds"] - c["in_seconds"] for c in decisions["cuts"])
    midpoints = []
    t = 0.0
    for c in decisions["cuts"]:
        span = c["out_seconds"] - c["in_seconds"]
        midpoints.append(round(t + span / 2, 3))
        t += span
    midpoints.append(round(total - 0.5, 3))
    return RenderVerifier().execute(
        {
            "input_path": str(video),
            "output_dir": str(review_dir),
            "expected": {"duration_seconds": total, "require_audio": True, "video_codec": "h264"},
            "timestamps": midpoints,
            "render_runtime_used": "ffmpeg",
            "render_runtime_locked": decisions["render_runtime"],
        }
    )


def test_render_is_verified_before_compose_completes(tmp_path) -> None:
    project_dir = init_project(PROJECT, title="E2E verified compose", pipeline_type=PIPELINE, pipeline_dir=tmp_path)
    _approve_planning_stages(tmp_path)

    clips, narration = _make_sources(project_dir / "assets")
    decisions = _edit_decisions(clips)
    write_checkpoint(tmp_path, PROJECT, "edit", "completed", {"edit_decisions": decisions}, pipeline_type=PIPELINE)
    assert get_next_stage(tmp_path, PROJECT, PIPELINE) == "compose"

    renders = project_dir / "renders"
    renders.mkdir(exist_ok=True)
    final = renders / "final.mp4"

    # --- Attempt 1: the render is broken (truncated mid-write) -------------
    _render(decisions, narration, final)
    good_bytes = final.read_bytes()
    final.write_bytes(good_bytes[: len(good_bytes) // 3])

    broken = _verify(final, renders / "review", decisions)
    assert not broken.success
    assert broken.data["status"] == "fail" and broken.data["recommended_action"] == "block"
    write_checkpoint(
        tmp_path,
        PROJECT,
        "compose",
        "failed",
        {"render_report": broken.data["render_report"], "final_review": broken.data["final_review"]},
        pipeline_type=PIPELINE,
        error=broken.error,
    )
    # Resumability: a failed compose leaves the run parked at compose.
    assert get_next_stage(tmp_path, PROJECT, PIPELINE) == "compose"

    # --- Attempt 2: re-render, verify, complete ----------------------------
    _render(decisions, narration, final)
    verified = _verify(final, renders / "review", decisions)
    assert verified.success, verified.data.get("issues")
    assert verified.data["status"] == "pass", verified.data["issues"]

    report, review = verified.data["render_report"], verified.data["final_review"]
    validate_artifact("render_report", report)
    validate_artifact("final_review", review)
    assert abs(report["outputs"][0]["duration_seconds"] - 9.0) < 0.5
    assert review["checks"]["technical_probe"]["has_audio"] is True
    assert review["checks"]["promise_preservation"]["runtime_swap_detected"] is False
    assert len(review["checks"]["visual_spotcheck"]["frame_paths"]) == 4

    write_checkpoint(
        tmp_path,
        PROJECT,
        "compose",
        "completed",
        {"render_report": report, "final_review": review},
        pipeline_type=PIPELINE,
        metadata={"verification": {"status": verified.data["status"], "issue_counts": verified.data["issue_counts"]}},
    )
    assert get_next_stage(tmp_path, PROJECT, PIPELINE) == "publish"

    saved = read_checkpoint(tmp_path, PROJECT, "compose")
    assert saved["status"] == "completed"
    assert saved["artifacts"]["render_report"]["outputs"][0]["path"] == str(final)
    # The failed attempt is archived, not destroyed.
    history = list((project_dir / "history").glob("checkpoint_compose*"))
    assert history, "superseded compose checkpoint should be archived"
    # Review evidence lives inside the project workspace (visible to Backlot).
    assert Path(verified.data["contact_sheet_path"]).is_relative_to(project_dir)
    assert json.loads((renders / "review" / "render_report.json").read_text())["outputs"][0]["path"] == str(final)


@pytest.mark.skipif(os.environ.get("OPENMONTAGE_E2E_REMOTION") != "1", reason="set OPENMONTAGE_E2E_REMOTION=1")
def test_remotion_demo_render_is_verified(tmp_path) -> None:
    composer = REPO / "remotion-composer"
    if not (composer / "node_modules").is_dir():
        pytest.skip("remotion-composer/node_modules missing (run npm ci)")
    props = composer / "public" / "demo-props" / "code-to-screen.json"
    output = tmp_path / "code-to-screen.mp4"
    subprocess.run(
        ["npx", "remotion", "render", "src/index.tsx", "Explainer", str(output),
         "--props", str(props), "--codec", "h264"],
        cwd=composer, check=True, capture_output=True, timeout=1800,
    )
    cuts = json.loads(props.read_text())["cuts"]
    result = RenderVerifier().execute(
        {
            "input_path": str(output),
            "output_dir": str(tmp_path / "review"),
            "expected": {
                "duration_seconds": max(c["out_seconds"] for c in cuts),
                "width": 1920, "height": 1080, "fps": 30, "video_codec": "h264",
                "require_audio": False,
            },
            "timestamps": [(c["in_seconds"] + c["out_seconds"]) / 2 for c in cuts],
            "render_runtime_used": "remotion",
            "render_runtime_locked": "remotion",
        }
    )
    assert result.success, result.data.get("issues")
    assert result.data["status"] == "pass", result.data["issues"]
    jsonschema.validate(result.data["final_review"], json.loads(
        (REPO / "schemas" / "artifacts" / "final_review.schema.json").read_text()))
