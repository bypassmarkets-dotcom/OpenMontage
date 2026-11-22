// Paper-collage primitives for the dossier / collage presets: torn edges, torn highlight strips,
// pins + string, rubber stamps, polaroids, redaction bars, duotone photos, paper / newsprint grounds.
// Everything is deterministic (seeded) so preview == render.
import React, { useMemo } from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { cl, useAsset, useT, type VoxTheme } from "./theme";

// ---------- deterministic randomness ----------
export const rng = (seed: number) => {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
export const hashStr = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** CSS clip-path polygon with ragged (torn) edges. amp = jitter in % of the box. */
export const tornClip = (seed: number, opts: { amp?: number; steps?: number; edges?: "all" | "lr" | "tb" } = {}) => {
  const { amp = 1.2, steps = 28, edges = "all" } = opts;
  const r = rng(seed);
  const j = (on: boolean) => (on ? (r() - 0.5) * 2 * amp : 0);
  const tb = edges !== "lr";
  const lr = edges !== "tb";
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) pts.push(`${(i / steps) * 100}% ${Math.max(0, amp + j(tb))}%`);
  for (let i = 1; i <= steps; i++) pts.push(`${Math.min(100, 100 - amp * 0.6 + j(lr) * 0.6)}% ${(i / steps) * 100}%`);
  for (let i = steps - 1; i >= 0; i--) pts.push(`${(i / steps) * 100}% ${Math.min(100, 100 - amp + j(tb))}%`);
  for (let i = steps - 1; i >= 1; i--) pts.push(`${Math.max(0, amp * 0.6 + j(lr) * 0.6)}% ${(i / steps) * 100}%`);
  return `polygon(${pts.join(",")})`;
};

// ---------- textures ----------
const Noise: React.FC<{ id: string; opacity: number; blend: React.CSSProperties["mixBlendMode"]; freq?: number; dark?: boolean }> = ({ id, opacity, blend, freq = 0.8, dark }) => (
  <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity, mixBlendMode: blend }}>
    <filter id={id}>
      <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={3} seed={7} />
      <feColorMatrix values={dark ? "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" : "0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"} />
    </filter>
    <rect width="100%" height="100%" filter={`url(#${id})`} />
  </svg>
);

/** Paper fibre + blotchy stains. Use inside any card or as a full ground. */
export const PaperGrain: React.FC<{ strength?: number; seed?: number }> = ({ strength = 1, seed = 3 }) => {
  const r = useMemo(() => rng(seed), [seed]);
  const stains = useMemo(() => Array.from({ length: 5 }, () => ({ x: r() * 100, y: r() * 100, s: 20 + r() * 40, o: 0.05 + r() * 0.08 })), [r]);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Noise id={`pg${seed}`} opacity={0.35 * strength} blend="multiply" freq={0.65} dark />
      {stains.map((st, i) => (
        <AbsoluteFill key={i} style={{ background: `radial-gradient(circle at ${st.x}% ${st.y}%, rgba(90,60,20,${st.o * strength}), transparent ${st.s}%)` }} />
      ))}
    </AbsoluteFill>
  );
};

