import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SCENES, CUES, DURATION, type SceneDef } from "./VoxDocData";

// KRITLIFE TECH — VOX-style documentary. Dark investigative palette, one red accent.
// Narration is the locked master: audio at frame 0, every scene/cue timed in seconds from the transcript.
export const FPS = 30;
export const VOX_TOTAL = Math.round(DURATION * FPS);

export const D = {
  bg: "#111214",
  bg2: "#1A1B1E",
  panel: "#202125",
  line: "#2E2F34",
  text: "#EDE8E1",
  dim: "#9A948C",
  red: "#E0483A",
  redSoft: "rgba(224,72,58,0.18)",
  paper: "#D9D2C5",
};
const SERIF = "'Noto Serif Thai', serif";
const SANS = "'Noto Sans Thai', sans-serif";
const cl = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const vox = (f: string) => staticFile(`kritlife/vox/${f}`);

const useV = () => {
  const { width, height } = useVideoConfig();
  return height > width;
};
const useSp = (delay = 0, cfg = { damping: 18, stiffness: 110, mass: 0.9 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: cfg });
};
// design space: 1920x1080 (16:9) or 1080x1920 (9:16); this scales to the real canvas
const Design: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useVideoConfig();
  const v = height > width;
  const k = width / (v ? 1080 : 1920);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: v ? 1080 : 1920, height: v ? 1920 : 1080, transform: `scale(${k})`, transformOrigin: "top left" }}>
      {children}
    </div>
  );
};

const Rise: React.FC<{ delay?: number; children: React.ReactNode; dy?: number; style?: React.CSSProperties }> = ({ delay = 0, children, dy = 36, style }) => {
  const s = useSp(delay);
  return <div style={{ opacity: s, transform: `translateY(${(1 - s) * dy}px)`, ...style }}>{children}</div>;
};

