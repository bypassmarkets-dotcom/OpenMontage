import React from "react";
import { useCurrentFrame } from "remotion";
import { EASE, FONT, K, T, TRACK, ez, useScale } from "../tokens";

type Run = { text: string; kind: "plain" | "accent" | "dim" | "strike" };

/** Inline markup: [accent] · {dim} · ~strike~ — same as SIGNAL's parseMark. */
export const parseMark = (src: string): Run[] => {
  const runs: Run[] = [];
  const re = /\[([^\]]+)\]|\{([^}]+)\}|~([^~]+)~/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) runs.push({ text: src.slice(last, m.index), kind: "plain" });
    if (m[1] !== undefined) runs.push({ text: m[1], kind: "accent" });
    else if (m[2] !== undefined) runs.push({ text: m[2], kind: "dim" });
    else runs.push({ text: m[3], kind: "strike" });
    last = re.lastIndex;
  }
  if (last < src.length) runs.push({ text: src.slice(last), kind: "plain" });
  return runs;
};

export const RichText: React.FC<{ text: string; onPaper?: boolean }> = ({ text, onPaper }) => {
  const { s } = useScale();
  const accent = onPaper ? K.signalDeep : K.signal;
  return (
    <>
      {parseMark(text).map((r, i) => {
        if (r.kind === "accent") return <span key={i} style={{ color: accent }}>{r.text}</span>;
        if (r.kind === "dim")
          return <span key={i} style={{ color: onPaper ? K.inkA(0.5) : K.paperA(0.5), fontWeight: 400 }}>{r.text}</span>;
        if (r.kind === "strike")
          return (
            <span key={i} style={{ textDecoration: "line-through", textDecorationColor: accent, textDecorationThickness: 4 * s }}>
              {r.text}
            </span>
          );
        return <React.Fragment key={i}>{r.text}</React.Fragment>;
      })}
    </>
  );
};

/** Rise = the words are NEW (being spoken). Mask + translateY 108% → 0. */
export const Rise: React.FC<{ at?: number; d?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  at = 0,
  d = 0.7,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useScale();
  const p = ez(frame, fps, at, d);
  return (
    <div style={{ overflow: "hidden", paddingBottom: "0.08em", ...style }}>
      <div style={{ transform: `translateY(${(1 - p) * 108}%)` }}>{children}</div>
    </div>
  );
};

/** Focus = the words were FOUND (already on the evidence). Blur 10 → 0, opacity .13 → 1. */
export const Focus: React.FC<{ at?: number; d?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  at = 0,
  d = 0.9,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const { s, fps } = useScale();
  const p = ez(frame, fps, at, d, EASE.outCubic);
  return (
    <div style={{ filter: `blur(${(1 - p) * 10 * s}px)`, opacity: 0.13 + 0.87 * p, transform: `translateY(${(1 - p) * 8 * s}px)`, ...style }}>
      {children}
    </div>
  );
};

/** Mono kicker with a rule that grows after the label. */
export const Kicker: React.FC<{ children: React.ReactNode; at?: number; color?: string }> = ({ children, at = 0, color = K.signal }) => {
  const frame = useCurrentFrame();
  const { s, fps } = useScale();
  const p = ez(frame, fps, at, 0.6);
  const rule = ez(frame, fps, at + 0.2, 0.8);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16 * s,
        fontFamily: FONT.mono,
        fontWeight: 500,
        fontSize: T.kicker * s,
        letterSpacing: TRACK.kicker,
        textTransform: "uppercase",
        color,
        opacity: p,
      }}
    >
      <span>{children}</span>
      <span style={{ width: 96 * s * rule, height: 2 * s, background: color }} />
    </div>
  );
};

/** Square chip. `on` = the selected one, filled orange with ink text. Lands with out-back. */
export const Chip: React.FC<{ children: React.ReactNode; on?: boolean; at?: number }> = ({ children, on, at = 0 }) => {
  const frame = useCurrentFrame();
  const { s, fps } = useScale();
  const p = ez(frame, fps, at, 0.45, EASE.outBack);
  return (
    <span
      style={{
        display: "inline-flex",
        padding: `${10 * s}px ${22 * s}px`,
        border: `${2 * s}px solid ${on ? K.signal : K.paperA(0.3)}`,
        background: on ? K.signal : "transparent",
        color: on ? K.ink : K.paper,
        fontFamily: FONT.body,
        fontWeight: 600,
        fontSize: 30 * s,
        transform: `scale(${0.6 + 0.4 * p})`,
        opacity: Math.min(1, p * 1.5),
      }}
    >
      {children}
    </span>
  );
};

/**
 * Vox highlighter: an orange swipe wipes left→right behind the words, then
 * the text flips to ink. Use on ONE phrase per frame.
 */
export const Highlighter: React.FC<{ children: React.ReactNode; at?: number; d?: number }> = ({ children, at = 0, d = 0.47 }) => {
  const frame = useCurrentFrame();
  const { fps } = useScale();
  const p = ez(frame, fps, at, d, EASE.outCubic);
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(100deg, transparent 0 1%, ${K.signal} 2% 97%, transparent 99%)`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${p * 100}% 100%`,
        padding: "0 0.12em",
        margin: "0 -0.04em",
        WebkitBoxDecorationBreak: "clone",
        boxDecorationBreak: "clone",
        color: p > 0.55 ? K.ink : "inherit",
      }}
    >
      {children}
    </span>
  );
};

/** Mono provenance line. Mandatory under every data / timeline graphic. */
export const Source: React.FC<{ children: React.ReactNode; at?: number; onPaper?: boolean }> = ({ children, at = 0, onPaper }) => {
  const frame = useCurrentFrame();
  const { s, fps } = useScale();
  return (
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize: 18 * s,
        letterSpacing: TRACK.source,
        color: onPaper ? K.inkA(0.66) : K.paperA(0.62),
        opacity: ez(frame, fps, at, 0.6),
      }}
    >
      {children}
    </div>
  );
};
