import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONT, K, TRACK, ez, useScale } from "../tokens";

/**
 * Persistent chrome: ■ KRITLIFE TECH top-left, chapter label top-right, a 2px
 * progress rule with chapter ticks. Fades in at 0.8–1.0s and never moves.
 */
export const Chrome: React.FC<{
  chapter: string; // e.g. "CH 03 / 06 — THE MIND"
  progress: number; // 0..1 through the film
  ticks?: number; // chapter count
  footer?: string; // e.g. "F 000842 · 1080×1920 · 30FPS · TH"
}> = ({ chapter, progress, ticks = 6, footer }) => {
  const frame = useCurrentFrame();
  const { s, fps, pad, safeBottom, vertical } = useScale();
  const o = ez(frame, fps, 0.8, 0.2);
  const label: React.CSSProperties = {
    fontFamily: FONT.mono,
    fontWeight: 500,
    fontSize: 21 * s,
    letterSpacing: TRACK.label,
    textTransform: "uppercase",
  };
  return (
    <AbsoluteFill style={{ opacity: o, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: pad, right: pad, top: 44 * s, display: "flex", justifyContent: "space-between", color: K.paper, ...label }}>
        <span>
          <span style={{ color: K.signal }}>■</span> KRITLIFE TECH
        </span>
        <span style={{ color: K.paperA(0.72) }}>{chapter}</span>
      </div>
      <div style={{ position: "absolute", left: pad, right: pad, top: 92 * s, height: 2 * s, background: K.paperA(0.16) }}>
        <div style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%`, height: "100%", background: K.signal }} />
        {Array.from({ length: ticks - 1 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: `${((i + 1) / ticks) * 100}%`, top: -4 * s, width: 2 * s, height: 10 * s, background: K.paperA(0.3) }} />
        ))}
      </div>
      {footer ? (
        // 9:16: under the progress rule, clear of the caption band; 16:9: bottom-left.
        <div style={{ position: "absolute", left: pad, ...(vertical ? { top: 112 * s } : { bottom: safeBottom + 40 * s }), color: K.paperA(0.62), ...label, fontSize: 16 * s }}>{footer}</div>
      ) : null}
    </AbsoluteFill>
  );
};
