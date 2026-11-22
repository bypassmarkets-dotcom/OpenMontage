// Paper-preset scenes:
//   board   — evidence board: headline on a torn note, pinned polaroids/notes/stamps, red strings
//   collage — editorial collage poster: giant condensed type, torn accent strips, duotone cut-out photo
// Both are authored in 1920x1080 design space; in 9:16 they are scaled to width and centred.
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CreditTag } from "./chrome";
import { DuotoneDefs, HandUnderline, Note, Pin, PinString, Polaroid, Stamp, TornPaper, TornStrip, photoFilter, tornClip, usePinDrop } from "./paper";
import { cl, useAsset, useBeat, useT, useV, type VoxCard, type VoxScene } from "./theme";

type P = { s: VoxScene; dur: number };

/** 16:9 artboard that letterboxes into 9:16 (scaled to width, vertically centred, slightly zoomed). */
const Artboard: React.FC<{ children: React.ReactNode; push?: number }> = ({ children, push = 0 }) => {
  const v = useV();
  const k = v ? 1080 / 1920 / 0.62 : 1; // vertical: crop the sides a little so type stays big
  return (
    <div style={{ position: "absolute", left: v ? (1080 - 1920 * k) / 2 : 0, top: v ? (1920 - 1080 * k) / 2 - 120 : 0, width: 1920, height: 1080, transform: `scale(${k * (1 + push)})`, transformOrigin: v ? "top left" : "center" }}>
      {children}
    </div>
  );
};

const cardBox = (c: VoxCard) => {
  const w = c.w ?? (c.kind === "note" ? 330 : 260);
  if (c.kind === "photo") return { w: w + 24, h: (c.h ?? Math.round(w * 0.78)) + 12 + (c.caption ? 46 : 26) };
  if (c.kind === "note") return { w, h: (c.title ? 84 : 30) + (c.items?.length ?? 0) * 46 + 30 };
  return { w: 300, h: 90 };
};

// ---------- board ----------
export const Board: React.FC<P> = ({ s, dur }) => {
  const T = useT();
  const f = useCurrentFrame();
  const beat = useBeat();
  const cards = s.cards ?? [];
  const push = interpolate(f, [0, dur], [0, 0.035], cl);
  const delays = cards.map((_, i) => beat(s, i, 22 + i * 7));
  const headDelay = 4;
  const pinOf = (i: number): [number, number] => {
    if (i < 0) return [960, 128];
    const c = cards[i];
    const b = cardBox(c);
    return [c.x + b.w / 2, c.y + 8];
  };
  const big = s.size ?? 170;
  const lines = [s.head, s.tail].filter(Boolean) as string[];
  return (
    <AbsoluteFill>
      <Artboard push={push}>
        {/* strings under the cards */}
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, zIndex: 2, overflow: "visible" }}>
          {(s.links ?? []).map(([a, b], k) => {
            const from = Math.max(a < 0 ? headDelay + 10 : delays[a] ?? 0, b < 0 ? headDelay + 10 : delays[b] ?? 0) + 6;
            return <PinString key={k} a={pinOf(a)} b={pinOf(b)} from={from} dur={14} />;
          })}
        </svg>

        {/* headline note */}
        <HeadlineNote s={s} big={big} lines={lines} delay={headDelay} />

        {cards.map((c, i) => (
          <PinnedCard key={i} c={c} delay={delays[i]} seed={i + 3} />
        ))}
        {cards.map((c, i) => c.kind !== "stamp" && <PinAt key={`p${i}`} at={pinOf(i)} delay={delays[i] + 4} />)}
        {(s.links ?? []).some(([a, b]) => a < 0 || b < 0) && <PinAt at={pinOf(-1)} delay={headDelay + 6} />}
      </Artboard>
      <CreditTag credit={s.credit} />
    </AbsoluteFill>
  );
};

const PinAt: React.FC<{ at: [number, number]; delay: number }> = ({ at, delay }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: f - delay, fps, config: { damping: 12, stiffness: 260 } });
  return f >= delay ? <div style={{ position: "absolute", inset: 0, zIndex: 6 }}><Pin x={at[0]} y={at[1]} s={0.6 + 0.4 * sp} /></div> : null;
};

