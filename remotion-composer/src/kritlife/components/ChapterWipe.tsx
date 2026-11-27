import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE, FONT, K, TRACK, ez, useScale } from "../tokens";

/**
 * The one place orange is a background: a full-bleed panel that wipes in
 * left→right, holds the chapter numeral, then wipes out. Place it in a
 * <Sequence> of ~2.6s spanning the cut.
 */
export const ChapterWipe: React.FC<{ n: string; of: string; title: string; thai?: string }> = ({ n, of, title, thai }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const { s, pad, safeBottom } = useScale();
  const dur = durationInFrames / fps;
  const inP = ez(frame, fps, 0, 0.5, EASE.inOutCubic);
  const outP = ez(frame, fps, dur - 0.45, 0.45, EASE.inOutCubic);
  const left = outP * 100;
  const right = (1 - inP) * 100;
  const num = ez(frame, fps, 0.3, 0.7);
  return (
    <AbsoluteFill style={{ clipPath: `inset(0 ${right}% 0 ${left}%)`, background: K.signal, color: K.ink }}>
      <div style={{ position: "absolute", left: pad, top: 60 * s, fontFamily: FONT.mono, fontWeight: 500, fontSize: 24 * s, letterSpacing: TRACK.kicker }}>
        CH {n} / {of}
      </div>
      <div
        style={{
          position: "absolute",
          left: pad - 20 * s,
          top: "50%",
          transform: `translateY(-50%) translateX(${(1 - num) * -80 * s}px)`,
          fontFamily: FONT.display,
          fontSize: 380 * s,
          lineHeight: 0.8,
          letterSpacing: "-0.02em",
        }}
      >
        {n}
      </div>
      <div style={{ position: "absolute", left: pad, right: pad, bottom: safeBottom + 70 * s, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <span style={{ fontFamily: FONT.mono, fontWeight: 500, fontSize: 34 * s, letterSpacing: TRACK.kicker }}>{title}</span>
        {thai ? <span style={{ fontFamily: FONT.body, fontWeight: 700, fontSize: 48 * s }}>{thai}</span> : null}
      </div>
    </AbsoluteFill>
  );
};