// ---------- persistent chrome ----------
const Grain: React.FC = () => {
  const f = useCurrentFrame();
  const seed = f % 8;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.07, mixBlendMode: "screen" }}>
        <filter id={`g${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.9 0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#g${seed})`} />
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.62) 100%)" }} />
    </AbsoluteFill>
  );
};
const GridBg: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: D.bg }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${D.line} 1px, transparent 1px), linear-gradient(90deg, ${D.line} 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          backgroundPosition: `${(f * 0.15) % 80}px 0px`,
          opacity: 0.35,
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 70% 30%, ${D.redSoft}, transparent 55%)` }} />
    </AbsoluteFill>
  );
};
const Brand: React.FC = () => {
  const v = useV();
  return (
    <div style={{ position: "absolute", top: v ? 120 : 48, left: v ? 0 : 70, right: v ? 0 : undefined, display: "flex", justifyContent: v ? "center" : "flex-start", alignItems: "center", gap: 12, fontFamily: SANS, fontWeight: 700, fontSize: v ? 26 : 20, letterSpacing: 2, color: D.dim }}>
      <div style={{ width: v ? 14 : 11, height: v ? 14 : 11, background: D.red, borderRadius: 2, transform: "rotate(45deg)" }} />
      KRITLIFE TECH
    </div>
  );
};
const Chapter: React.FC<{ label?: string }> = ({ label }) => {
  const v = useV();
  if (!label) return null;
  return (
    <div style={{ position: "absolute", top: v ? 120 : 48, right: v ? undefined : 70, left: v ? -9999 : undefined, fontFamily: SANS, fontWeight: 600, fontSize: 20, letterSpacing: 2, color: D.dim, display: v ? "none" : "block" }}>
      {label}
    </div>
  );
};
const IllusTag: React.FC = () => {
  const v = useV();
  return (
    <div style={{ position: "absolute", right: v ? 70 : 70, top: v ? 180 : 100, fontFamily: SANS, fontSize: v ? 24 : 18, fontWeight: 600, color: D.dim, background: "rgba(0,0,0,0.55)", padding: "4px 14px 6px", borderRadius: 8, border: `1px solid ${D.line}` }}>
      ภาพประกอบ
    </div>
  );
};

// ---------- subtitle pill ----------
const Subtitle: React.FC = () => {
  const f = useCurrentFrame();
  const v = useV();
  const t = f / FPS;
  const cue = CUES.find((c) => t >= c.s && t < c.e);
  if (!cue) return null;
  const local = (t - cue.s) * FPS;
  const op = interpolate(local, [0, 4], [0, 1], cl);
  const parts = cue.hi && cue.t.includes(cue.hi) ? cue.t.split(cue.hi) : [cue.t];
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: v ? 400 : 70, display: "flex", justifyContent: "center", opacity: op }}>
      <div style={{ maxWidth: v ? "86%" : "78%", background: "rgba(10,10,12,0.82)", border: `1px solid ${D.line}`, borderRadius: 14, padding: v ? "12px 28px 18px" : "8px 26px 14px", fontFamily: SANS, fontWeight: 600, fontSize: v ? 40 : 34, lineHeight: 1.45, color: D.text, textAlign: "center" }}>
        {parts.length > 1 ? (
          <>
            {parts[0]}
            <span style={{ color: D.red }}>{cue.hi}</span>
            {parts.slice(1).join(cue.hi)}
          </>
        ) : (
          cue.t
        )}
      </div>
    </div>
  );
};

// ---------- building blocks ----------
const Kicker: React.FC<{ text: string; delay?: number }> = ({ text, delay = 0 }) => {
  const s = useSp(delay);
  const v = useV();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, opacity: s, justifyContent: v ? "center" : "flex-start" }}>
      <div style={{ width: 60 * s, height: 4, background: D.red }} />
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: v ? 32 : 26, letterSpacing: 3, color: D.red }}>{text}</div>
    </div>
  );
};
const Head: React.FC<{ a?: string; hi?: string; b?: string; size?: number; delay?: number }> = ({ a = "", hi, b, size = 96, delay = 6 }) => {
  const v = useV();
  return (
    <Rise delay={delay}>
      <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: v ? size * 0.95 : size, lineHeight: 1.32, color: D.text, textAlign: v ? "center" : "left", textWrap: "balance" as any }}>
        {a}
        {hi && <Hi delay={delay + 14}>{hi}</Hi>}
        {b}
      </div>
    </Rise>
  );
};
// red marker-underline highlight that draws in
const Hi: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const s = useSp(delay, { damping: 22, stiffness: 90, mass: 1 });
  return (
    <span style={{ position: "relative", color: D.text, whiteSpace: "nowrap" }}>
      <span style={{ position: "absolute", left: -6, right: -6, bottom: "8%", height: "34%", background: D.red, opacity: 0.85, transformOrigin: "left", transform: `scaleX(${s})`, zIndex: 0 }} />
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </span>
  );
};
const Col: React.FC<{ children: React.ReactNode; top16?: number; top9?: number; w?: number }> = ({ children, top16 = 260, top9 = 300, w = 1100 }) => {
  const v = useV();
  return <div style={v ? { position: "absolute", top: top9, left: 80, right: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 } : { position: "absolute", top: top16, left: 160, width: w, display: "flex", flexDirection: "column", gap: 22 }}>{children}</div>;
};

// ---------- scene renderers ----------
const SceneWrap: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame();
  const op = interpolate(f, [0, 8, dur - 8, dur], [0, 1, 1, 0], cl);
  return <AbsoluteFill style={{ opacity: op }}>{children}</AbsoluteFill>;
};

const Title: React.FC<{ s: SceneDef }> = ({ s }) => (
  <Col top16={s.items ? 230 : 330} top9={s.items ? 330 : 520}>
    {s.kicker && <Kicker text={s.kicker} />}
    <Head a={s.head} hi={s.hi} b={s.tail} size={s.size ?? 100} />
    {s.sub && (
      <Rise delay={30}>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 36, color: D.dim, lineHeight: 1.5 }}>{s.sub}</div>
      </Rise>
    )}
    {s.items && <Items s={s} />}
  </Col>
);

const Items: React.FC<{ s: SceneDef }> = ({ s }) => {
  const v = useV();
  const at = s.at ?? s.items!.map((_, i) => 24 + i * 24);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: v ? 22 : 18, marginTop: 20, width: v ? "100%" : undefined }}>
      {s.items!.map((it, i) => (
        <Rise key={i} delay={Math.round((at[i] - (s.start)) * FPS) > 0 && s.at ? Math.round((at[i] - s.start) * FPS) : at[i]} dy={20}>
          <div style={{ display: "flex", alignItems: "center", gap: 22, background: D.panel, border: `1px solid ${D.line}`, borderLeft: `6px solid ${D.red}`, borderRadius: 10, padding: v ? "18px 28px 24px" : "14px 26px 20px" }}>
            <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: v ? 44 : 38, color: D.red, minWidth: 54 }}>{String(i + 1).padStart(2, "0")}</div>
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: v ? 40 : 34, color: D.text, lineHeight: 1.4 }}>{it}</div>
          </div>
        </Rise>
      ))}
    </div>
  );
};

const Photo: React.FC<{ s: SceneDef; dur: number }> = ({ s, dur }) => {
  const f = useCurrentFrame();
  const v = useV();
  const p = f / dur;
  const scale = 1.08 + 0.12 * p;
  const [ox, oy] = s.focus ?? [50, 50];
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img src={vox(s.img!)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${ox}% ${oy}%`, transform: `scale(${scale})`, transformOrigin: `${ox}% ${oy}%`, filter: "saturate(0.85) contrast(1.05)" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: v ? "linear-gradient(180deg, rgba(10,10,12,0.85) 0%, rgba(10,10,12,0.25) 40%, rgba(10,10,12,0.35) 65%, rgba(10,10,12,0.9) 100%)" : "linear-gradient(90deg, rgba(10,10,12,0.92) 0%, rgba(10,10,12,0.55) 45%, rgba(10,10,12,0.15) 100%)" }} />
      <IllusTag />
      {(s.head || s.kicker) && (
        <Col top16={s.items ? 230 : 360} top9={260} w={900}>
          {s.kicker && <Kicker text={s.kicker} />}
          {s.head && <Head a={s.head} hi={s.hi} b={s.tail} size={s.size ?? 88} />}
          {s.items && <Items s={s} />}
        </Col>
      )}
    </AbsoluteFill>
  );
};