const HeadlineNote: React.FC<{ s: VoxScene; big: number; lines: string[]; delay: number }> = ({ s, big, lines, delay }) => {
  const T = useT();
  const { s: sp, style } = usePinDrop(delay);
  const ink = T.noteInk ?? "#1B1712";
  const display = T.display ?? T.serif;
  return (
    <div style={{ position: "absolute", left: 560, top: 110, width: 800, height: 700, zIndex: 3, ...style }}>
      <TornPaper seed={hashSeed(s.head ?? "h")} rot={-1.2} style={{ inset: 0, width: 800, height: 700 }} amp={1.6}>
        <div style={{ position: "absolute", inset: "46px 40px 40px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 6 }}>
          {s.kicker && <div style={{ fontFamily: T.typeFace ?? T.sans, fontSize: 26, letterSpacing: 4, color: T.accentInk ?? T.accent, marginBottom: 6 }}>{s.kicker}</div>}
          {lines[0] && <div style={{ fontFamily: display, fontSize: big, lineHeight: 0.92, color: ink, textTransform: T.uppercase ? "uppercase" : undefined }}>{lines[0]}</div>}
          {s.hi && (
            <div style={{ fontFamily: display, fontSize: big * 0.62, lineHeight: 1, textTransform: T.uppercase ? "uppercase" : undefined, margin: "8px 0" }}>
              <TornStrip delay={delay + 12} pad="0.06em 0.28em 0.1em">{s.hi}</TornStrip>
            </div>
          )}
          {lines[1] && <div style={{ fontFamily: display, fontSize: big * 0.62, lineHeight: 0.95, color: ink, textTransform: T.uppercase ? "uppercase" : undefined }}>{lines[1]}</div>}
          {s.sub && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", alignItems: "center", opacity: interpolate(sp, [0.6, 1], [0, 1], cl) }}>
              <div style={{ fontFamily: T.hand ?? T.sans, fontSize: 44, color: ink }}>{s.sub}</div>
              <HandUnderline delay={delay + 26} width={320} />
            </div>
          )}
        </div>
      </TornPaper>
      {s.stamp && (
        <div style={{ position: "absolute", left: -150, top: 150, zIndex: 4 }}>
          <Stamp text={s.stamp} delay={delay + 30} rot={-12} size={46} />
        </div>
      )}
    </div>
  );
};

const hashSeed = (t: string) => Array.from(t).reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);

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

