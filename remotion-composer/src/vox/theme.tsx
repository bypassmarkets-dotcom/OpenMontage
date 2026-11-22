// Vox-style explainer kit — theme, types, and shared hooks.
// Everything visual is read from a VoxTheme via context, so one kit serves any brand.
import React, { createContext, useContext } from "react";
import { spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { paperFonts } from "./fonts";

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
  // ---- paper look (dossier / collage presets). All optional: unset = clean editorial look ----
  paperFonts?: boolean; // load Anton/Kanit display + Permanent Marker/Mali hand fonts (Google Fonts)
  display?: string; // condensed display face for headlines (overrides serif in Head/Big)
  hand?: string; // handwritten face (sub lines, notes, underlines)
  typeFace?: string; // typewriter face for note titles / stamps
  highlight?: "marker" | "torn"; // how `hi` is highlighted
  texture?: "grid" | "newsprint" | "paper"; // scene background
  backdrop?: string; // image (under assetBase) used by the newsprint texture
  photo?: "natural" | "bw" | "duotone"; // treatment for photo scenes and board/collage images
  duo?: [string, string]; // duotone [shadow, highlight]
  note?: string; // torn-paper note colour
  noteInk?: string; // text on notes
  uppercase?: boolean; // display headlines in caps
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

// Evidence board: dark newsprint, torn cream notes, red pins + string, B&W photos, stamps.
export const VOX_DOSSIER: VoxTheme = {
  bg: "#16130F",
  bg2: "#211C16",
  panel: "#241E17",
  line: "#3A3229",
  text: "#F1E9D8",
  dim: "#A89A84",
  accent: "#B3201E",
  accentSoft: "rgba(179,32,30,0.22)",
  accentInk: "#D8332F",
  onAccent: "#F6EEDD",
  paper: "#E6DCC6",
  shade: "18,15,11",
  tagBg: "rgba(22,19,15,0.7)",
  serif: "'Noto Serif Thai', serif",
  sans: "'Noto Sans Thai', sans-serif",
  grainOpacity: 0.1,
  grainBlend: "overlay",
  vignette: 0.7,
  gridOpacity: 0,
  paperFonts: true,
  highlight: "torn",
  texture: "newsprint",
  photo: "bw",
  note: "#E6DCC6",
  noteInk: "#1B1712",
  uppercase: true,
};

// Editorial collage poster: cream paper, black condensed type, gold torn strips, duotone cut-outs.
export const VOX_COLLAGE: VoxTheme = {
  bg: "#EDE3CF",
  bg2: "#E2D5BC",
  panel: "#F5EEDF",
  line: "#CDBFA3",
  text: "#14120F",
  dim: "#5E5444",
  accent: "#D9A21B",
  accentSoft: "rgba(217,162,27,0.22)",
  accentInk: "#8A6200",
  onAccent: "#14120F",
  paper: "#F5EEDF",
  shade: "237,227,207",
  tagBg: "rgba(245,238,223,0.85)",
  serif: "'Noto Serif Thai', serif",
  sans: "'Noto Sans Thai', sans-serif",
  grainOpacity: 0.06,
  grainBlend: "multiply",
  vignette: 0.06,
  gridOpacity: 0,
  paperFonts: true,
  highlight: "torn",
  texture: "paper",
  photo: "duotone",
  duo: ["#1A1712", "#D9A21B"],
  note: "#F5EEDF",
  noteInk: "#14120F",
  uppercase: true,
};

export const VOX_THEMES: Record<string, VoxTheme> = {
  neutral: VOX_NEUTRAL,
  kritlife: VOX_KRITLIFE,
  midnight: VOX_MIDNIGHT,
  dossier: VOX_DOSSIER,
  collage: VOX_COLLAGE,
};

/** A preset name, a full theme, or `{ preset, ...overrides }`. */
export type VoxThemeInput = string | (Partial<VoxTheme> & { preset?: string });

const withFonts = (t: VoxTheme): VoxTheme => {
  if (!t.paperFonts) return t;
  const f = paperFonts();
  return { ...t, display: t.display ?? f.display, hand: t.hand ?? f.hand, typeFace: t.typeFace ?? f.type };
};

export const resolveTheme = (t?: VoxThemeInput): VoxTheme => {
  if (!t) return VOX_NEUTRAL;
  if (typeof t === "string") return withFonts(VOX_THEMES[t] ?? VOX_NEUTRAL);
  const { preset, ...rest } = t;
  return withFonts({ ...(VOX_THEMES[preset ?? "neutral"] ?? VOX_NEUTRAL), ...rest });
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
  | "typewriter"
  // paper presets
  | "board"
  | "collage";

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
  cards?: VoxCard[]; // board: evidence pinned around the headline note
  links?: [number, number][]; // board: red strings between cards (-1 = the headline note)
  stamp?: string; // board/collage: rubber-stamp label
  cards9?: VoxCard[]; // board: explicit 9:16 layout (1080x1920 design px); default re-flows `cards`
  host?: string; // board/collage: cut-out host figure (transparent PNG) standing in front
  hostSide?: "left" | "right"; // board 16:9: which side the host stands on (default left)
  hostTreatment?: "theme" | "natural"; // host follows the theme's photo treatment (default) or stays in colour
  theme?: VoxThemeInput; // per-scene look (mix presets by chapter); default = the video theme
};

/** A pinned item on the evidence board. x/y/w are in 1920x1080 design px (top-left of the card). */
export type VoxCard = {
  kind: "photo" | "note" | "stamp";
  x: number;
  y: number;
  w?: number;
  h?: number; // photo image height (px); default 3:4 of w
  rot?: number; // degrees
  img?: string;
  caption?: string; // photo: handwritten caption under the polaroid
  redact?: [number, number, number, number]; // photo: black bar [x%, y%, w%, h%] over eyes/names
  title?: string; // note: header (typewriter) / stamp: text
  items?: string[]; // note: checklist
  credit?: string;
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
