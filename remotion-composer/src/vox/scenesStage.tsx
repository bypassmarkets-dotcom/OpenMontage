// "Stage" layout for the paper presets (theme.stage: dossier, collage).
//
// One rule for every scene: the idea is BIG and centred in the content zone; the host is a cut-out
// head-and-shoulders bust in a bottom corner (~¼ of the frame, rendered once by HostTrack so it does not
// pop on every cut); captions are a strip of torn paper just above the host. Everything is made of
// paper and ink (torn sheets, pen ticks, pen strike-through), three type levels only:
//   L1 display (head / hi / tail, auto-fit to the zone) · L2 label (kicker, sub, list items) · captions.
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CreditTag } from "./chrome";
import { DuotoneDefs, PinString, Stamp, TornPaper, TornStrip, hashStr, photoFilter, tornClip } from "./paper";
import { cl, stageZones, useAsset, useBeat, useT, useV, useVox, type VoxCue, type VoxScene, type VoxTheme } from "./theme";

type P = { s: VoxScene; dur?: number };

const glyphs = (t?: string) => Array.from(t ?? "").filter((c) => !/[ัิ-ฺ็-๎]/.test(c)).length;

/** L1 size that fits the longest display line into the zone width. */
const fitSize = (lines: (string | undefined)[], width: number, max: number, perChar = 0.56) => {
  const n = Math.max(1, ...lines.map(glyphs));
  return Math.round(Math.min(max, (width * 0.94) / (n * perChar)));
};

const usePop = (delay: number) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: { damping: 10, stiffness: 170, mass: 0.7 } });
};

const Zone: React.FC<{ children: React.ReactNode; gap?: number; justify?: "center" | "flex-start" }> = ({ children, gap = 22, justify = "center" }) => {
  const v = useV();
  const z = stageZones(v).content;
  return (
    <div style={{ position: "absolute", left: z.x, top: z.y, width: z.w, height: z.h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: justify, textAlign: "center", gap, zIndex: 6 }}>
      {children}
    </div>
  );
};

const Label: React.FC<{ text?: string; delay?: number; color?: string }> = ({ text, delay = 0, color }) => {
  const T = useT();
  const v = useV();
  const f = useCurrentFrame();
  if (!text) return null;
  const chars = Array.from(text);
  const n = Math.floor(interpolate(f, [delay, delay + chars.length * 1.2], [0, chars.length], cl));
  return <div style={{ fontFamily: T.typeFace ?? T.sans, fontSize: v ? 40 : 36, letterSpacing: 3, color: color ?? T.accentInk ?? T.accent, minHeight: v ? 48 : 44 }}>{chars.slice(0, n).join("")}</div>;
};

/** kicker + head + hi + tail + sub, all L1/L2, popping in. */
const Display: React.FC<{ s: VoxScene; max?: number; delay?: number }> = ({ s, max, delay = 0 }) => {
  const T = useT();
  const v = useV();
  const z = stageZones(v).content;
  const display = T.display ?? T.serif;
  const up = T.uppercase ? ("uppercase" as const) : undefined;
  const ink = T.text;
  const size = fitSize([s.head, s.hi, s.tail], z.w, max ?? s.size ?? (v ? 190 : 170));
  const a = usePop(delay + 3);
  const b = usePop(delay + 9);
  const c = usePop(delay + 14);
  return (
    <>
      <Label text={s.kicker} delay={delay} />
      {s.head && <div style={{ fontFamily: display, fontSize: size, lineHeight: 1.02, color: ink, textTransform: up, transform: `scale(${a})`, opacity: a > 0.02 ? 1 : 0 }}>{s.head}</div>}
      {s.hi && (
        <div style={{ fontFamily: display, fontSize: size, lineHeight: 1.05, textTransform: up, transform: `scale(${b})`, opacity: b > 0.02 ? 1 : 0 }}>
          <TornStrip delay={delay + 11} pad="0.04em 0.2em 0.08em">{s.hi}</TornStrip>
        </div>
      )}
      {s.tail && <div style={{ fontFamily: display, fontSize: size, lineHeight: 1.02, color: ink, textTransform: up, transform: `scale(${c})`, opacity: c > 0.02 ? 1 : 0 }}>{s.tail}</div>}
      {s.sub && <Label text={s.sub} delay={delay + 24} color={T.dim} />}
    </>
  );
};