// dossier: lines of text get blacked out, one phrase stays revealed in a red frame
const Redact: React.FC<{ s: SceneDef }> = ({ s }) => {
  const f = useCurrentFrame();
  const v = useV();
  const rows = 7;
  const keep = 4;
  const w = v ? 900 : 1000;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: v ? 90 : 460, top: v ? 520 : 170, width: w, background: D.paper, borderRadius: 6, padding: "50px 60px", boxShadow: "0 40px 80px rgba(0,0,0,0.6)", transform: `rotate(-1.2deg)` }}>
        <div style={{ fontFamily: "monospace", fontSize: 26, color: "#2B2824", letterSpacing: 2, marginBottom: 26 }}>{s.kicker ?? "FILE // KRITLIFE TECH"}</div>
        {Array.from({ length: rows }).map((_, i) => {
          const bar = interpolate(f, [10 + i * 5, 24 + i * 5], [0, 1], cl);
          if (i === keep) {
            const box = interpolate(f, [50, 64], [0, 1], cl);
            return (
              <div key={i} style={{ position: "relative", margin: "18px 0", padding: "10px 16px 16px", fontFamily: SERIF, fontWeight: 800, fontSize: v ? 50 : 54, color: "#1E1B18", lineHeight: 1.3 }}>
                {s.head}
                {s.hi && <span style={{ color: D.red }}>{s.hi}</span>}
                <div style={{ position: "absolute", inset: 0, border: `3px solid ${D.red}`, boxShadow: `0 0 24px ${D.red}`, opacity: box, transform: `scale(${1.08 - 0.08 * box})` }} />
              </div>
            );
          }
          return <div key={i} style={{ height: 30, margin: "16px 0", background: "#141210", width: `${(70 + ((i * 37) % 28)) * bar}%`, borderRadius: 3 }} />;
        })}
      </div>
    </AbsoluteFill>
  );
};

const Split: React.FC<{ s: SceneDef }> = ({ s }) => {
  const v = useV();
  const box = (side: { label: string; text: string }, i: number) => (
    <Rise key={i} delay={10 + i * 26} style={{ flex: 1 }}>
      <div style={{ height: "100%", background: i ? D.redSoft : D.panel, border: `2px solid ${i ? D.red : D.line}`, borderRadius: 16, padding: "34px 40px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 28, letterSpacing: 2, color: i ? D.red : D.dim }}>{side.label}</div>
        <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: v ? 54 : 52, lineHeight: 1.35, color: D.text }}>{side.text}</div>
      </div>
    </Rise>
  );
  return (
    <>
      <Col top16={170} top9={270} w={1600}>
        {s.kicker && <Kicker text={s.kicker} />}
      </Col>
      <div style={{ position: "absolute", left: v ? 80 : 160, right: v ? 80 : 160, top: v ? 380 : 270, height: v ? 960 : 520, display: "flex", flexDirection: v ? "column" : "row", gap: 36 }}>
        {box(s.left!, 0)}
        {box(s.right!, 1)}
      </div>
    </>
  );
};