export const Collage: React.FC<P> = ({ s, dur }) => {
  const T = useT();
  const asset = useAsset();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beat = useBeat();
  const ink = T.text;
  const display = T.display ?? T.serif;
  const slam = (d: number) => spring({ frame: f - d, fps, config: { damping: 15, stiffness: 170, mass: 0.9 } });
  const s1 = slam(4);
  const s3 = slam(18);
  const photoIn = spring({ frame: f - 2, fps, config: { damping: 20, stiffness: 90 } });
  const drift = interpolate(f, [0, dur], [0, -18], cl);
  const big = s.size ?? 330;
  const items = s.items ?? [];
  const clip = tornClip(hashSeed(s.img ?? "c"), { amp: 1.1, steps: 34 });
  return (
    <AbsoluteFill>
      <DuotoneDefs />
      <Artboard>
        {/* decor */}
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          <circle cx={1040} cy={420} r={300} fill={T.accent} opacity={0.9 * photoIn} />
          <circle cx={1040} cy={420} r={350} fill="none" stroke={ink} strokeWidth={2} strokeDasharray="4 10" opacity={0.5} />
          {Array.from({ length: 6 }).map((_, i) => (
            <rect key={i} x={1700 + i * 36} y={980 - i * 70 - interpolate(f, [8 + i * 3, 20 + i * 3], [60, 0], cl)} width={36} height={100 + i * 70} fill={ink} opacity={interpolate(f, [8 + i * 3, 20 + i * 3], [0, 1], cl)} />
          ))}
          {[[60, 120, 380, 120, 420, 80], [60, 170, 300, 170, 340, 210], [60, 220, 250, 220]].map((pts, i) => (
            <polyline key={i} points={pts.join(" ")} fill="none" stroke={ink} strokeWidth={2} opacity={0.35} />
          ))}
          {/* skyline */}
          {Array.from({ length: 18 }).map((_, i) => {
            const h = 40 + ((i * 53) % 100);
            return <rect key={`b${i}`} x={i * 44} y={1080 - h} width={40} height={h} fill={ink} opacity={0.18} />;
          })}
        </svg>

        {/* duotone photo, torn edge */}
        {s.img && (
          <div style={{ position: "absolute", left: 1000 + (1 - photoIn) * 260, top: 40, width: 760, height: 1040, clipPath: clip, filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.35))" }}>
            <Img src={asset(s.img)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: s.focus ? `${s.focus[0]}% ${s.focus[1]}%` : "center", filter: photoFilter(T), transform: `translateY(${drift}px) scale(1.06)` }} />
            <AbsoluteFill style={{ backgroundImage: `radial-gradient(${ink}33 1.2px, transparent 1.4px)`, backgroundSize: "7px 7px", mixBlendMode: "multiply" }} />
          </div>
        )}

        {/* type stack */}
        <div style={{ position: "absolute", left: 110, top: 120, width: 1050, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          {s.kicker && <div style={{ fontFamily: T.typeFace ?? T.sans, fontSize: 28, letterSpacing: 5, color: T.accentInk ?? T.accent, marginBottom: 6, opacity: s1 }}>{s.kicker}</div>}
          {s.head && (
            <div style={{ fontFamily: display, fontSize: big, lineHeight: 0.86, color: ink, textTransform: T.uppercase ? "uppercase" : undefined, transform: `scale(${1.25 - 0.25 * s1})`, transformOrigin: "left bottom", opacity: s1, textShadow: "6px 6px 0 rgba(0,0,0,0.08)" }}>{s.head}</div>
          )}
          {s.tail && (
            <div style={{ fontFamily: display, fontSize: big * 0.26, lineHeight: 1, textTransform: T.uppercase ? "uppercase" : undefined, margin: "10px 0 4px" }}>
              <TornStrip delay={12} color={ink} ink={T.bg}>{s.tail}</TornStrip>
            </div>
          )}
          {s.hi && (
            <div style={{ fontFamily: display, fontSize: big * 0.6, lineHeight: 1, textTransform: T.uppercase ? "uppercase" : undefined, transform: `translateX(${(1 - s3) * -60}px)`, opacity: s3 }}>
              <TornStrip delay={20} ink={ink} pad="0.04em 0.18em 0.06em">{s.hi}</TornStrip>
            </div>
          )}
          {s.sub && (
            <div style={{ marginTop: 18, fontFamily: display, fontSize: 40, letterSpacing: 2, textTransform: T.uppercase ? "uppercase" : undefined, opacity: interpolate(f, [30, 40], [0, 1], cl) }}>
              <TornStrip delay={30} color={T.panel} ink={ink}>{s.sub}</TornStrip>
            </div>
          )}
        </div>

        {/* icon row */}
        {items.length > 0 && (
          <div style={{ position: "absolute", left: 110, top: 880, display: "flex", gap: 46, zIndex: 3 }}>
            {items.map((t, i) => {
              const d = beat(s, i, 40 + i * 6);
              const o = interpolate(f, [d, d + 8], [0, 1], cl);
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: o, transform: `translateY(${(1 - o) * 12}px)` }}>
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
          <div style={{ position: "absolute", right: 60, top: 50 }}>
            <TornPaper seed={9} color={T.accent} style={{ position: "relative", width: 170, height: 96 }} amp={3} shadow>
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display, fontSize: 46, color: ink }}>{s.stamp}</div>
            </TornPaper>
          </div>
        )}
      </Artboard>
      <CreditTag credit={s.credit} />
    </AbsoluteFill>
  );
};