export const PaperGround: React.FC = () => {
  const T = useT();
  return (
    <AbsoluteFill style={{ background: T.bg }}>
      <PaperGrain strength={0.45} seed={11} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.35), transparent 60%)` }} />
    </AbsoluteFill>
  );
};

/** Dark layered newsprint: the backdrop image (or a generated column texture) crushed to near-black. */
export const NewsprintGround: React.FC = () => {
  const T = useT();
  const asset = useAsset();
  const f = useCurrentFrame();
  const cols = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 90 }, () => ({ x: r() * 1920, y: r() * 1080, w: 140 + r() * 260, rot: (r() - 0.5) * 14, lines: 6 + Math.floor(r() * 10), o: 0.08 + r() * 0.12 }));
  }, []);
  return (
    <AbsoluteFill style={{ background: T.bg, overflow: "hidden" }}>
      {T.backdrop ? (
        <Img src={asset(T.backdrop)} style={{ position: "absolute", inset: -40, width: "calc(100% + 80px)", height: "calc(100% + 80px)", objectFit: "cover", filter: "grayscale(1) sepia(0.35) contrast(1.2) brightness(0.24) blur(1px)", transform: `scale(${1.04 + f * 0.0002})` }} />
      ) : (
        cols.map((c, i) => (
          <div key={i} style={{ position: "absolute", left: c.x, top: c.y, width: c.w, transform: `rotate(${c.rot}deg)`, opacity: c.o }}>
            {Array.from({ length: c.lines }).map((_, k) => (
              <div key={k} style={{ height: 4, margin: "5px 0", width: `${70 + ((k * 37 + i) % 30)}%`, background: T.dim }} />
            ))}
          </div>
        ))
      )}
      <Noise id="nwg" opacity={0.25} blend="overlay" freq={0.9} />
    </AbsoluteFill>
  );
};

// ---------- torn paper card ----------
export const TornPaper: React.FC<{ seed?: number; color?: string; rot?: number; style?: React.CSSProperties; children?: React.ReactNode; shadow?: boolean; amp?: number }> = ({ seed = 1, color, rot = 0, style, children, shadow = true, amp = 1.4 }) => {
  const T = useT();
  const clip = useMemo(() => tornClip(seed, { amp }), [seed, amp]);
  return (
    <div style={{ position: "absolute", transform: `rotate(${rot}deg)`, filter: shadow ? "drop-shadow(0 18px 22px rgba(0,0,0,0.55))" : undefined, ...style }}>
      <div style={{ position: "relative", width: "100%", height: "100%", background: color ?? T.note ?? T.paper, clipPath: clip }}>
        <PaperGrain strength={0.9} seed={seed + 40} />
        <div style={{ position: "relative", width: "100%", height: "100%" }}>{children}</div>
      </div>
    </div>
  );
};

/** Inline torn highlight strip behind a phrase; tears in from the left. */
export const TornStrip: React.FC<{ children: React.ReactNode; delay?: number; color?: string; ink?: string; seed?: number; pad?: string }> = ({ children, delay = 0, color, ink, seed, pad = "0.02em 0.22em 0.06em" }) => {
  const T = useT();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 24, stiffness: 140, mass: 0.8 } });
  const sd = seed ?? hashStr(String(children));
  const clip = useMemo(() => tornClip(sd, { amp: 3.5, steps: 18 }), [sd]);
  return (
    <span style={{ position: "relative", display: "inline-block", padding: pad, margin: "0 0.04em" }}>
      <span style={{ position: "absolute", inset: 0, background: color ?? T.accent, clipPath: clip, transformOrigin: "left center", transform: `scaleX(${s}) rotate(-0.6deg)`, boxShadow: "0 6px 14px rgba(0,0,0,0.25)" }} />
      <span style={{ position: "relative", color: ink ?? T.onAccent }}>{children}</span>
    </span>
  );
};

/** Hand-drawn underline that draws in (marker stroke). */
export const HandUnderline: React.FC<{ delay?: number; color?: string; width?: number | string }> = ({ delay = 0, color, width = "100%" }) => {
  const T = useT();
  const f = useCurrentFrame();
  const p = interpolate(f, [delay, delay + 14], [0, 1], cl);
  return (
    <svg viewBox="0 0 300 20" preserveAspectRatio="none" style={{ display: "block", width, height: 16 }}>
      <path d="M4 12 C 60 4, 120 16, 180 9 S 270 6, 296 11" fill="none" stroke={color ?? T.accent} strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
    </svg>
  );
};

// ---------- pins & string ----------
export const Pin: React.FC<{ x: number; y: number; color?: string; s?: number }> = ({ x, y, color, s = 1 }) => {
  const T = useT();
  const c = color ?? T.accent;
  return (
    <div style={{ position: "absolute", left: x - 11, top: y - 11, width: 22, height: 22, borderRadius: 11, transform: `scale(${s})`, background: `radial-gradient(circle at 35% 30%, #fff8 0, ${c} 35%, #3a0806 100%)`, boxShadow: "2px 5px 6px rgba(0,0,0,0.6)", zIndex: 5 }} />
  );
};

