"""Licence gate + credit lines for CC stock used by the Vox explainer kit."""
from __future__ import annotations

from tools.video.stock_sources import SearchFilters, all_sources
from tools.video.stock_sources.attribution import (
    credit_line,
    is_reusable,
    manifest_fields,
    needs_credit,
)
from tools.video.stock_sources.openverse import _result_to_candidate

# Shape of an Openverse record as returned by the REST API and the openverse MCP tools.
MCP_RECORD = {
    "id": "1dfa0815-1aa4-4b98-b87f-2b9d603432d8",
    "title": "Tube electricity supply vintage map",
    "foreign_landing_url": "https://www.flickr.com/photos/55231259@N00/6786390574",
    "url": "https://live.staticflickr.com/7066/6786390574_bc44685ba6_b.jpg",
    "creator": "futureshape",
    "license": "by",
    "license_version": "2.0",
    "license_url": "https://creativecommons.org/licenses/by/2.0/",
    "provider": "flickr",
    "source": "flickr",
    "width": 1024,
    "height": 683,
    "attribution": '"Tube electricity supply vintage map" by futureshape is licensed under CC BY 2.0.',
}


def test_attribution_module_is_not_a_stock_source():
    assert "attribution" not in {s.name for s in all_sources()}


def test_credit_line_from_mcp_record():
    line = credit_line(MCP_RECORD)
    assert line == "“Tube electricity supply vintage map” by futureshape · CC BY 2.0 · flickr"


def test_credit_line_matches_between_mcp_record_and_candidate():
    cand = _result_to_candidate(MCP_RECORD, SearchFilters(kind="image"))
    assert cand is not None
    assert credit_line(cand) == credit_line(MCP_RECORD)


def test_credit_line_truncates_long_titles_and_handles_missing_creator():
    line = credit_line({"title": "x" * 200, "license": "cc0", "license_version": "1.0"})
    assert line.startswith("“" + "x" * 59 + "…”")
    assert "by" not in line
    assert "CC0 1.0" in line


def test_licence_gate():
    ok = [("cc0", "1.0"), ("by", "4.0"), ("by-sa", "2.0"), ("pdm", "")]
    bad = [("by-nc", "4.0"), ("by-nd", "4.0"), ("by-nc-sa", "2.0"), ("by-nc-nd", "3.0")]
    for code, ver in ok:
        assert is_reusable({"license": code, "license_version": ver}), code
    for code, ver in bad:
        assert not is_reusable({"license": code, "license_version": ver}), code
    assert not is_reusable({})


def test_needs_credit():
    assert needs_credit({"license": "by", "license_version": "2.0"})
    assert needs_credit({"license": "by-sa", "license_version": "2.0"})
    assert not needs_credit({"license": "cc0", "license_version": "1.0"})


def test_manifest_fields_from_both_paths_agree():
    cand = _result_to_candidate(MCP_RECORD, SearchFilters(kind="image"))
    a, b = manifest_fields(MCP_RECORD), manifest_fields(cand)
    for key in ("source", "source_url", "creator", "license", "license_url", "attribution", "credit", "license_ok"):
        assert a[key] == b[key], key
    assert a["license_ok"] is True
