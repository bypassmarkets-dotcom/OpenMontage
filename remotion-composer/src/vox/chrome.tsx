// Persistent Vox chrome + typographic building blocks (all theme-driven).
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { cl, useSp, useT, useV, useVox, type VoxCue } from "./theme";

// design space: 1920x1080 (16:9) or 1080x1920 (9:16); this scales to the real canvas
export const Design: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useVideoConfig();
  const v = height > width;
  const k = width / (v ? 1080 : 1920);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: v ? 1080 : 1920, height: v ? 1920 : 1080, transform: `scale(${k})`, transformOrigin: "top left" }}>
      {children}
    </div>
  );
};

export const Rise: React.FC<{ delay?: number; children: React.ReactNode; dy?: number; style?: React.CSSProperties }> = ({ delay = 0, children, dy = 36, style }) => {
  const s = useSp(delay);
  return <div style={{ opacity: s, transform: `translateY(${(1 - s) * dy}px)`, ...style }}>{children}</div>;
};

export const Grain: React.FC = () => {
  const T = useT();
  const f = useCurrentFrame();
  const seed = f % 8;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {T.grainOpacity > 0 && (
        <svg width="100%" height="100%" style={{ position: "absolute", opacity: T.grainOpacity, mixBlendMode: T.grainBlend }}>
          <filter id={`g${seed}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} />
            <feColorMatrix values={T.grainBlend === "multiply" ? "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0" : "0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.9 0"} />
          </filter>
          <rect width="100%" height="100%" filter={`url(#g${seed})`} />
        </svg>
      )}
      {T.vignette > 0 && <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${T.vignette}) 100%)` }} />}
    </AbsoluteFill>
  );
};

export const GridBg: React.FC = () => {
  const T = useT();
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: T.bg }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${T.line} 1px, transparent 1px), linear-gradient(90deg, ${T.line} 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          backgroundPosition: `${(f * 0.15) % 80}px 0px`,
          opacity: T.gridOpacity,
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 70% 30%, ${T.accentSoft}, transparent 55%)` }} />
    </AbsoluteFill>
  );
};

export const Brand: React.FC = () => {
  const T = useT();
  const { brand } = useVox();
  const v = useV();
  if (!brand) return null;
  return (
    <div style={{ position: "absolute", top: v ? 120 : 48, left: v ? 0 : 70, right: v ? 0 : undefined, display: "flex", justifyContent: v ? "center" : "flex-start", alignItems: "center", gap: 12, fontFamily: T.sans, fontWeight: 700, fontSize: v ? 26 : 20, letterSpacing: 2, color: T.dim }}>
      <div style={{ width: v ? 14 : 11, height: v ? 14 : 11, background: T.accent, borderRadius: 2, transform: "rotate(45deg)" }} />
      {`${brand.name}${brand.hi ?? ""}`.trim()}
    </div>
  );
};

export const BrandUntil: React.FC<{ t: number }> = ({ t }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return f / fps < t ? <Brand /> : null;
};

export const Chapter: React.FC<{ label?: string }> = ({ label }) => {
  const T = useT();
  const v = useV();
  if (!label || v) return null;
  return <div style={{ position: "absolute", top: 48, right: 70, fontFamily: T.sans, fontWeight: 600, fontSize: 20, letterSpacing: 2, color: T.dim }}>{label}</div>;
};

export const IllusTag: React.FC = () => {
  const T = useT();
  const { labels } = useVox();
  const v = useV();
  if (!labels.illustration) return null;
  return (
    <div style={{ position: "absolute", right: 70, top: v ? 180 : 100, fontFamily: T.sans, fontSize: v ? 24 : 18, fontWeight: 600, color: T.dim, background: T.tagBg, padding: "4px 14px 6px", borderRadius: 8, border: `1px solid ${T.line}` }}>
      {labels.illustration}
    </div>
  );
};

