"""Licence gate + attribution helpers for CC-licensed stock (Openverse first).

Used by the Vox explainer workflow (`.agents/skills/vox-explainer/SKILL.md`) and
any stage that drops stock stills into an edit. It accepts either a normalised
`Candidate` (from the Python stock adapters) or a raw Openverse record (as
returned by the Openverse REST API *or* the `openverse` MCP server's
`openverse_search_images` / `openverse_get_image` tools), so the agent path and
the Python fallback write identical asset-manifest entries.

Not a source adapter: it defines no adapter class, so stock-source
autodiscovery ignores it.
"""
from __future__ import annotations

import re
from typing import Any, Mapping, Union

from .base import Candidate

Record = Union[Candidate, Mapping[str, Any]]

# Licences an edited, possibly monetised video can use. NC forbids commercial
# use; ND forbids derivatives (cropping, grading, overlays all count).
_BLOCKED = re.compile(r"\b(?:BY-)?(?:NC|ND)\b|-NC|-ND|NONCOMMERCIAL|NODERIV", re.I)
_NEEDS_CREDIT = re.compile(r"\bBY\b", re.I)


def license_label(record: Record) -> str:
    """Human-readable licence, e.g. ``CC BY-SA 2.0`` / ``CC0 1.0`` / ``Public Domain Mark``."""
    if isinstance(record, Candidate):
        return record.license or ""
    from .openverse import _license_label  # same mapping as the adapter

    return _license_label(dict(record))


def is_reusable(record: Record) -> bool:
    """True when the licence allows commercial use *and* modification."""
    label = license_label(record)
    if not label or label == "unknown":
        return False
    return not _BLOCKED.search(label.upper())


def needs_credit(record: Record) -> bool:
    """CC BY / BY-SA require attribution; CC0 and PDM do not (credit anyway when cheap)."""
    return bool(_NEEDS_CREDIT.search(license_label(record).upper()))


def _field(record: Record, *names: str) -> str:
    for n in names:
        if isinstance(record, Candidate):
            val = getattr(record, n, None) or record.extra.get(n)
        else:
            val = record.get(n)
        if val:
            return str(val).strip()
    return ""


def _title(record: Record) -> str:
    if isinstance(record, Candidate):
        return str(record.extra.get("title") or "").strip()
    return str(record.get("title") or "").strip()


def credit_line(record: Record, *, max_title: int = 60) -> str:
    """Short on-screen credit: ``"<title>" by <creator> · <LICENCE> · <provider>``.

    Kept to one line so it fits the Vox `CreditTag`. The full attribution
    sentence (Openverse's `attribution` field) belongs in the description /
    asset manifest — see `manifest_fields`.
    """
    title = _title(record)
    if len(title) > max_title:
        title = title[: max_title - 1].rstrip() + "…"
    creator = _field(record, "creator")
    lic = license_label(record)
    provider = _field(record, "provider", "source")
    if isinstance(record, Candidate):
        provider = str(record.extra.get("provider") or "").strip()
    head = f"“{title}”" if title else "Photo"
    parts = [f"{head} by {creator}" if creator else head]
    if lic:
        parts.append(lic)
    if provider:
        parts.append(provider)
    return " · ".join(parts)


def manifest_fields(record: Record) -> dict[str, Any]:
    """Provenance fields to merge into an `asset_manifest` asset entry."""
    if isinstance(record, Candidate):
        return {
            "source": record.source,
            "source_id": record.source_id,
            "source_url": record.source_url,
            "creator": record.creator,
            "license": record.license,
            "license_url": record.extra.get("license_url", ""),
            "attribution": record.extra.get("attribution", ""),
            "credit": credit_line(record),
            "license_ok": is_reusable(record),
        }
    return {
        "source": "openverse",
        "source_id": str(record.get("id") or ""),
        "source_url": str(record.get("foreign_landing_url") or ""),
        "creator": str(record.get("creator") or ""),
        "license": license_label(record),
        "license_url": str(record.get("license_url") or ""),
        "attribution": str(record.get("attribution") or ""),
        "credit": credit_line(record),
        "license_ok": is_reusable(record),
    }
