---
name: vox-explainer
description: Build a reusable Vox-style documentary explainer with the Remotion Vox kit (remotion-composer/src/vox, renderer_family "vox"). Covers narration-locked timing, sourcing CC imagery through the Openverse MCP (with the Python adapter as fallback), and porting React Video Editor templates (reactvideoeditor MCP) into new Vox scene types.
license: MIT
---

# Vox explainer kit

**Decision this skill answers:** the user wants an editorial "explainer-documentary" video (one question, evidence, one memorable visual, a takeaway), in the genre Vox made popular. How do I build it *reproducibly* without hand-writing a new composition every time?

**Answer:** fill `edit_decisions.vox` with timed scene data and render the `VoxExplainer` composition through `video_compose` (`renderer_family: "vox"`). The look comes from a theme preset; the evidence comes from real CC-licensed imagery (Openverse) and real data.

Read alongside: `styles/vox-documentary.yaml` (rules + taste gates), `remotion-composer/SCENE_TYPES.md` § Vox (prop reference), `skills/creative/stock-sourcing-usage.md`.

## Be honest about the mode (templated, not atelier)

The kit is a **templated** path (`composition_mode: "templated"`). That makes it fast, consistent and right for series work, a channel's house style, localisation, or whenever the user asks for "Vox style". It is **not** atelier. Per AGENT_GUIDE, one-off hero/brand pieces default to atelier. Say this at proposal and let the user choose. Don't pass the kit off as bespoke. Still follow the AGENT_GUIDE rule and present both runtimes. The kit is Remotion-only, so if HyperFrames is chosen, the kit doesn't apply.

## 1. Lock the timeline first (audio-first rule)