// node graph with red connector lines drawing between labelled nodes
const Network: React.FC<{ s: SceneDef }> = ({ s }) => {
  const f = useCurrentFrame();
  const v = useV();
  const nodes = s.items ?? [];
  const W = v ? 1080 : 1920;
  const cx = v ? 540 : 1220, cy = v ? 900 : 560, R = v ? 340 : 330;
  const pos = nodes.map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / nodes.length;
    return [cx + R * Math.cos(a) * (v ? 1 : 1.25), cy + R * Math.sin(a) * (v ? 1.1 : 0.85)];
  });
  const hubS = useSp(4);
  return (
    <>
      {s.kicker && (
        <Col top16={200} top9={260} w={560}>
          <Kicker text={s.kicker} />
          {!v && s.head && <Head a={s.head} hi={s.hi} b={s.tail} size={70} />}
        </Col>
      )}
      <svg width={W} height={v ? 1920 : 1080} style={{ position: "absolute", left: 0, top: 0 }}>
        {pos.map(([x, y], i) => {
          const p = interpolate(f, [14 + i * 10, 34 + i * 10], [0, 1], cl);
          return <line key={i} x1={cx} y1={cy} x2={cx + (x - cx) * p} y2={cy + (y - cy) * p} stroke={D.red} strokeWidth={3} strokeDasharray="10 8" opacity={0.85} />;
        })}
      </svg>
      <div style={{ position: "absolute", left: cx - 120, top: cy - 120, width: 240, height: 240, borderRadius: 120, background: D.red, opacity: hubS, transform: `scale(${hubS})`, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: SERIF, fontWeight: 800, fontSize: 38, lineHeight: 1.3, color: "#fff", boxShadow: `0 0 60px ${D.red}`, padding: 20 }}>
        {s.hub ?? s.hi}
      </div>
      {pos.map(([x, y], i) => {
        const sp = interpolate(f, [26 + i * 10, 40 + i * 10], [0, 1], cl);
        return (
          <div key={i} style={{ position: "absolute", left: x - 150, top: y - 50, width: 300, minHeight: 100, opacity: sp, transform: `scale(${0.8 + 0.2 * sp})`, background: D.panel, border: `2px solid ${D.line}`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "10px 18px 16px", fontFamily: SANS, fontWeight: 700, fontSize: v ? 34 : 30, lineHeight: 1.35, color: D.text }}>
            {nodes[i]}
          </div>
        );
      })}
    </>
  );
};

const Big: React.FC<{ s: SceneDef }> = ({ s }) => {
  const v = useV();
  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: v ? "0 80px 500px" : "0 200px 80px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 28, alignItems: "center", textAlign: "center" }}>
        {s.kicker && <Kicker text={s.kicker} />}
        <Rise delay={6}>
          <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: v ? (s.size ?? 120) * 0.9 : s.size ?? 120, lineHeight: 1.3, color: D.text }}>
            {s.head}
            {s.hi && <Hi delay={20}>{s.hi}</Hi>}
            {s.tail}
          </div>
        </Rise>
        {s.sub && (
          <Rise delay={30}>
            <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: v ? 40 : 36, color: D.dim }}>{s.sub}</div>
          </Rise>
        )}
      </div>
    </AbsoluteFill>
  );
};

const renderScene = (s: SceneDef, dur: number) => {
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
    default:
      return <Title s={s} />;
  }
};

export const VoxDoc: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: D.bg }}>
      <Audio src={vox("mix.wav")} />
      <Design>
        <GridBg />
        {SCENES.map((s, i) => {
          const from = Math.round(s.start * FPS);
          const end = Math.round((SCENES[i + 1]?.start ?? DURATION) * FPS);
          const dur = end - from;
          return (
            <Sequence key={i} from={from} durationInFrames={dur}>
              <SceneWrap dur={dur}>
                {s.type !== "photo" && <GridBg />}
                {renderScene(s, dur)}
                <Chapter label={s.chapter} />
              </SceneWrap>
            </Sequence>
          );
        })}
        <Brand />
        <Subtitle />
        <Grain />
      </Design>
    </AbsoluteFill>
  );
};