export const StageBig: React.FC<P> = ({ s }) => (
  <AbsoluteFill style={{ isolation: "isolate" }}>
    <Zone>
      <Display s={s} />
    </Zone>
    <CreditTag credit={s.credit} />
  </AbsoluteFill>
);

/** collage: gold disc + optional torn duotone photo behind the big type. */
export const StageCollage: React.FC<P> = ({ s, dur = 120 }) => {
  const T = useT();
  const v = useV();
  const asset = useAsset();
  const f = useCurrentFrame();
  const z = stageZones(v).content;
  const disc = usePop(0);
  const cx = z.x + z.w / 2;
  const cy = z.y + z.h / 2;
  const r = Math.min(z.w, z.h) * 0.44;
  const drift = interpolate(f, [0, dur], [0, -16], cl);
  return (
    <AbsoluteFill style={{ isolation: "isolate" }}>
      <DuotoneDefs />
      <svg width={v ? 1080 : 1920} height={v ? 1920 : 1080} style={{ position: "absolute", inset: 0 }}>
        <circle cx={cx} cy={cy} r={r * disc} fill={T.accent} opacity={0.85} />
        <circle cx={cx} cy={cy} r={r + 40} fill="none" stroke={T.text} strokeWidth={2} strokeDasharray="4 10" opacity={0.4 * disc} />
      </svg>
      {s.img && (
        <div style={{ position: "absolute", left: cx - r * 1.05, top: cy - r * 0.95, width: r * 2.1, height: r * 1.9, clipPath: tornClip(hashStr(s.img), { amp: 1.2, steps: 30 }), opacity: 0.55 * disc }}>
          <Img src={asset(s.img)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: photoFilter(T), transform: `translateY(${drift}px) scale(1.08)` }} />
        </div>
      )}
      <Zone>
        <Display s={s} />
      </Zone>
      {s.stamp && (
        <div style={{ position: "absolute", left: z.x + z.w - (v ? 230 : 260), top: z.y + 20, zIndex: 9 }}>
          <Stamp text={s.stamp} delay={20} rot={-10} size={v ? 56 : 52} />
        </div>
      )}
      <CreditTag credit={s.credit} />
    </AbsoluteFill>
  );
};

/** Hand-drawn tick drawn with a pen. */
const PenTick: React.FC<{ from: number; size: number; color: string }> = ({ from, size, color }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [from, from + 8], [0, 1], { ...cl, easing: Easing.out(Easing.cubic) });
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ flexShrink: 0 }}>
      <rect x={3} y={3} width={34} height={34} fill="none" stroke={color} strokeWidth={3} opacity={0.75} />
      <path d="M9 21 L17 29 L33 9" fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
    </svg>
  );
};

/** list: headline + items on torn paper strips, each ticked with a pen on its beat. */
export const StageList: React.FC<P> = ({ s }) => {
  const T = useT();
  const v = useV();
  const f = useCurrentFrame();
  const beat = useBeat();
  const z = stageZones(v).content;
  const items = s.items ?? [];
  const head = { ...s, sub: undefined, size: fitSize([s.head, s.hi], z.w, v ? 150 : 130) };
  const itemSize = Math.min(v ? 60 : 54, fitSize(items, z.w - 160, 64, 0.6));
  return (
    <AbsoluteFill style={{ isolation: "isolate" }}>
      <Zone gap={14}>
        <Display s={head} />
        <div style={{ display: "flex", flexDirection: "column", gap: v ? 18 : 14, marginTop: 18, alignItems: "stretch", width: v ? "92%" : "82%" }}>
          {items.map((raw, i) => {
            const at = beat(s, i, 26 + i * 14);
            const o = interpolate(f, [at, at + 8], [0, 1], cl);
            const x = interpolate(f, [at, at + 12], [-50, 0], { ...cl, easing: Easing.out(Easing.cubic) });
            return (
              <div key={i} style={{ opacity: o, transform: `translateX(${x}px) rotate(${i % 2 ? 0.8 : -0.8}deg)` }}>
                <TornPaper seed={hashStr(raw) + i} color={T.panel} style={{ position: "relative", width: "100%" }} amp={1.2} shadow>
                  <div style={{ display: "flex", alignItems: "center", gap: 22, padding: v ? "16px 30px 20px" : "12px 26px 16px", textAlign: "left" }}>
                    <PenTick from={at + 6} size={v ? 54 : 48} color={T.accentInk ?? T.accent} />
                    <div style={{ fontFamily: T.display ?? T.sans, fontSize: itemSize, lineHeight: 1.15, color: T.noteInk ?? T.text }}>{raw.replace(/^~/, "")}</div>
                  </div>
                </TornPaper>
              </div>
            );
          })}
        </div>
      </Zone>
    </AbsoluteFill>
  );
};