1. Narration is the immutable master. Get verified word/phrase timestamps from the `transcriber` tool (or the user's SRT). Never re-time the narration to fit visuals.
2. `vox.duration` = narration length in seconds.
3. One scene per **idea change**, not per sentence. `start` = the second the idea begins.
4. Item, side and data-point reveals go in `at: [...]` (absolute seconds, one per item) so they land on the spoken word.
5. `cues` = subtitle phrases `{s, e, t, hi?}`. `hi` must be a substring of `t`; it is coloured with the accent.

## 2. Imagery: Openverse (MCP first, Python fallback)

Only `photo`, `parallax` and `redact` scenes use images. Documentary evidence should be **real** imagery, not generated. Use generated images only for clearly labelled illustration.

**Agent path (preferred when the `openverse` MCP server is connected):**

1. `mcp__openverse__openverse_search_images` with `{query, license_type: "commercial,modification", size: "large", page_size: 20}`. Optionally add `license: "cc0,pdm,by,by-sa"`, or `source: "wikimedia" | "met" | "flickr"` for archival or museum material.
   Keep queries to 2–3 words. Openverse matches all terms, so `"city heat asphalt street summer"` + `size: large` returns nothing while `"city street heat"` returns 240 hits. Add `size: "large"` only after a query already has results.
2. Shortlist by relevance, `width >= 1600` for 16:9 full-bleed (`>= 1080` for 9:16), and no watermarks or visible logos. Check `unstable__sensitivity` is empty.
3. `mcp__openverse__openverse_get_image {id}` on the picks to confirm the licence and get the `attribution` sentence.
4. Download the `url` into `projects/<project-id>/assets/images/<slug>.jpg`. Use a browser-like `User-Agent` (Flickr's CDN rejects "bot" agents). If a download fails, try the next candidate rather than the thumbnail.
5. Run the record through `tools.video.stock_sources.attribution`:
   ```python
   from tools.video.stock_sources.attribution import is_reusable, credit_line, manifest_fields
   assert is_reusable(record)                 # rejects NC / ND / unknown
   scene["credit"] = credit_line(record)      # one-line on-screen credit
   asset.update(manifest_fields(record))      # provenance into asset_manifest
   ```
   `credit` is **required** for CC BY / BY-SA. `video_compose` flags image scenes without one in `final_review.issues_found`. Also list the full `attribution` sentences in the video description.

**Fallback (MCP not connected, or batch sourcing):** use the Python adapter `tools/video/stock_sources/openverse.py` (`get_source("openverse").search(query, SearchFilters(kind="image", orientation="landscape", min_width=1600))`, then `.download(candidate, path)`). It defaults to `commercial,modification` and the same `attribution` helpers accept its `Candidate`s, so the manifest is identical. Anonymous limits are 20 req/min and 200/day. Set `OPENVERSE_CLIENT_ID` and `OPENVERSE_CLIENT_SECRET` to raise them.

**Audio (optional):** `mcp__openverse__search_audio` with the same licence rules gives ambient beds and paper/pen foley. Prefer the user's music library or `music_search` tools first (AGENT_GUIDE music order).

Serve images to Remotion one of two ways. Either copy them under `remotion-composer/public/<assetBase>/` and set `vox.assetBase`, or set `vox.public_dir` to the project's assets folder and use paths relative to it. `img` may also be an https URL, but local copies render deterministically.

## 3. Extra mechanics from React Video Editor (reactvideoeditor MCP)

The kit's 12 scene types cover most explainers. When a beat genuinely needs another mechanic (a gauge, a bar race, a heatmap):

1. `mcp__reactvideoeditor__list_categories`, then `mcp__reactvideoeditor__search_templates {query | category}`.
2. **Free tier only** (`tier: "free"`). Pro templates are not licensed for vendoring. Show the user the template `page` link.
3. `mcp__reactvideoeditor__get_template {slug}` gives `sourceCode`. Treat it as a **mechanics reference, not drop-in code**. Port it into `remotion-composer/src/vox/scenesRve.tsx`:
   - Make it frame-driven: no CSS `@keyframes`/`animation`/`transition`, no `<style jsx>`, no `next/image`, no `"use client"`, no `Math.random()`. Use `useCurrentFrame`, `interpolate`, `spring`, and seeded math. (Several catalog templates, e.g. ken-burns and parallax-pan, use CSS keyframes and **will not render correctly** in Remotion as shipped.)
   - Take data from `VoxScene` props (`data`, `items`, `text`, `at`) and time reveals with `useBeat()` so they hit narration beats.
   - Style only through `useT()`: one accent, `accentInk` for accent-coloured text, `line` hairlines, `serif` display, `sans` labels. No template colour arrays.
   - Add a header line `<scene> <- https://www.reactvideoeditor.com/remotion-templates/<slug>` (the free templates ask for credit).
4. Register the type in `VoxSceneType` (`src/vox/theme.tsx`), the `renderScene` switch (`src/vox/VoxExplainer.tsx`), `VideoCompose.VOX_SCENE_TYPES`, the `vox` scene enum in `schemas/artifacts/edit_decisions.schema.json`, and `SCENE_TYPES.md` § Vox.
5. Verify with `npx tsc --noEmit` and a still in both aspects (see §5).

Already ported: `chart-line` (line-chart), `chart-pie` (pie-chart), `list` (animated-list), `parallax` (parallax-pan), `typewriter` (typewriter-subtitle).

## 4. Build edit_decisions

```json
{
  "version": "1.0",
  "cuts": [],
  "render_runtime": "remotion",
  "renderer_family": "vox",
  "composition_mode": "templated",
  "vox": {
    "theme": "neutral",
    "duration": 94.2,
    "brand": { "name": "MY ", "hi": "CHANNEL" },
    "labels": { "illustration": "Illustration" },
    "assetBase": "vox/my-project",
    "audio": "narration.mp3",
    "scenes": [
      { "start": 0,    "type": "big",   "kicker": "THE QUESTION", "head": "Why is rent ", "hi": "so high", "tail": "?" },
      { "start": 6.4,  "type": "photo", "img": "skyline.jpg", "focus": [60, 40], "kicker": "THE CITY", "head": "Demand kept ", "hi": "growing",
        "credit": "“Skyline at dusk” by J. Doe · CC BY 2.0 · flickr" },
      { "start": 14.1, "type": "chart-line", "kicker": "SOURCE: CENSUS 2024", "head": "Median rent ", "hi": "doubled",
        "unit": "$", "data": [{ "label": "2004", "value": 800 }, { "label": "2024", "value": 1650 }], "at": [15.0, 17.2] },
      { "start": 22.0, "type": "split", "left": { "label": "Not", "text": "Greedy landlords alone" }, "right": { "label": "But", "text": "Too few homes built" }, "at": [22.3, 25.0] },
      { "start": 88.0, "type": "end", "items": ["Ask", "Check", "Explain"] }
    ],
    "cues": [{ "s": 0.2, "e": 3.1, "t": "Why is rent so high?", "hi": "so high" }]
  }
}
```

Themes: `"neutral"` (paper and amber), `"kritlife"` (charcoal and red, Thai), `"midnight"` (navy and teal), or `{ "preset": "midnight", "accent": "#FF5A1F", "accentInk": "#FF5A1F" }`. 9:16 output comes from a vertical `profile` (e.g. `tiktok`) or `vox.aspect: "9:16"`. The same scene data works for both aspects.

## 5. Render + review

```python
from tools.video.video_compose import VideoCompose
res = VideoCompose().execute({"operation": "render", "edit_decisions": ed,
                              "output_path": "projects/<id>/renders/vox.mp4", "profile": "youtube_landscape"})
```

Before a full render, check stills at each scene's midpoint in both aspects:
`cd remotion-composer && npx remotion still src/index.tsx VoxExplainer out.png --frame=<f> --props=<props.json>` (use `VoxExplainerVertical` for 9:16).

Review checklist: subtitle never covers a chart or legend; every highlighted phrase is spoken in that scene; every chart is sourced or labelled ILLUSTRATIVE; every CC BY/BY-SA image shows `credit`; no scene holds for less than 2.5 s; the accent is the only saturated colour on screen.

## Files

- Kit: `remotion-composer/src/vox/` (`theme.tsx` types/themes/hooks, `chrome.tsx`, `scenes.tsx`, `scenesRve.tsx`, `VoxExplainer.tsx`, `demo.ts`)
- Compositions: `VoxExplainer` and `VoxExplainerVertical` in `src/Root.tsx`. KRITLIFE preset: `src/kritlife/` (`KritVoxDoc169/916`)
- Compose: `tools/video/video_compose.py` (`_render_via_vox`, `_build_vox_props`, `_vox_composition_id`)
- Attribution: `tools/video/stock_sources/attribution.py`
- Playbooks: `styles/vox-documentary.yaml`, `styles/custom/vox-kritlife.yaml`
- Demo props: `remotion-composer/public/demo-props/vox-explainer.json`
