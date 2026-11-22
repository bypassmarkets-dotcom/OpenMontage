# Remotion Composer — Scene & Overlay Cheat Sheet

Authoritative list of `cut.type` and `overlay.type` values the `Explainer` composition accepts. Each row maps to a dispatch case in `src/Explainer.tsx`.

When you add a new component, append it here and in `src/components/index.ts`.

---

## Cut types (`cut.type`)

| `type` | Component | Required fields | Common fields | Purpose |
|---|---|---|---|---|
| *(none — video)* | `OffthreadVideo` | `source` (path to mp4) | `source_in_seconds`, `animation` (zoom-in, ken-burns), `in_seconds`, `out_seconds` | Play an MP4 clip directly |
| *(none — image)* | `Img` | `source` (path to png/jpg) | `animation`, `in_seconds`, `out_seconds` | Play a still with Ken Burns |
| `text_card` | `TextCard` | `text` | `fontSize`, `backgroundVideo`, `backgroundOverlay`, `color` | Large-typography beat |
| `hero_title` | `HeroTitle` | `text` | `heroSubtitle`, `backgroundVideo`, `backgroundOverlay` | Title/end card |
| `stat_card` | `StatCard` | `stat` | `subtitle`, `accentColor`, `backgroundVideo` | A single big number |
| `callout` | `CalloutBox` | `text` | `callout_type` (info/warning/tip/quote), `title`, `backgroundVideo`, `fontSize`, `titleFontSize` | Boxed message with bullets |
| `comparison` | `ComparisonCard` | `leftLabel`, `leftValue`, `rightLabel`, `rightValue` | `title`, `backgroundColor` | Side-by-side compare |
| `bar_chart` | `BarChart` | `chartData` | `chartAnimation`, `showValues`, `showGrid`, `backgroundVideo` | Animated bars |
| `line_chart` | `LineChart` | `chartSeries` | `chartAnimation`, `xLabel`, `yLabel`, `showMarkers` | Animated line |
| `pie_chart` | `PieChart` | `chartData` | `donut`, `centerLabel`, `centerValue`, `showLegend` | Pie / donut |
| `kpi_grid` | `KPIGrid` | `chartData` | `title`, `columns`, `chartAnimation` | 2–4 column KPI grid |
| `progress_bar` | `ProgressBar` | `progress` | `progressLabel`, `progressColor`, `progressSegments` | Animated progress |
| `anime_scene` | `AnimeScene` | `images` (list) | `particles`, `lightingFrom`, `lightingTo`, `vignette` | Still-image anime scene with particles + camera motion |
| **`terminal_scene`** | **`TerminalScene`** | **`steps`** (list of cmd/out/pause/pill) | **`terminalTitle`, `prompt`, `accentColor`** | **Synthetic terminal animation — NO real capture needed. See [`.agents/skills/synthetic-screen-recording/SKILL.md`](../.agents/skills/synthetic-screen-recording/SKILL.md)** |
| **`screenshot_scene`** | **`ScreenshotScene`** | **`backgroundImage`** (path in `public/`), **`screenshotSteps`** (list of overlays) | **`screenshotSize` (natural px w/h), `cursorStartAt`, `accentColor`** | **Approach-1 synthetic UI — drop any screenshot, animate scripted overlays on top (cursor, click_pulse, type_into, bubble_append, typing_dots, highlight_box, callout_balloon). Viewer-indistinguishable from a real recording for 15–30s focused demos. Coordinates are normalized (0–1) against the contain-fit rect. See [`.agents/skills/synthetic-ui-recording/SKILL.md`](../.agents/skills/synthetic-ui-recording/SKILL.md) (planned).** |

---

## Overlay types (`overlay.type`)

| `type` | Component | Required fields | Common fields | Purpose |
|---|---|---|---|---|
| `section_title` | `SectionTitle` | `text` | `accentColor`, `position` (top-left, etc.) | Tiny section label |
| `stat_reveal` | `StatReveal` | `text` | `subtitle`, `accentColor`, `position` | Corner stat badge |
| `hero_title` | `HeroTitle` (as overlay) | `text` | `subtitle` | Full-frame title overlay |
| **`provider_chip`** | **`ProviderChip`** | **`providers`** (list of strings) | **`cycleSeconds`, `position`, `accentColor`, `label`** | **Rotating badge that cycles through provider names — used in AI-generated-motion scenes to show which model produced the clip** |

---

## Vox explainer kit (`VoxExplainer` / `VoxExplainerVertical`)

A separate, data-driven composition (`src/vox/`), **not** an `Explainer` cut type. Render via `video_compose` with `renderer_family: "vox"` and `edit_decisions.vox`, or directly with `npx remotion render src/index.tsx VoxExplainer out.mp4 --props=public/demo-props/vox-explainer.json`. Workflow: `.agents/skills/vox-explainer/SKILL.md`.

Props: `theme` (`"neutral" | "kritlife" | "midnight" | "dossier" | "collage"` or `{preset?, ...VoxTheme}`), `duration` (s), `scenes[]`, `cues[]` (`{s,e,t,hi?}`), `audio?`, `assetBase?`, `brand? {name, hi?}`, `labels? {illustration?, file?}`, `subtitles?`.