/** Sagging red string between two points, drawn over [from, from+dur] frames. */
export const PinString: React.FC<{ a: [number, number]; b: [number, number]; from: number; dur?: number; color?: string }> = ({ a, b, from, dur = 16, color }) => {
  const T = useT();
  const f = useCurrentFrame();
  const p = interpolate(f, [from, from + dur], [0, 1], cl);
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2 + Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.08;
  return (
    <path d={`M${a[0]} ${a[1]} Q ${mx} ${my} ${b[0]} ${b[1]}`} fill="none" stroke={color ?? T.accent} strokeWidth={3} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} style={{ filter: "drop-shadow(1px 3px 2px rgba(0,0,0,0.55))" }} />
  );
};

// ---------- stamp ----------
export const Stamp: React.FC<{ text: string; delay?: number; rot?: number; size?: number; color?: string; style?: React.CSSProperties }> = ({ text, delay = 0, rot = -8, size = 44, color, style }) => {
  const T = useT();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 14, stiffness: 220, mass: 0.7 } });
  const c = color ?? T.accent;
  const seed = hashStr(text);
  return (
    <div style={{ display: "inline-block", transform: `rotate(${rot}deg) scale(${1.6 - 0.6 * s})`, opacity: s > 0.02 ? 1 : 0, ...style }}>
      <div style={{ position: "relative", border: `${size * 0.09}px solid ${c}`, padding: `${size * 0.12}px ${size * 0.35}px ${size * 0.18}px`, fontFamily: T.display ?? T.sans, fontSize: size, lineHeight: 1, color: c, letterSpacing: 1, textTransform: "uppercase", background: "rgba(255,255,255,0.04)" }}>
        {text}
        <AbsoluteFill style={{ WebkitMaskImage: undefined, background: `repeating-linear-gradient(${(seed % 60) + 20}deg, transparent 0 7px, rgba(22,19,15,0.22) 7px 9px)`, mixBlendMode: "multiply" }} />
      </div>
    </div>
  );
};

// ---------- photo treatments ----------
export const photoFilter = (T: VoxTheme, mode = T.photo ?? "natural") =>
  mode === "bw" ? "grayscale(1) contrast(1.35) brightness(0.92)" : mode === "duotone" ? "url(#vox-duo)" : "saturate(0.85) contrast(1.05)";

/** Define once per scene that uses duotone images. */
export const DuotoneDefs: React.FC = () => {
  const T = useT();
  const [d, l] = T.duo ?? ["#111111", T.accent];
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [dr, dg, db] = hex(d);
  const [lr, lg, lb] = hex(l);
  return (
    <svg width={0} height={0} style={{ position: "absolute" }}>
      <filter id="vox-duo" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0" />
        <feComponentTransfer>
          <feFuncR type="table" tableValues={`${dr} ${lr}`} />
          <feFuncG type="table" tableValues={`${dg} ${lg}`} />
          <feFuncB type="table" tableValues={`${db} ${lb}`} />
        </feComponentTransfer>
      </filter>
    </svg>
  );
};

