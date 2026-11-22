// Paper-preset scenes:
//   board   — evidence board: headline on a torn note, pinned polaroids/notes/stamps, red strings,
//             optional cut-out host standing in front of the board
//   collage — editorial collage poster: giant condensed type, torn accent strips, duotone cut-out
//             (host and/or photo), gold disc, icon row
// Each has a real 16:9 (1920x1080) and 9:16 (1080x1920) layout. The 9:16 layout follows the
// Dark Gold Explainer zones: header 4–12 %, content 18–60 %, caption ~69 %.
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CreditTag } from "./chrome";
import { DuotoneDefs, HandUnderline, Note, Pin, PinString, Polaroid, Stamp, TornPaper, TornStrip, hashStr, photoFilter, tornClip, usePinDrop } from "./paper";
import { cl, useAsset, useBeat, useT, useV, type VoxCard, type VoxScene, type VoxTheme } from "./theme";

type P = { s: VoxScene; dur: number };

const cardBox = (c: VoxCard) => {
  const w = c.w ?? (c.kind === "note" ? 330 : 260);
  if (c.kind === "photo") return { w: w + 24, h: (c.h ?? Math.round(w * 0.78)) + 12 + (c.caption ? 46 : 26) };
  if (c.kind === "note") return { w, h: (c.title ? 84 : 30) + (c.items?.length ?? 0) * 46 + 30 };
  return { w: 300, h: 90 };
};

const hostFilter = (T: VoxTheme, s: VoxScene) => (s.hostTreatment === "natural" ? "none" : photoFilter(T));

/** Cut-out host (transparent PNG) standing in the frame; rises in and breathes slightly. */
const Host: React.FC<{ s: VoxScene; box: React.CSSProperties; delay?: number; dur: number }> = ({ s, box, delay = 0, dur }) => {
  const T = useT();
  const asset = useAsset();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: f - delay, fps, config: { damping: 18, stiffness: 90, mass: 1 } });
  const breathe = interpolate(f, [0, dur], [1, 1.025], cl);
  if (!s.host) return null;
  return (
    <div style={{ position: "absolute", zIndex: 7, ...box, opacity: sp, transform: `translateY(${(1 - sp) * 80}px) scale(${breathe})`, transformOrigin: "50% 100%" }}>
      <Img src={asset(s.host)} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 100%", filter: `${hostFilter(T, s)} drop-shadow(0 30px 40px rgba(0,0,0,0.55))` }} />
    </div>
  );
};

// ---------- board ----------
// 9:16 slots: two columns either side of the host, below the headline note.
const SLOTS_9 = [
  { x: 30, y: 870 },
  { x: 720, y: 850 },
  { x: 20, y: 1250 },
  { x: 735, y: 1235 },
  { x: 40, y: 1590 },
  { x: 730, y: 1580 },
];

export const Board: React.FC<P> = ({ s, dur }) => {
  const f = useCurrentFrame();
  const v = useV();
  const beat = useBeat();
  const raw = s.cards ?? [];
  // vertical: re-flow cards into slots and cap their width; explicit cards9 wins
  const cards: VoxCard[] = v
    ? (s.cards9 ?? raw.map((c, i) => ({ ...c, ...SLOTS_9[i % SLOTS_9.length], w: Math.min(c.w ?? 300, c.kind === "photo" ? 290 : 320), h: c.h ? Math.min(c.h, 200) : undefined })))
    : raw;
  const push = interpolate(f, [0, dur], [1, 1.035], cl);
  const delays = cards.map((_, i) => beat(s, i, 22 + i * 7));
  const headDelay = 4;
  const note = v ? { x: 110, y: 220, w: 860, h: 620 } : { x: 560, y: 110, w: 800, h: 700 };
  const pinOf = (i: number): [number, number] => {
    if (i < 0) return [note.x + note.w / 2, note.y + 18];
    const c = cards[i];
    const b = cardBox(c);
    return [c.x + b.w / 2, c.y + 8];
  };
  const W = v ? 1080 : 1920;
  const H = v ? 1920 : 1080;
  const hostBox: React.CSSProperties = v
    ? { left: 40, width: 1000, top: 880, height: 1040 }
    : s.hostSide === "right"
      ? { right: -40, width: 620, bottom: 0, height: 960 }
      : { left: -40, width: 620, bottom: 0, height: 960 };
  return (
    // isolate: card/host z-indexes stay inside the scene, under the caption and brand
    <AbsoluteFill style={{ isolation: "isolate" }}>
      <div style={{ position: "absolute", inset: 0, width: W, height: H, transform: `scale(${push})`, transformOrigin: "50% 40%" }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, zIndex: 2, overflow: "visible" }}>
          {(s.links ?? []).map(([a, b], k) => {
            const from = Math.max(a < 0 ? headDelay + 10 : delays[a] ?? 0, b < 0 ? headDelay + 10 : delays[b] ?? 0) + 6;
            return <PinString key={k} a={pinOf(a)} b={pinOf(b)} from={from} dur={14} />;
          })}
        </svg>
        <HeadlineNote s={s} note={note} delay={headDelay} />
        {cards.map((c, i) => (
          <PinnedCard key={i} c={c} delay={delays[i]} seed={i + 3} />
        ))}
        {cards.map((c, i) => c.kind !== "stamp" && <PinAt key={`p${i}`} at={pinOf(i)} delay={delays[i] + 4} />)}
        {(s.links ?? []).some(([a, b]) => a < 0 || b < 0) && <PinAt at={pinOf(-1)} delay={headDelay + 6} />}
        <Host s={s} box={hostBox} delay={10} dur={dur} />
      </div>
      <CreditTag credit={s.credit} />
    </AbsoluteFill>
  );
};