/** split: two torn sheets; when the second lands, a pen strikes through the first if it says "ไม่ใช่/not". */
export const StageSplit: React.FC<P> = ({ s }) => {
  const T = useT();
  const v = useV();
  const f = useCurrentFrame();
  const beat = useBeat();
  const z = stageZones(v).content;
  const sides = [s.left, s.right].filter(Boolean) as { label: string; text: string }[];
  const size = Math.min(v ? 92 : 78, fitSize(sides.map((x) => x.text), v ? z.w - 80 : z.w / 2 - 80, 92, 0.6) * (v ? 1.6 : 1.7));
  const t1 = beat(s, 1, 40);
  const negate = /^(ไม่|not|no)/i.test(s.left?.label ?? "");
  const strike = interpolate(f, [t1 + 8, t1 + 20], [0, 1], { ...cl, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ isolation: "isolate" }}>
      <Zone gap={20}>
        <Label text={s.kicker} />
        <div style={{ display: "flex", flexDirection: v ? "column" : "row", gap: v ? 26 : 30, width: "100%", alignItems: "stretch" }}>
          {sides.map((side, i) => {
            const at = beat(s, i, 10 + i * 30);
            const k = spring({ frame: f - at, fps: 30, config: { damping: 12, stiffness: 150, mass: 0.8 } });
            const dim = i === 0 && negate ? interpolate(strike, [0, 1], [1, 0.55]) : 1;
            return (
              <div key={i} style={{ flex: 1, opacity: (f >= at ? 1 : 0) * dim, transform: `translateY(${(1 - k) * 40}px) rotate(${i ? 1.2 : -1.2}deg) scale(${0.94 + 0.06 * k})` }}>
                <TornPaper seed={hashStr(side.text)} color={i ? T.paper : T.panel} style={{ position: "relative", width: "100%" }} amp={1.4} shadow>
                  <div style={{ padding: v ? "30px 40px 38px" : "28px 34px 34px", display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
                    <div style={{ fontFamily: T.typeFace ?? T.sans, fontSize: v ? 36 : 32, letterSpacing: 3, color: i ? T.accentInk ?? T.accent : T.dim }}>{side.label}</div>
                    <div style={{ position: "relative", fontFamily: T.display ?? T.serif, fontSize: size, lineHeight: 1.08, color: i ? "#14120F" : T.noteInk ?? T.text }}>
                      {side.text}
                      {i === 0 && negate && (
                        <svg style={{ position: "absolute", left: -10, top: "38%", width: "calc(100% + 20px)", height: 40, overflow: "visible" }} viewBox="0 0 100 10" preserveAspectRatio="none">
                          <path d="M0 6 Q 30 2 55 5 T 100 4" fill="none" stroke={T.accent} strokeWidth={2.6} vectorEffect="non-scaling-stroke" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - strike} style={{ strokeWidth: 9 }} />
                        </svg>
                      )}
                    </div>
                  </div>
                </TornPaper>
              </div>
            );
          })}
        </div>
      </Zone>
    </AbsoluteFill>
  );
};

