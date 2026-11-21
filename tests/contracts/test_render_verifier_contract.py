"""Contracts for the post-render verification gate.

1. The render_report example the compose director teaches must validate against
   render_report.schema.json. An agent copies that example, and an invalid one
   only fails later at checkpoint time.
2. render_verifier is discovered by the registry with a complete tool contract.
3. The compose director routes the post-render gate through render_verifier.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from schemas.artifacts import validate_artifact
from tools.tool_registry import registry

REPO = Path(__file__).resolve().parents[2]
DIRECTOR = REPO / "skills" / "pipelines" / "explainer" / "compose-director.md"


def _section(text: str, heading: str) -> str:
    start = text.index(heading)
    nxt = text.find("\n### ", start + len(heading))
    return text[start : nxt if nxt != -1 else len(text)]


def test_director_render_report_example_is_schema_valid() -> None:
    section = _section(DIRECTOR.read_text(encoding="utf-8"), "### Step 7: Build Render Report")
    blocks = re.findall(r"```json\n(.*?)```", section, flags=re.S)
    assert blocks, "Step 7 must show a render_report example"
    for block in blocks:
        validate_artifact("render_report", json.loads(block))


def test_director_uses_render_verifier_as_post_render_gate() -> None:
    section = _section(DIRECTOR.read_text(encoding="utf-8"), "### Step 6: Post-Render Self-Review")
    assert "render_verifier" in section and "RenderVerifier" in section
    assert "pending_agent_checks" in section, "agent judgement must stay explicit"


def test_render_verifier_is_registered_with_full_contract() -> None:
    registry.discover()
    tool = registry.get("render_verifier")
    assert tool is not None
    info = tool.get_info()
    for field in ("name", "version", "capability", "provider", "dependencies", "input_schema", "agent_skills"):
        assert info.get(field), field
    assert info["capability"] == "analysis"
    assert set(tool.input_schema["required"]) == {"input_path", "output_dir"}
    assert tool.estimate_cost({}) == 0.0
    assert "render_verifier" in registry.support_envelope()
