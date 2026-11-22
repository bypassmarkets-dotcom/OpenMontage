// VoxExplainer — data-driven Vox-style documentary explainer.
// Narration is the locked master: audio at frame 0, every scene/cue timed in seconds from the transcript.
import React from "react";
import { AbsoluteFill, Audio, Sequence, useCurrentFrame, useVideoConfig, type CalculateMetadataFunction } from "remotion";
import { BrandUntil, Chapter, Design, Grain, GridBg, SceneWrap, Subtitle } from "./chrome";
import { Big, End, Network, Photo, Redact, Split, Title } from "./scenes";
import { ChartLine, ChartPie, List, Parallax, Typewriter } from "./scenesRve";
import { Board, Collage } from "./scenesPaper";
import { ChapterWipe } from "./paper";
import { resolveTheme, useAsset, useVox, VoxProvider, type VoxProps, type VoxScene, type VoxTheme, type VoxThemeInput } from "./theme";

export const VOX_FPS = 30;

const FULL_BLEED = new Set(["photo", "parallax"]);

const renderScene = (s: VoxScene, dur: number) => {
  switch (s.type) {
    case "photo":
      return <Photo s={s} dur={dur} />;
    case "redact":
      return <Redact s={s} />;
    case "split":
      return <Split s={s} />;
    case "network":
      return <Network s={s} />;
    case "big":
      return <Big s={s} />;
    case "end":
      return <End s={s} />;
    case "chart-line":
      return <ChartLine s={s} />;
    case "chart-pie":
      return <ChartPie s={s} />;
    case "list":
      return <List s={s} />;
    case "parallax":
      return <Parallax s={s} dur={dur} />;
    case "typewriter":
      return <Typewriter s={s} dur={dur} />;
    case "board":
      return <Board s={s} dur={dur} />;
    case "collage":
      return <Collage s={s} dur={dur} />;
    default:
      return <Title s={s} />;
  }
};

const Track: React.FC<{ audio?: string }> = ({ audio }) => {
  const asset = useAsset();
  return audio ? <Audio src={asset(audio)} /> : null;
};

/** Re-provides the context with another theme (per-scene looks). */
const Themed: React.FC<{ theme: VoxTheme; children: React.ReactNode }> = ({ theme, children }) => {
  const ctx = useVox();
  return <VoxProvider value={{ ...ctx, theme }}>{children}</VoxProvider>;
};

/** Global chrome (brand, captions, grain) follows the look of the scene on screen at this frame. */
const ThemeAtFrame: React.FC<{ spans: { from: number; theme: VoxTheme }[]; children: React.ReactNode }> = ({ spans, children }) => {
  const f = useCurrentFrame();
  let cur = spans[0];
  for (const sp of spans) if (f >= sp.from) cur = sp;
  return <Themed theme={cur.theme}>{children}</Themed>;
};

const WIPE_HALF = 14;
const themeKey = (t?: VoxThemeInput) => (t === undefined ? "" : JSON.stringify(t));

export const VoxExplainer: React.FC<VoxProps> = ({ theme, scenes, cues = [], duration, audio, assetBase = "", brand, labels, subtitles = true }) => {
  const { fps } = useVideoConfig();
  const T = resolveTheme(theme);
  const sorted = [...scenes].sort((a, b) => a.start - b.start);
  // per-scene looks: only active when some scene sets `theme` (otherwise the render path is unchanged)
  const mixed = sorted.some((s) => s.theme !== undefined);
  const sceneTheme = (s: VoxScene) => (s.theme !== undefined ? resolveTheme(s.theme) : T);
  const spans: { from: number; key: string; theme: VoxTheme }[] = [];
  if (mixed) {
    for (const s of sorted) {
      const key = themeKey(s.theme ?? theme);
      if (!spans.length || spans[spans.length - 1].key !== key) spans.push({ from: Math.round(s.start * fps), key, theme: sceneTheme(s) });
    }
  }
  const brandEnd = sorted.length > 0 ? (sorted[sorted.length - 1].type === "end" ? sorted[sorted.length - 1].start : duration) : 0;
  const chrome = (
    <>
      {sorted.length > 0 && <BrandUntil t={brandEnd} />}
      {subtitles && <Subtitle cues={cues} />}
      <Grain />
    </>
  );
  return (
    <VoxProvider value={{ theme: T, assetBase, brand, labels: { illustration: labels?.illustration ?? "", file: labels?.file ?? (brand ? `FILE // ${`${brand.name}${brand.hi ?? ""}`.trim()}` : "FILE") } }}>
      <AbsoluteFill style={{ background: T.bg }}>
        <Track audio={audio} />
        <Design>
          <GridBg />
          {sorted.map((s, i) => {
            const from = Math.round(s.start * fps);
            const end = Math.round((sorted[i + 1]?.start ?? duration) * fps);
            const dur = end - from;
            if (dur <= 0) return null;
            return (
              <Sequence key={i} from={from} durationInFrames={dur}>
                {mixed ? (
                  <Themed theme={sceneTheme(s)}>
                    <SceneWrap dur={dur}>
                      {!FULL_BLEED.has(s.type) && <GridBg />}
                      {renderScene(s, dur)}
                      <Chapter label={s.chapter} />
                    </SceneWrap>
                  </Themed>
                ) : (
                  <SceneWrap dur={dur}>
                    {!FULL_BLEED.has(s.type) && <GridBg />}
                    {renderScene(s, dur)}
                    <Chapter label={s.chapter} />
                  </SceneWrap>
                )}
              </Sequence>
            );
          })}
          {mixed ? <ThemeAtFrame spans={spans}>{chrome}</ThemeAtFrame> : chrome}
          {spans.slice(1).map((sp, i) => (
            <Sequence key={`wipe-${i}`} from={sp.from - WIPE_HALF} durationInFrames={WIPE_HALF * 2 + 4} layout="none">
              <ChapterWipe color={sp.theme.bg} accent={sp.theme.accent} half={WIPE_HALF} seed={11 + i} />
            </Sequence>
          ))}
        </Design>
      </AbsoluteFill>
    </VoxProvider>
  );
};

export const calculateVoxMetadata: CalculateMetadataFunction<VoxProps> = async ({ props }) => ({
  durationInFrames: Math.max(1, Math.round((props.duration || 1) * VOX_FPS)),
  fps: VOX_FPS,
});
