/**
 * kritlife · SIGNAL × Vox — design tokens for Remotion.
 *
 * Source of truth: the KRITLIFE "SIGNAL" system (colors_and_type.css).
 * Two tones (ink / paper), one accent (signal orange), red thread only for
 * the evidence metaphor. Every size is authored at a 1080px short edge and
 * multiplied by `s = min(width, height) / 1080` (see useScale).
 */
import { Easing, interpolate, useVideoConfig } from "remotion";

export const K = {
  ink: "#121212",
  ink900: "#0B0A09",
  ink800: "#0F0E0D",
  ink650: "#1C1B19",
  ink600: "#262420",
  paper: "#EEEAE1",
  paper150: "#E9E3D6",
  paper200: "#E2DCCF",
  paper300: "#D2C8B2",
  signal: "#FF5B1F",
  signalDeep: "#D9440E", // orange on paper, where it needs weight
  thread: "#B3261E", // string, pins, stamps — evidence only
  // Greys are never grey: alpha ramps of paper / ink.
  paperA: (a: number) => `rgba(238,234,225,${a})`,
  inkA: (a: number) => `rgba(18,18,18,${a})`,
  plateA: (a: number) => `rgba(12,11,10,${a})`,
} as const;

export const FONT = {
  display: "'Archivo Black', 'IBM Plex Sans Thai', sans-serif", // Latin display + numerals only
  body: "'IBM Plex Sans Thai', sans-serif", // all Thai voice
  mono: "'IBM Plex Mono', monospace", // all chrome, uppercase, wide-tracked
  editorial: "'Instrument Serif', Georgia, serif", // Latin margin notes only
} as const;

/** Type scale in px at a 1080 short edge. Multiply by `s`. */
export const T = {
  mega: 380,
  display: 130,
  h1: 104,
  h2: 78,
  h3: 64,
  caption: 38,
  body: 32,
  chip: 20,
  kicker: 21,
  source: 14,
} as const;

export const TRACK = { head: "-0.02em", display: "-0.01em", kicker: "0.26em", label: "0.22em", source: "0.14em" } as const;
export const LH = { tight: 1.24, snug: 1.36, body: 1.48 } as const;

export const SHADOW = {
  paper: "0 18px 30px rgba(0,0,0,.45), 0 2px 4px rgba(0,0,0,.35)",
  plate: "0 50px 90px rgba(0,0,0,.65), 0 8px 18px rgba(0,0,0,.5)",
  pin: "5px 9px 10px rgba(0,0,0,.5)",
} as const;

/** Torn paper edge: jagged top and bottom, ±3%. */
export const TORN_CLIP =
  "polygon(0 3%,6% 0,13% 2.5%,21% .5%,30% 3%,38% 1%,47% 2.8%,55% .3%,64% 2.6%,72% .8%,81% 3%,89% .6%,96% 2.4%,100% 1%,100% 97%,94% 100%,86% 97.6%,78% 99.4%,69% 97%,61% 99.6%,52% 97.4%,44% 99.2%,35% 97%,27% 99.5%,18% 97.3%,10% 99.4%,3% 97.5%,0 99%)";

/** Photo grade: always warm-dark, never neutral or cool. */
export const PHOTO_GRADE = "grayscale(.3) contrast(1.16) brightness(.86)";

export const EASE = {
  /** Default: content arrives fast and settles. */
  outExpo: Easing.out(Easing.exp),
  /** Camera moves and wipes. */
  inOutCubic: Easing.inOut(Easing.cubic),
  /** Rack focus, highlighter swipe. */
  outCubic: Easing.out(Easing.cubic),
  /** Only chips and pins landing with physical weight. */
  outBack: Easing.out(Easing.back(2)),
} as const;

/** Responsive scale: one token set for 9:16 and 16:9. */
export const useScale = () => {
  const { width, height, fps } = useVideoConfig();
  const s = Math.min(width, height) / 1080;
  const vertical = height > width;
  const pad = (vertical ? 76 : 100) * s;
  /** Bottom keep-out for platform UI on 9:16 (380px at 1080). */
  const safeBottom = vertical ? 380 * s : 0;
  return { s, width, height, fps, vertical, pad, safeBottom };
};

/**
 * Progress 0→1 starting `at` seconds, over `d` seconds (default 0.6, out-expo).
 * Pure function of the frame: no state, no timers.
 */
export const ez = (frame: number, fps: number, at: number, d = 0.6, easing = EASE.outExpo) =>
  interpolate(frame, [at * fps, (at + d) * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