**Stage layout (dossier / collage):** themes with `stage: true` render every scene through `src/vox/scenesStage.tsx`:
- The idea is big and centred in a content zone; text is auto-fitted to three type levels.
- The host is a cut-out head-and-shoulders bust (`host-<pose>-bust.png`, made by `projects/kritlife-vox-intro/make_busts.py`) of about ¼ of the frame in the bottom-right. It is persistent across cuts and pops when the pose changes. `hostLabel` adds a taped role label.
- Captions are a torn paper strip above the host.
- Split strikes through a "ไม่ใช่ / not" side with a pen, lists are ticked with a pen, and `end` takes a closing `stamp` (e.g. "CASE OPEN").

Other themes are unchanged.

**Mixing looks by chapter:** set `scene.theme` (preset name or theme object) per scene. Consecutive scenes with the same theme form a chapter; where the look changes, a torn-paper `ChapterWipe` (from `src/vox/paper.tsx`) sweeps over the cut. The wipe is an overlay of ±14 frames around the bound, so it never shifts timing. Brand, captions and grain follow the scene on screen. If no scene sets `theme`, the render is identical to before. Example: `projects/kritlife-vox-intro/build_v2.py` (dossier ↔ collage).

Every scene has `start` (seconds on the narration master) and `type`. Optional on all scenes: `chapter`, `kicker`, `head` / `hi` (marker-highlighted) / `tail`, `size`, and `at[]` (absolute seconds for staggered reveals).

| `type` | Uses | Notes |
|---|---|---|
| `title` | `sub`, `items` | Headline column, optional numbered item cards |
| `big` | `sub` | Centred statement |
| `photo` | `img`, `focus`, `items`, `credit` | Full-bleed slow push-in + gradient + "illustration" tag |
| `parallax` | `img`, `img2`, `direction`, `credit` | Two-layer pan (ported from RVE parallax-pan) |
| `redact` | `head`, `hi`, `kicker` | Paper dossier, lines black out, one phrase framed |
| `split` | `left`, `right` `{label,text}` | Contrast boxes (row in 16:9, stacked in 9:16) |
| `network` | `items`, `hub` | Hub and spokes, connectors draw on beats |
| `list` | `items` (prefix `~` = struck out) | Checklist (ported from RVE animated-list) |
| `chart-line` | `data[{label,value}]`, `unit` | Line draws, last value called out (RVE line-chart) |
| `chart-pie` | `data[{label,value}]`, `unit` | Donut, first slice = accent (RVE pie-chart) |
| `typewriter` | `text`, `sub` | Quote typed out with a block cursor (RVE typewriter-subtitle) |
| `end` | `items`, optional `head`/`hi` (defaults to brand) | Brand lock-up + sign-off lines |
| `board` | `cards[]` (`note`/`photo`/`stamp` at x,y,w,rot), `links`, `stamp`, `sub`, `host`, `hostSide`, `cards9` | Evidence board: headline on a torn note, pinned evidence, red strings; best with theme `dossier` |
| `case` | `kicker`, `head`, `hi`, `tail`, `cards[]` (positions automatic), `at[]`, `host` (a face photo, not a cut-out) | FBI-style case board with a virtual camera: the headline pops in close-up, then the camera pans to each card on its beat (pen circle + string), then pulls wide. Host face is a ~¼-frame aged photo in screen space; whole scene has an old-paper filter. Best with theme `dossier` |
| `collage` | `head` (giant), `tail`, `hi`, `sub`, `host`, `img`, `items` (icon row), `stamp` | Editorial collage poster with duotone cut-out; best with theme `collage` |

---

## Adding a new scene type

1. Create the React component in `src/components/MyScene.tsx`. Use `interpolate(frame, [inFrame, outFrame], [from, to])` and `spring(...)` for motion. Read `useCurrentFrame()` and `useVideoConfig()`.
2. Export it in `src/components/index.ts`.
3. Add the `type` to the `Cut` interface in `src/Explainer.tsx` (and any new prop fields).
4. Add a dispatch case in `SceneRenderer`:
   ```tsx
   if (cut.type === "my_scene" && cut.mySceneData) {
     return maybeWrapWithBg(<MyScene ... />);
   }
   ```
5. Document it in this file. That's what makes it discoverable to the next agent.

## Existing synthetic-UI components

Currently only `TerminalScene` exists. The pattern generalizes — likely candidates to add next, if a pipeline needs them:

- `ChatTranscript` — Claude/Cursor/GPT chat-bubble timeline with typing animation
- `EditorScene` — VS Code-style code editor with syntax highlight + cursor motion
- `PrReview` — GitHub PR diff view with inline-comment reveals
- `SlackThread` — Slack thread with avatars + reaction pops
- `TicketBoard` — Jira / Linear card moving across columns

Pattern: follow `TerminalScene.tsx` — a `steps` list of timeline primitives, cursor-advancing durations, spring-based reveals, optional non-blocking pills/badges.