/** Pinned instant photo: cream frame, B&W/duotone image, optional redaction bar + handwritten caption. */
export const Polaroid: React.FC<{ img: string; w: number; h?: number; caption?: string; redact?: [number, number, number, number]; seed?: number }> = ({ img, w, h, caption, redact, seed = 1 }) => {
  const T = useT();
  const asset = useAsset();
  const ih = h ?? Math.round(w * 0.78);
  return (
    <div style={{ width: w + 24, background: "#EFE8DA", padding: "12px 12px 0", boxShadow: "0 18px 26px rgba(0,0,0,0.6)", position: "relative" }}>
      <div style={{ position: "relative", width: w, height: ih, overflow: "hidden", background: "#222" }}>
        <Img src={asset(img)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: photoFilter(T) }} />
        {redact && <div style={{ position: "absolute", left: `${redact[0]}%`, top: `${redact[1]}%`, width: `${redact[2]}%`, height: `${redact[3]}%`, background: "#0B0A08", transform: "rotate(-1.5deg)" }} />}
        <PaperGrain strength={0.6} seed={seed + 70} />
      </div>
      <div style={{ height: caption ? 46 : 26, fontFamily: T.hand ?? T.sans, fontSize: 24, color: "#2A241C", display: "flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", overflow: "hidden" }}>{caption}</div>
    </div>
  );
};

/** Torn note with a typewriter title and a red-box checklist. */
export const Note: React.FC<{ title?: string; items?: string[]; w: number; delayItems?: number; seed?: number }> = ({ title, items = [], w, delayItems = 0, seed = 1 }) => {
  const T = useT();
  const f = useCurrentFrame();
  const ink = T.noteInk ?? "#1B1712";
  const h = (title ? 84 : 30) + items.length * 46 + 30;
  return (
    <div style={{ position: "relative", width: w, height: h }}>
      <TornPaper seed={seed} style={{ inset: 0, width: w, height: h }}>
        <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 10 }}>
          {title && (
            <div style={{ alignSelf: "flex-start", background: T.accent, color: T.onAccent, fontFamily: T.display ?? T.sans, fontSize: 32, lineHeight: 1, padding: "8px 14px 10px", textTransform: "uppercase", transform: "rotate(-1.5deg)" }}>{title}</div>
          )}
          {items.map((it, i) => {
            const o = interpolate(f, [delayItems + i * 5, delayItems + i * 5 + 8], [0, 1], cl);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, opacity: o, fontFamily: T.display ?? T.sans, fontSize: 26, letterSpacing: 0.5, color: ink, textTransform: T.uppercase ? "uppercase" : undefined }}>
                <span style={{ width: 24, height: 24, border: `3px solid ${T.accent}`, display: "inline-flex", alignItems: "center", justifyContent: "center", color: T.accent, fontSize: 22, fontFamily: T.sans, fontWeight: 900 }}>✓</span>
                {it}
              </div>
            );
          })}
        </div>
      </TornPaper>
    </div>
  );
};

/** Entrance used for pinned items: drop + settle with a slight overshoot in rotation. */
export const usePinDrop = (delay: number) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 13, stiffness: 120, mass: 0.8 } });
  return { s, style: { opacity: interpolate(f - delay, [0, 4], [0, 1], cl), transform: `translateY(${(1 - s) * -40}px) scale(${1.08 - 0.08 * s})` } as React.CSSProperties };
};

/**
 * Chapter change between two looks: a torn sheet of the incoming ground sweeps up over the cut
 * (covers the frame exactly at the bound, then leaves through the top). Pure overlay — scene timing
 * and narration sync are untouched. Mount in a Sequence starting `half` frames before the bound.
 */
export const ChapterWipe: React.FC<{ color: string; accent: string; half?: number; seed?: number }> = ({ color, accent, half = 14, seed = 5 }) => {
  const f = useCurrentFrame();
  const { height } = useVideoConfig();
  const ease = Easing.bezier(0.7, 0, 0.3, 1);
  const H = height * 1.5; // sheet taller than the frame so torn edges stay off-screen at cover
  const y = (lag: number) => interpolate(f - lag, [0, half * 2], [height, -H], { ...cl, easing: ease });
  const sheet = (lag: number, c: string, s: number, extra: number) => (
    <div style={{ position: "absolute", left: "-4%", width: "108%", top: y(lag) - extra, height: H + extra * 2, background: c, clipPath: tornClip(s, { amp: 1.6, steps: 22, edges: "tb" }) }} />
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {sheet(0, accent, seed + 1, 30)}
      {sheet(3, color, seed, 0)}
    </AbsoluteFill>
  );
};
