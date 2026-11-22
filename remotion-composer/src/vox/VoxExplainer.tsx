// VoxExplainer — data-driven Vox-style documentary explainer.
// Narration is the locked master: audio at frame 0, every scene/cue timed in seconds from the transcript.
import React from "react";
import { AbsoluteFill, Audio, Sequence, useVideoConfig, type CalculateMetadataFunction } from "remotion";
import { BrandUntil, Chapter, Design, Grain, GridBg, SceneWrap, Subtitle } from "./chrome";
import { Big, End, Network, Photo, Redact, Split, Title } from "./scenes";
import { ChartLine, ChartPie, List, Parallax, Typewriter } from "./scenesRve";
import { resolveTheme, useAsset, VoxProvider, type VoxProps, type VoxScene } from "./theme";

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
    default:
      return <Title s={s} />;
  }
};

const Track: React.FC<{ audio?: string }> = ({ audio }) => {
  const asset = useAsset();
  return audio ? <Audio src={asset(audio)} /> : null;
};

export const VoxExplainer: React.FC<VoxProps> = ({ theme, scenes, cues = [], duration, audio, assetBase = "", brand, labels, subtitles = true }) => {
  const { fps } = useVideoConfig();
  const T = resolveTheme(theme);
  const sorted = [...scenes].sort((a, b) => a.start - b.start);
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
                <SceneWrap dur={dur}>
                  {!FULL_BLEED.has(s.type) && <GridBg />}
                  {renderScene(s, dur)}
                  <Chapter label={s.chapter} />
                </SceneWrap>
              </Sequence>
            );
          })}
          {sorted.length > 0 && <BrandUntil t={sorted[sorted.length - 1].type === "end" ? sorted[sorted.length - 1].start : duration} />}
          {subtitles && <Subtitle cues={cues} />}
          <Grain />
        </Design>
      </AbsoluteFill>
    </VoxProvider>
  );
};

export const calculateVoxMetadata: CalculateMetadataFunction<VoxProps> = async ({ props }) => ({
  durationInFrames: Math.max(1, Math.round((props.duration || 1) * VOX_FPS)),
  fps: VOX_FPS,
});