/** small CC attribution line, bottom-left of image scenes */
export const CreditTag: React.FC<{ credit?: string }> = ({ credit }) => {
  const T = useT();
  const v = useV();
  if (!credit) return null;
  return (
    <div style={{ position: "absolute", left: v ? 60 : 70, right: v ? 60 : undefined, bottom: v ? 330 : 26, maxWidth: v ? undefined : 900, fontFamily: T.sans, fontSize: v ? 18 : 15, fontWeight: 500, color: T.dim, opacity: 0.9, background: T.tagBg, padding: "3px 10px 5px", borderRadius: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {credit}
    </div>
  );
};

export const Subtitle: React.FC<{ cues: VoxCue[] }> = ({ cues }) => {
  const T = useT();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v = useV();
  const t = f / fps;
  const cue = cues.find((c) => t >= c.s && t < c.e);
  if (!cue) return null;
  const local = (t - cue.s) * fps;
  const op = interpolate(local, [0, 4], [0, 1], cl);
  const parts = cue.hi && cue.t.includes(cue.hi) ? cue.t.split(cue.hi) : [cue.t];
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: v ? 400 : 70, display: "flex", justifyContent: "center", opacity: op }}>
      <div style={{ maxWidth: v ? "86%" : "78%", background: `rgba(${T.shade},0.82)`, border: `1px solid ${T.line}`, borderRadius: 14, padding: v ? "12px 28px 18px" : "8px 26px 14px", fontFamily: T.sans, fontWeight: 600, fontSize: v ? 40 : 34, lineHeight: 1.45, color: T.text, textAlign: "center" }}>
        {parts.length > 1 ? (
          <>
            {parts[0]}
            <span style={{ color: T.accentInk }}>{cue.hi}</span>
            {parts.slice(1).join(cue.hi)}
          </>
        ) : (
          cue.t
        )}
      </div>
    </div>
  );
};

export const Kicker: React.FC<{ text: string; delay?: number }> = ({ text, delay = 0 }) => {
  const T = useT();
  const s = useSp(delay);
  const v = useV();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, opacity: s, justifyContent: v ? "center" : "flex-start" }}>
      <div style={{ width: 60 * s, height: 4, background: T.accent }} />
      <div style={{ fontFamily: T.sans, fontWeight: 700, fontSize: v ? 32 : 26, letterSpacing: 3, color: T.accentInk }}>{text}</div>
    </div>
  );
};

// accent marker-underline highlight that draws in
export const Hi: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const T = useT();
  const s = useSp(delay, { damping: 22, stiffness: 90, mass: 1 });
  return (
    <span style={{ position: "relative", color: T.text, whiteSpace: "nowrap" }}>
      <span style={{ position: "absolute", left: -6, right: -6, bottom: "8%", height: "34%", background: T.accent, opacity: 0.85, transformOrigin: "left", transform: `scaleX(${s})`, zIndex: 0 }} />
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </span>
  );
};

export const Head: React.FC<{ a?: string; hi?: string; b?: string; size?: number; delay?: number }> = ({ a = "", hi, b, size = 96, delay = 6 }) => {
  const T = useT();
  const v = useV();
  return (
    <Rise delay={delay}>
      <div style={{ fontFamily: T.serif, fontWeight: 800, fontSize: v ? size * 0.95 : size, lineHeight: 1.32, color: T.text, textAlign: v ? "center" : "left", textWrap: "balance" as any }}>
        {a}
        {hi && <Hi delay={delay + 14}>{hi}</Hi>}
        {b}
      </div>
    </Rise>
  );
};

export const Col: React.FC<{ children: React.ReactNode; top16?: number; top9?: number; w?: number }> = ({ children, top16 = 260, top9 = 300, w = 1100 }) => {
  const v = useV();
  return (
    <div style={v ? { position: "absolute", top: top9, left: 80, right: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 } : { position: "absolute", top: top16, left: 160, width: w, display: "flex", flexDirection: "column", gap: 22 }}>
      {children}
    </div>
  );
};

export const SceneWrap: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame();
  const op = interpolate(f, [0, 8, dur - 8, dur], [0, 1, 1, 0], cl);
  return <AbsoluteFill style={{ opacity: op }}>{children}</AbsoluteFill>;
};
