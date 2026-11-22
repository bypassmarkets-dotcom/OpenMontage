// Vox-style explainer kit — theme, types, and shared hooks.
// Everything visual is read from a VoxTheme via context, so one kit serves any brand.
import React, { createContext, useContext } from "react";
import { spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export type VoxTheme = {
  bg: string; // canvas
  bg2: string;
  panel: string; // card fill
  line: string; // hairlines, grid, borders
  text: string;
  dim: string; // secondary text
  accent: string; // the ONE accent colour
  accentSoft: string; // translucent accent (glows, soft panels)
  accentInk?: string; // accent used for TEXT (defaults to accent; darker on light themes for contrast)
  onAccent: string; // text drawn on top of solid accent
  paper: string; // redaction dossier sheet
  shade: string; // "r,g,b" used for photo/subtitle overlays (dark on dark themes, light on light)
  tagBg: string; // background of the small "illustration" tag
  serif: string; // display face (headlines)
  sans: string; // label/body face
  grainOpacity: number;
  grainBlend: "screen" | "multiply" | "overlay" | "normal";
  vignette: number; // 0..1 strength of the edge darkening
  gridOpacity: number;
};

export const VOX_KRITLIFE: VoxTheme = {
  bg: "#111214",
  bg2: "#1A1B1E",
  panel: "#202125",
  line: "#2E2F34",
  text: "#EDE8E1",
  dim: "#9A948C",
  accent: "#E0483A",
  accentSoft: "rgba(224,72,58,0.18)",
  onAccent: "#fff",
  paper: "#D9D2C5",
  shade: "10,10,12",
  tagBg: "rgba(0,0,0,0.55)",
  serif: "'Noto Serif Thai', serif",
  sans: "'Noto Sans Thai', sans-serif",
  grainOpacity: 0.07,
  grainBlend: "screen",
  vignette: 0.62,
  gridOpacity: 0.35,
};

// Neutral editorial explainer: warm paper field, ink text, one amber accent.
export const VOX_NEUTRAL: VoxTheme = {
  bg: "#F3EFE6",
  bg2: "#E9E3D6",
  panel: "#FBF8F2",
  line: "#D6CEBF",
  text: "#1C1B19",
  dim: "#6E675C",
  accent: "#F2B705",
  accentSoft: "rgba(242,183,5,0.20)",
  accentInk: "#9A6B00",
  onAccent: "#1C1B19",
  paper: "#FFFDF7",
  shade: "243,239,230",
  tagBg: "rgba(255,255,255,0.75)",
  serif: "'Noto Serif Thai', 'Georgia', serif",
  sans: "'Noto Sans Thai', 'Helvetica Neue', Arial, sans-serif",
  grainOpacity: 0.05,
  grainBlend: "multiply",
  vignette: 0.08,
  gridOpacity: 0.5,
};

// Dark navy variant for tech / policy explainers.
export const VOX_MIDNIGHT: VoxTheme = {
  ...VOX_KRITLIFE,
  bg: "#0E1420",
  bg2: "#141C2B",
  panel: "#1A2334",
  line: "#2A3550",
  text: "#E8ECF3",
  dim: "#8C96AA",
  accent: "#3DD6C6",
  accentSoft: "rgba(61,214,198,0.16)",
  onAccent: "#0E1420",
  shade: "8,12,20",
};

export const VOX_THEMES: Record<string, VoxTheme> = {
  neutral: VOX_NEUTRAL,
  kritlife: VOX_KRITLIFE,
  midnight: VOX_MIDNIGHT,
};

/** A preset name, a full theme, or `{ preset, ...overrides }`. */
export type VoxThemeInput = string | (Partial<VoxTheme> & { preset?: string });

export const resolveTheme = (t?: VoxThemeInput): VoxTheme => {
  if (!t) return VOX_NEUTRAL;
  if (typeof t === "string") return VOX_THEMES[t] ?? VOX_NEUTRAL;
  const { preset, ...rest } = t;
  return { ...(VOX_THEMES[preset ?? "neutral"] ?? VOX_NEUTRAL), ...rest };
};

// ---------- data model ----------
export type VoxSceneType =
  | "title"
  | "photo"
  | "redact"
  | "split"
  | "network"
  | "big"
  | "end"
  // ported from React Video Editor free templates (frame-driven rewrites)
  | "chart-line"
  | "chart-pie"
  | "list"
  | "parallax"
  | "typewriter";

export type VoxDatum = { label: string; value: number };

export type VoxScene = {
  start: number; // seconds on the narration master
  type: VoxSceneType;
  chapter?: string;
  kicker?: string;
  head?: string;
  hi?: string; // highlighted phrase (marker underline)
  tail?: string;
  sub?: string;
  size?: number;
  items?: string[];
  at?: number[]; // absolute seconds when each item / side / point should land
  img?: string; // file under assetBase, a public path, or an https URL
  img2?: string; // parallax foreground layer
  focus?: [number, number]; // object-position % for photo crops
  credit?: string; // CC attribution shown on screen (required for CC BY / BY-SA)
  left?: { label: string; text: string };
  right?: { label: string; text: string };
  hub?: string;
  data?: VoxDatum[]; // chart-line / chart-pie
  unit?: string; // chart value suffix, e.g. "%"
  text?: string; // typewriter body
  direction?: "left" | "right" | "up" | "down"; // parallax pan direction
};

export type VoxCue = { s: number; e: number; t: string; hi?: string };

export type VoxBrand = { name: string; hi?: string };

export type VoxLabels = {
  illustration?: string; // the tag on photo scenes; "" hides it
  file?: string; // default redact header
};

export type VoxProps = {
  theme?: VoxThemeInput;
  scenes: VoxScene[];
  cues?: VoxCue[];
  duration: number; // seconds
  audio?: string; // narration / mix file under assetBase, or URL
  assetBase?: string; // folder under public/ for relative img/audio
  brand?: VoxBrand;
  labels?: VoxLabels;
  subtitles?: boolean;
};

// ---------- context + hooks ----------
type Ctx = { theme: VoxTheme; assetBase: string; brand?: VoxBrand; labels: Required<VoxLabels> };
const VoxCtx = createContext<Ctx>({ theme: VOX_NEUTRAL, assetBase: "", labels: { illustration: "", file: "FILE" } });
export const VoxProvider: React.FC<{ value: Ctx; children: React.ReactNode }> = ({ value, children }) => (
  <VoxCtx.Provider value={value}>{children}</VoxCtx.Provider>
);
export const useVox = () => useContext(VoxCtx);
export const useT = () => {
  const t = useContext(VoxCtx).theme;
  return { ...t, accentInk: t.accentInk ?? t.accent };
};

export const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

export const useV = () => {
  const { width, height } = useVideoConfig();
  return height > width;
};

export const useSp = (delay = 0, cfg = { damping: 18, stiffness: 110, mass: 0.9 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: cfg });
};

/** frames from scene start to beat i (absolute seconds in `at`), or the fallback frame offset */
export const beat = (sc: VoxScene, i: number, fallback: number, fps: number) =>
  sc.at && sc.at[i] !== undefined ? Math.max(4, Math.round((sc.at[i] - sc.start) * fps)) : fallback;

export const useBeat = () => {
  const { fps } = useVideoConfig();
  return (sc: VoxScene, i: number, fallback: number) => beat(sc, i, fallback, fps);
};

export const useAsset = () => {
  const { assetBase } = useVox();
  return (p: string) => {
    if (/^(https?:|data:|blob:)/.test(p)) return p;
    const clean = p.replace(/^\/+/, "");
    return staticFile(assetBase ? `${assetBase.replace(/\/+$/, "")}/${clean}` : clean);
  };
};
