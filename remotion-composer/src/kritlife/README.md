# kritlife · SIGNAL × Vox — Remotion kit

The KRITLIFE TECH "SIGNAL" design system with a Vox-explainer material layer
(paper collage, highlighter swipe, cork evidence board with red thread, cut-out
host). One token set renders 1080×1920 and 1920×1080. Sizes are authored at a
1080px short edge and multiplied by `s = min(w,h)/1080` (`useScale()`).

Visual spec (canvas): https://claude.ai/artifact/NmHj1Q9SymHs6YctDQEe5M
Style playbook: `styles/kritlife-vox.yaml`

## Preview

```bash
npx remotion studio            # pick KritlifeShowcaseVertical / KritlifeShowcaseLandscape
npx remotion still src/index.tsx KritlifeShowcaseLandscape out/k.png --frame=480
```

## Files

| File | What |
|---|---|
| `tokens.ts` | `K` palette, `FONT`, type scale `T`, `EASE`, `useScale()`, `ez()` progress helper |
| `fonts.ts` | `loadKritlifeFonts()`: bundled Archivo Black, IBM Plex Sans Thai 400–700, IBM Plex Mono 400/500, Instrument Serif Italic (SIL OFL 1.1) |
| `assets.ts` | `TEX` (grain, paper, cork), `HOST` (3 matted poses), `FOOTAGE` (Openverse CC, see `assets/footage/CREDITS.md`) |
| `components/` | see below |
| `KritlifeShowcase.tsx` | an 8-scene walkthrough of every component |

## Components

| Component | Use |
|---|---|
| `Backdrop` | ink / paper / cork ground with drifting grid, grain and vignette. The texture stack is mandatory on dark frames. |
| `Chrome` | ■ KRITLIFE TECH, the chapter label, a progress rule with ticks and the footer |
| `Kicker`, `Chip`, `Source` | mono label with a growing rule · square chip · provenance line |
| `Rise` / `Focus` | Rise = new, spoken words (mask-rise) · Focus = found words (blur to sharp) |
| `Highlighter` | an orange swipe behind one phrase. The text flips to ink. |
| `RichText`, `parseMark` | `[accent]` `{dim}` `~strike~` inline markup |
| `PaperCard`, `Pin` | textured paper (optionally `torn`) and a physical pin that lands with weight |
| `EvidenceBoard` | cork, pinned cards and photos, red thread drawn pin to pin, an `OPEN` stamp |
| `HostCutout` | a matted host with a paper outline and hand-held breath |
| `Plate` | graded B-roll with a slow push-in and gradient protection |
| `Caption` | word-paced fill. Unspoken text sits at 34%. `[keyword]` is orange. Stays above the 380px keep-out on 9:16. |
| `ChapterWipe` | full-bleed orange panel. It is the only place orange is a background. |
| `Compare`, `DataMeter` | A/B with a slam divider · meters that grow. `source` is required. |

## Rules (from SIGNAL)

- Ink `#121212`, paper `#EEEAE1`, one accent `#FF5B1F`. `#B3261E` is only for thread, pins and stamps.
- Zero radius. Pins are the only circles.
- No dissolves: use cuts, camera moves, or the orange wipe.
- Every scene is a pure function of the frame: no state, no CSS transitions, only `random(seed)`.
- Thai carries the voice. English appears only in mono chrome and the tagline. No emoji, no icon sets.