const PinAt: React.FC<{ at: [number, number]; delay: number }> = ({ at, delay }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: f - delay, fps, config: { damping: 12, stiffness: 260 } });
  return f >= delay ? (
    <div style={{ position: "absolute", inset: 0, zIndex: 6 }}>
      <Pin x={at[0]} y={at[1]} s={0.6 + 0.4 * sp} />
    </div>
  ) : null;
};

const HeadlineNote: React.FC<{ s: VoxScene; note: { x: number; y: number; w: number; h: number }; delay: number }> = ({ s, note, delay }) => {
  const T = useT();
  const v = useV();
  const { s: sp, style } = usePinDrop(delay);
  const ink = T.noteInk ?? "#1B1712";
  const display = T.display ?? T.serif;
  const big = s.size ?? (v ? 170 : 170);
  const up = T.uppercase ? ("uppercase" as const) : undefined;
  return (
    <div style={{ position: "absolute", left: note.x, top: note.y, width: note.w, height: note.h, zIndex: 3, ...style }}>
      <TornPaper seed={hashStr(s.head ?? "h")} rot={-1.2} style={{ inset: 0, width: note.w, height: note.h }} amp={1.6}>
        <div style={{ position: "absolute", inset: "46px 40px 40px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 6 }}>
          {s.kicker && <div style={{ fontFamily: T.typeFace ?? T.sans, fontSize: 26, letterSpacing: 4, color: T.accentInk ?? T.accent, marginBottom: 6 }}>{s.kicker}</div>}
          {s.head && <div style={{ fontFamily: display, fontSize: big, lineHeight: 0.92, color: ink, textTransform: up }}>{s.head}</div>}
          {s.hi && (
            <div style={{ fontFamily: display, fontSize: big * 0.62, lineHeight: 1, textTransform: up, margin: "8px 0" }}>
              <TornStrip delay={delay + 12} pad="0.06em 0.28em 0.1em">{s.hi}</TornStrip>
            </div>
          )}
          {s.tail && <div style={{ fontFamily: display, fontSize: big * 0.62, lineHeight: 0.95, color: ink, textTransform: up }}>{s.tail}</div>}
          {s.sub && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", alignItems: "center", opacity: interpolate(sp, [0.6, 1], [0, 1], cl) }}>
              <div style={{ fontFamily: T.hand ?? T.sans, fontSize: 44, color: ink }}>{s.sub}</div>
              <HandUnderline delay={delay + 26} width={320} />
            </div>
          )}
        </div>
      </TornPaper>
      {s.stamp && (
        <div style={{ position: "absolute", left: v ? note.w - 260 : -150, top: v ? -40 : 150, zIndex: 4 }}>
          <Stamp text={s.stamp} delay={delay + 30} rot={-12} size={v ? 40 : 46} />
        </div>
      )}
    </div>
  );
};

const PinnedCard: React.FC<{ c: VoxCard; delay: number; seed: number }> = ({ c, delay, seed }) => {
  const { style } = usePinDrop(delay);
  const w = c.w ?? (c.kind === "note" ? 330 : 260);
  return (
    <div style={{ position: "absolute", left: c.x, top: c.y, zIndex: 4, ...style }}>
      <div style={{ transform: `rotate(${c.rot ?? 0}deg)`, transformOrigin: "50% 0" }}>
        {c.kind === "photo" && c.img && <Polaroid img={c.img} w={w} h={c.h} caption={c.caption} redact={c.redact} seed={seed} />}
        {c.kind === "note" && <Note title={c.title} items={c.items} w={w} delayItems={delay + 8} seed={seed} />}
        {c.kind === "stamp" && <Stamp text={c.title ?? ""} delay={delay} rot={c.rot ?? -8} size={c.w ? c.w / 6 : 48} />}
      </div>
    </div>
  );
};

// ---------- collage ----------
const GLYPHS = [
  // eye, bolt, lock, target, globe
  "M4 16c5-8 19-8 24 0-5 8-19 8-24 0Z M16 12a4 4 0 1 1 0 8a4 4 0 1 1 0-8Z",
  "M18 3 7 18h8l-2 11 11-16h-8z",
  "M9 14v-4a7 7 0 0 1 14 0v4 M7 14h18v13H7z",
  "M16 4a12 12 0 1 1 0 24a12 12 0 1 1 0-24Z M16 10a6 6 0 1 1 0 12a6 6 0 1 1 0-12Z M16 15a1 1 0 1 1 0 2",
  "M16 4a12 12 0 1 1 0 24a12 12 0 1 1 0-24Z M4 16h24 M16 4c-6 7-6 17 0 24 M16 4c6 7 6 17 0 24",
];

// Per-aspect geometry for the collage (design px).
const COLLAGE = {
  h: {
    W: 1920, H: 1080,
    disc: { cx: 1040, cy: 420, r: 300 },
    photo: { left: 1000, top: 40, width: 760, height: 1040 },
    host: { left: 980, width: 900, bottom: 0, height: 1040 },
    type: { left: 110, top: 120, width: 1050, align: "flex-start" as const },
    icons: { left: 110, top: 880 },
    stairs: { x: 1700, base: 980 },
    stamp: { right: 60, top: 50 },
  },
  v: {
    W: 1080, H: 1920,
    disc: { cx: 540, cy: 1290, r: 390 },
    photo: { left: 150, top: 900, width: 780, height: 900 },
    host: { left: 40, width: 1000, top: 860, height: 1060 },
    type: { left: 70, top: 230, width: 940, align: "center" as const },
    icons: { left: 0, top: 1740 },
    stairs: { x: 860, base: 1840 },
    stamp: { right: 50, top: 70 },
  },
};

export const Collage: React.FC<P> = ({ s, dur }) => {
  const T = useT();
  const asset = useAsset();
  const v = useV();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beat = useBeat();
  const G = v ? COLLAGE.v : COLLAGE.h;
  const ink = T.text;
  const display = T.display ?? T.serif;
  const up = T.uppercase ? ("uppercase" as const) : undefined;
  const slam = (d: number) => spring({ frame: f - d, fps, config: { damping: 15, stiffness: 170, mass: 0.9 } });
  const s1 = slam(4);
  const s3 = slam(18);
  const photoIn = spring({ frame: f - 2, fps, config: { damping: 20, stiffness: 90 } });
  const drift = interpolate(f, [0, dur], [0, -18], cl);
  const big = s.size ?? (v ? 300 : 330);
  const items = s.items ?? [];
  const clip = tornClip(hashStr(s.img ?? "c"), { amp: 1.1, steps: 34 });
  return (
    // isolate: card/host z-indexes stay inside the scene, under the caption and brand
    <AbsoluteFill style={{ isolation: "isolate" }}>
      <DuotoneDefs />
      <div style={{ position: "absolute", inset: 0, width: G.W, height: G.H }}>
        {/* decor */}
        <svg width={G.W} height={G.H} style={{ position: "absolute", inset: 0 }}>
          <circle cx={G.disc.cx} cy={G.disc.cy} r={G.disc.r} fill={T.accent} opacity={0.9 * photoIn} />
          <circle cx={G.disc.cx} cy={G.disc.cy} r={G.disc.r + 50} fill="none" stroke={ink} strokeWidth={2} strokeDasharray="4 10" opacity={0.5} />
          {Array.from({ length: 6 }).map((_, i) => {
            const k = interpolate(f, [8 + i * 3, 20 + i * 3], [0, 1], cl);
            return <rect key={i} x={G.stairs.x + i * 36} y={G.stairs.base - i * 70 + (1 - k) * 60} width={36} height={100 + i * 70} fill={ink} opacity={k} />;
          })}
          {[[60, 120, 380, 120, 420, 80], [60, 170, 300, 170, 340, 210], [60, 220, 250, 220]].map((pts, i) => (
            <polyline key={i} points={pts.join(" ")} fill="none" stroke={ink} strokeWidth={2} opacity={0.3} transform={v ? `translate(0 ${G.H - 380})` : undefined} />
          ))}
          {Array.from({ length: Math.ceil(G.W / 44) }).map((_, i) => {
            const h = 40 + ((i * 53) % 100);
            return <rect key={`b${i}`} x={i * 44} y={G.H - h} width={40} height={h} fill={ink} opacity={0.14} />;
          })}
        </svg>

        {/* torn duotone photo (behind the host when both are given) */}
        {s.img && (
          <div style={{ position: "absolute", ...G.photo, left: G.photo.left + (1 - photoIn) * (v ? 0 : 260), top: G.photo.top + (1 - photoIn) * (v ? 200 : 0), clipPath: clip, filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.35))", opacity: s.host ? 0.9 : 1 }}>
            <Img src={asset(s.img)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: s.focus ? `${s.focus[0]}% ${s.focus[1]}%` : "center", filter: photoFilter(T), transform: `translateY(${drift}px) scale(1.06)` }} />
            <AbsoluteFill style={{ backgroundImage: `radial-gradient(${ink}33 1.2px, transparent 1.4px)`, backgroundSize: "7px 7px", mixBlendMode: "multiply" }} />
          </div>
        )}
        <Host s={s} box={G.host} delay={6} dur={dur} />

        {/* type stack */}
        <div style={{ position: "absolute", left: G.type.left, top: G.type.top, width: G.type.width, display: "flex", flexDirection: "column", alignItems: G.type.align, textAlign: v ? "center" : "left", zIndex: 8 }}>
          {s.kicker && <div style={{ fontFamily: T.typeFace ?? T.sans, fontSize: v ? 30 : 28, letterSpacing: 5, color: T.accentInk ?? T.accent, marginBottom: 6, opacity: s1 }}>{s.kicker}</div>}
          {s.head && (
            <div style={{ fontFamily: display, fontSize: big, lineHeight: 0.86, color: ink, textTransform: up, transform: `scale(${1.25 - 0.25 * s1})`, transformOrigin: v ? "center bottom" : "left bottom", opacity: s1, textShadow: "6px 6px 0 rgba(0,0,0,0.08)" }}>{s.head}</div>
          )}
          {s.tail && (
            <div style={{ fontFamily: display, fontSize: big * 0.26, lineHeight: 1, textTransform: up, margin: "10px 0 4px" }}>
              <TornStrip delay={12} color={ink} ink={T.bg}>{s.tail}</TornStrip>
            </div>
          )}
          {s.hi && (
            <div style={{ fontFamily: display, fontSize: big * 0.6, lineHeight: 1, textTransform: up, transform: `translateX(${(1 - s3) * -60}px)`, opacity: s3 }}>
              <TornStrip delay={20} ink={ink} pad="0.04em 0.18em 0.06em">{s.hi}</TornStrip>
            </div>
          )}
          {s.sub && (
            <div style={{ marginTop: 18, fontFamily: display, fontSize: v ? 44 : 40, letterSpacing: 2, textTransform: up, opacity: interpolate(f, [30, 40], [0, 1], cl) }}>
              <TornStrip delay={30} color={T.panel} ink={ink}>{s.sub}</TornStrip>
            </div>
          )}
        </div>

        {/* icon row */}
        {items.length > 0 && (
          <div style={{ position: "absolute", left: G.icons.left, top: G.icons.top, width: v ? G.W : undefined, display: "flex", justifyContent: v ? "center" : "flex-start", gap: v ? 34 : 46, zIndex: 9 }}>
            {items.map((t, i) => {
              const d = beat(s, i, 40 + i * 6);
              const o = interpolate(f, [d, d + 8], [0, 1], cl);
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: o, transform: `translateY(${(1 - o) * 12}px)`, background: v ? `${T.bg}E6` : undefined, padding: v ? "8px 10px" : undefined, borderRadius: 6 }}>
                  <svg width={52} height={52} viewBox="0 0 32 32">
                    <path d={GLYPHS[i % GLYPHS.length]} fill="none" stroke={ink} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                  <div style={{ fontFamily: T.typeFace ?? T.sans, fontSize: 18, letterSpacing: 2, color: ink, textTransform: "uppercase" }}>{t}</div>
                </div>
              );
            })}
          </div>
        )}
        {s.stamp && (
          <div style={{ position: "absolute", ...G.stamp, zIndex: 9 }}>
            <TornPaper seed={9} color={T.accent} style={{ position: "relative", width: 170, height: 96 }} amp={3} shadow>
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display, fontSize: 46, color: ink }}>{s.stamp}</div>
            </TornPaper>
          </div>
        )}
      </div>
      <CreditTag credit={s.credit} />
    </AbsoluteFill>
  );
};