/** network: hub disc in the centre of the zone, torn-paper notes around it, red strings on beats. */
export const StageNetwork: React.FC<P> = ({ s }) => {
  const T = useT();
  const v = useV();
  const f = useCurrentFrame();
  const beat = useBeat();
  const z = stageZones(v).content;
  const nodes = s.items ?? [];
  const cx = z.x + z.w / 2;
  const cy = z.y + z.h / 2 + (v ? 30 : 20);
  const rx = z.w * (v ? 0.34 : 0.38);
  const ry = z.h * (v ? 0.36 : 0.34);
  const hub = usePop(2);
  const many = nodes.length > 5;
  const nw = v ? (many ? 300 : 380) : many ? 250 : 320;
  const fs = v ? (many ? 40 : 46) : many ? 32 : 38;
  const pos = nodes.map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / nodes.length;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as [number, number];
  });
  return (
    <AbsoluteFill style={{ isolation: "isolate" }}>
      <div style={{ position: "absolute", left: z.x, top: z.y - (v ? 10 : 20), width: z.w, textAlign: "center", zIndex: 6 }}>
        <Label text={s.kicker} />
      </div>
      <svg width={v ? 1080 : 1920} height={v ? 1920 : 1080} style={{ position: "absolute", inset: 0, zIndex: 4 }}>
        {pos.map((p, i) => (
          <PinString key={i} a={[cx, cy]} b={p} from={beat(s, i, 16 + i * 10) - 6} dur={12} />
        ))}
      </svg>
      <div style={{ position: "absolute", left: cx - 150, top: cy - 150, width: 300, height: 300, borderRadius: 150, background: T.accent, transform: `scale(${hub})`, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: T.display ?? T.serif, fontSize: glyphs(s.hub ?? s.hi) > 6 ? 54 : 76, lineHeight: 1.05, color: T.onAccent, zIndex: 5, boxShadow: "0 18px 30px rgba(0,0,0,0.35)", padding: 24 }}>
        {s.hub ?? s.hi}
      </div>
      {pos.map(([x, y], i) => {
        const d0 = beat(s, i, 26 + i * 10);
        const k = spring({ frame: f - d0, fps: 30, config: { damping: 12, stiffness: 160, mass: 0.7 } });
        if (f < d0) return null;
        return (
          <div key={i} style={{ position: "absolute", left: x - nw / 2, top: y - 60, width: nw, zIndex: 6, transform: `scale(${0.7 + 0.3 * k}) rotate(${((i * 37) % 7) - 3}deg)`, opacity: Math.min(1, k * 2) }}>
            <TornPaper seed={hashStr(nodes[i]) + i} color={T.panel} style={{ position: "relative", width: "100%" }} amp={1.6} shadow>
              <div style={{ padding: "16px 18px 20px", fontFamily: T.display ?? T.sans, fontSize: fs, lineHeight: 1.12, color: T.noteInk ?? T.text, textAlign: "center" }}>{nodes[i]}</div>
            </TornPaper>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** typewriter: the line types out big in the centre. */
export const StageTypewriter: React.FC<P> = ({ s, dur = 90 }) => {
  const T = useT();
  const v = useV();
  const f = useCurrentFrame();
  const z = stageZones(v).content;
  const text = s.text ?? s.head ?? "";
  const chars = Array.from(text);
  const end = Math.min(dur - 24, 8 + chars.length * 1.4);
  const n = Math.floor(interpolate(f, [8, Math.max(9, end)], [0, chars.length], cl));
  const size = fitSize([text], z.w, v ? 120 : 110, 0.6) * (glyphs(text) > 12 ? 1.5 : 1);
  return (
    <AbsoluteFill style={{ isolation: "isolate" }}>
      <Zone>
        <Label text={s.kicker} />
        <div style={{ fontFamily: T.typeFace ?? T.sans, fontSize: Math.min(size, v ? 104 : 96), lineHeight: 1.25, color: T.text, maxWidth: "100%" }}>
          {chars.slice(0, n).join("")}
          <span style={{ display: "inline-block", width: "0.45em", height: "0.9em", marginLeft: 6, verticalAlign: "-0.1em", background: T.accent, opacity: n >= chars.length && Math.floor(f / 15) % 2 ? 0 : 1 }} />
        </div>
      </Zone>
    </AbsoluteFill>
  );
};

/** redact: a filed sheet in the centre; lines black out, the key line stays and gets boxed. */
export const StageRedact: React.FC<P> = ({ s }) => {
  const T = useT();
  const v = useV();
  const f = useCurrentFrame();
  const { labels } = useVox();
  const z = stageZones(v).content;
  const w = z.w * (v ? 1 : 0.86);
  const size = fitSize([`${s.head ?? ""}${s.hi ?? ""}`], w - 120, v ? 84 : 80, 0.6) * 1.3;
  const box = interpolate(f, [44, 58], [0, 1], cl);
  return (
    <AbsoluteFill style={{ isolation: "isolate" }}>
      <Zone>
        <div style={{ width: w, transform: "rotate(-1.2deg)" }}>
          <TornPaper seed={hashStr(s.head ?? "r")} color={T.paper} style={{ position: "relative", width: "100%" }} amp={1.2} shadow>
            <div style={{ padding: v ? "44px 50px 50px" : "40px 56px 46px", textAlign: "left" }}>
              <div style={{ fontFamily: T.typeFace ?? "monospace", fontSize: v ? 32 : 28, color: "#2B2824", letterSpacing: 3, marginBottom: 22 }}>{s.kicker ?? labels.file}</div>
              {[0, 1, 2, 3, 4].map((i) => {
                const bar = interpolate(f, [8 + i * 5, 22 + i * 5], [0, 1], cl);
                if (i === 2)
                  return (
                    <div key={i} style={{ position: "relative", margin: "16px 0", padding: "8px 14px 14px", fontFamily: T.display ?? T.serif, fontSize: Math.min(size, v ? 96 : 90), lineHeight: 1.1, color: "#1E1B18" }}>
                      {s.head}
                      {s.hi && <span style={{ color: T.accent }}>{s.hi}</span>}
                      <div style={{ position: "absolute", inset: 0, border: `4px solid ${T.accent}`, opacity: box, transform: `scale(${1.06 - 0.06 * box}) rotate(-0.6deg)` }} />
                    </div>
                  );
                return <div key={i} style={{ height: v ? 34 : 30, margin: "14px 0", background: "#141210", width: `${(72 + ((i * 37) % 26)) * bar}%` }} />;
              })}
            </div>
          </TornPaper>
        </div>
      </Zone>
    </AbsoluteFill>
  );
};

/** end: brand lock-up big in the centre, sign-off lines, and a closing stamp (e.g. "CASE OPEN"). */
export const StageEnd: React.FC<P> = ({ s }) => {
  const T = useT();
  const v = useV();
  const f = useCurrentFrame();
  const beat = useBeat();
  const { brand } = useVox();
  const z = stageZones(v).content;
  const name = (s.head ?? brand?.name ?? "").trim();
  const hi = s.head ? s.hi : brand?.hi;
  const size = fitSize([`${name} ${hi ?? ""}`], z.w, v ? 150 : 150, 0.5);
  const a = usePop(2);
  const items = s.items ?? [];
  const lastBeat = items.length ? beat(s, items.length - 1, 80) : 60;
  return (
    <AbsoluteFill style={{ isolation: "isolate" }}>
      <Zone gap={v ? 26 : 20}>
        <div style={{ fontFamily: T.display ?? T.sans, fontSize: size, lineHeight: 1, color: T.text, transform: `scale(${a})`, textTransform: T.uppercase ? "uppercase" : undefined }}>
          {name} {hi && <TornStrip delay={8}>{hi}</TornStrip>}
        </div>
        {items.map((t, i) => {
          const d = beat(s, i, 30 + i * 30);
          return (
            <div key={i} style={{ opacity: interpolate(f, [d, d + 8], [0, 1], cl), transform: `translateY(${interpolate(f, [d, d + 10], [20, 0], cl)}px)`, fontFamily: T.display ?? T.sans, fontSize: v ? 64 : 56, letterSpacing: 2, color: i === items.length - 1 ? T.accentInk ?? T.accent : T.text }}>
              {t}
            </div>
          );
        })}
        {s.stamp && (
          <div style={{ marginTop: 26 }}>
            <Stamp text={s.stamp} delay={lastBeat + 8} rot={-8} size={v ? 84 : 72} color={T.accentInk ?? T.accent} />
          </div>
        )}
      </Zone>
    </AbsoluteFill>
  );
};

// ---------- persistent chrome for stage themes ----------

/** Caption as a torn paper strip just above the host. */
export const StageSubtitle: React.FC<{ cues: VoxCue[] }> = ({ cues }) => {
  const T = useT();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v = useV();
  const t = f / fps;
  const cue = cues.find((c) => t >= c.s && t < c.e);
  if (!cue) return null;
  const z = stageZones(v).caption;
  const op = interpolate((t - cue.s) * fps, [0, 4], [0, 1], cl);
  const parts = cue.hi && cue.t.includes(cue.hi) ? cue.t.split(cue.hi) : [cue.t];
  // light grounds get an ink strip with cream type; dark grounds a cream strip with ink type
  const hex = T.bg.replace("#", "");
  const lum = (0.299 * parseInt(hex.slice(0, 2), 16) + 0.587 * parseInt(hex.slice(2, 4), 16) + 0.114 * parseInt(hex.slice(4, 6), 16)) / 255;
  const light = lum > 0.5;
  const ink = light ? "#F3EAD6" : "#16130F";
  const strip = light ? "#1A1712" : "#EFE6D2";
  const hiCol = light ? T.accent : T.accentInk ?? T.accent;
  return (
    <div style={{ position: "absolute", left: z.left, right: z.right, bottom: z.bottom, display: "flex", justifyContent: "center", opacity: op, zIndex: 40 }}>
      <div style={{ position: "relative", maxWidth: "100%", transform: `rotate(${(hashStr(cue.t) % 3) - 1}deg)` }}>
        <div style={{ position: "absolute", inset: 0, background: strip, clipPath: tornClip(hashStr(cue.t), { amp: 2.2, steps: 30, edges: "lr" }), boxShadow: "0 8px 14px rgba(0,0,0,0.35)" }} />
        <div style={{ position: "relative", padding: v ? "12px 34px 16px" : "8px 30px 12px", fontFamily: T.sans, fontWeight: 600, fontSize: v ? 40 : 34, lineHeight: 1.42, color: ink, textAlign: "center" }}>
          {parts.length > 1 ? (
            <>
              {parts[0]}
              <span style={{ color: hiCol }}>{cue.hi}</span>
              {parts.slice(1).join(cue.hi)}
            </>
          ) : (
            cue.t
          )}
        </div>
      </div>
    </div>
  );
};

const bustFilter = (T: VoxTheme) =>
  (T.photo === "bw" ? "grayscale(0.85) sepia(0.3) contrast(1.12) brightness(1.02)" : "saturate(0.92) contrast(1.05)") +
  // paper cut-out edge + soft shadow
  " drop-shadow(5px 0 0 #F1E8D4) drop-shadow(-5px 0 0 #F1E8D4) drop-shadow(0 -5px 0 #F1E8D4) drop-shadow(0 18px 24px rgba(0,0,0,0.45))";

/**
 * The host as a cut-out bust (~¼ of the frame) in the bottom-right corner, persistent across cuts:
 * rises in when it first appears, does a small pop when the pose changes, breathes slowly.
 */
export const HostTrack: React.FC<{ scenes: VoxScene[]; ends: number[] }> = ({ scenes, ends }) => {
  const T = useT();
  const asset = useAsset();
  const v = useV();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const i = scenes.findIndex((sc, k) => f >= Math.round(sc.start * fps) && f < ends[k]);
  if (i < 0) return null;
  const sc = scenes[i];
  if (!sc.host || !T.stage) return null;
  const from = Math.round(sc.start * fps);
  const prev = i > 0 ? scenes[i - 1] : undefined;
  const fresh = !prev?.host;
  const changed = !fresh && prev?.host !== sc.host;
  const k = spring({ frame: f - from, fps, config: { damping: 14, stiffness: 120, mass: 0.9 } });
  const pop = changed ? spring({ frame: f - from, fps, config: { damping: 9, stiffness: 220, mass: 0.6 } }) : 1;
  const breathe = 1 + Math.sin(f / 38) * 0.008;
  const z = stageZones(v).host;
  const y = fresh ? (1 - k) * z.h * 0.9 : 0;
  const s = (changed ? 0.93 + 0.07 * pop : 1) * breathe;
  const label = sc.hostLabel;
  return (
    <div style={{ position: "absolute", right: z.right, bottom: z.bottom, width: z.w, height: z.h, zIndex: 30, transform: `translateY(${y}px) scale(${s})`, transformOrigin: "60% 100%" }}>
      <Img src={asset(sc.host)} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 100%", filter: bustFilter(T) }} />
      {label && (
        <div style={{ position: "absolute", left: v ? 40 : 30, top: v ? 40 : 30, transform: "rotate(-5deg)", background: "#E9DDBF", padding: "6px 18px 8px", boxShadow: "0 3px 6px rgba(0,0,0,0.3)", fontFamily: T.typeFace ?? T.sans, fontSize: v ? 32 : 28, letterSpacing: 2, color: "#2A2218" }}>{label}</div>
      )}
    </div>
  );
};
