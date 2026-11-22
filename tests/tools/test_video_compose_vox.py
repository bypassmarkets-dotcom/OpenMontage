"""Vox explainer kit wiring in video_compose (no actual render)."""
from __future__ import annotations

import json
from pathlib import Path

from tools.video.video_compose import VideoCompose

DEMO = Path(__file__).resolve().parents[2] / "remotion-composer" / "public" / "demo-props" / "vox-explainer.json"


def _ed(vox: dict | None = None) -> dict:
    return {
        "version": "1.0",
        "cuts": [],
        "render_runtime": "remotion",
        "renderer_family": "vox",
        "composition_mode": "templated",
        "vox": vox if vox is not None else json.loads(DEMO.read_text(encoding="utf-8")),
    }


def test_vox_family_maps_to_vox_composition():
    assert VideoCompose._get_composition_id("vox") == "VoxExplainer"


def test_vox_composition_follows_profile_and_explicit_aspect():
    assert VideoCompose._vox_composition_id(None) == "VoxExplainer"
    assert VideoCompose._vox_composition_id("tiktok") == "VoxExplainerVertical"
    assert VideoCompose._vox_composition_id("youtube_landscape") == "VoxExplainer"
    assert VideoCompose._vox_composition_id("tiktok", {"aspect": "16:9"}) == "VoxExplainer"
    assert VideoCompose._vox_composition_id(None, {"aspect": "9:16"}) == "VoxExplainerVertical"


def test_demo_props_pass_through_unchanged():
    props, errors = VideoCompose._build_vox_props(_ed())
    assert errors == []
    demo = json.loads(DEMO.read_text(encoding="utf-8"))
    assert props["scenes"] == demo["scenes"]
    assert props["cues"] == demo["cues"]
    assert props["theme"] == "neutral"
    assert props["brand"] == demo["brand"]
    assert "aspect" not in props and "public_dir" not in props  # compose-only keys stay out of props


def test_vox_validation_reports_every_problem():
    props, errors = VideoCompose._build_vox_props(
        _ed({
            "theme": "hotpink",
            "duration": 10,
            "scenes": [
                {"start": 0, "type": "photo"},
                {"start": 4, "type": "chart-pie"},
                {"start": 2, "type": "wipe"},
                {"start": 12, "type": "big"},
            ],
        })
    )
    assert props is None
    text = "\n".join(errors)
    assert "needs an img" in text
    assert "needs data" in text
    assert "'wipe' is not a Vox scene type" in text
    assert "timeline order" in text
    assert "at/after vox.duration" in text
    assert "'hotpink' is not a preset" in text


def test_vox_requires_payload():
    ed = _ed()
    ed.pop("vox")
    props, errors = VideoCompose._build_vox_props(ed)
    assert props is None and "requires an edit_decisions.vox" in errors[0]


def test_theme_object_is_allowed():
    vox = json.loads(DEMO.read_text(encoding="utf-8"))
    vox["theme"] = {"preset": "midnight", "accent": "#FF5A1F"}
    props, errors = VideoCompose._build_vox_props(_ed(vox))
    assert errors == [] and props["theme"]["accent"] == "#FF5A1F"


def test_execute_routes_vox_and_surfaces_validation_errors(tmp_path):
    res = VideoCompose().execute({
        "operation": "render",
        "edit_decisions": _ed({"duration": 5, "scenes": []}),
        "output_path": str(tmp_path / "out.mp4"),
    })
    assert not res.success
    assert "Invalid Vox edit_decisions" in (res.error or "")
