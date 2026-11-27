import React from "react";
import { spring, useCurrentFrame } from "remotion";
import { FONT, K, LH, TRACK, ez, useScale } from "../tokens";
import { RichText } from "./Text";

/** A vs B with a 2px divider that slams in. The chosen side is outlined orange. */
export const Compare: React.FC<{
  a: { label: string; text: string };
  b: { label: string; text: string };
  chosen?: "a" | "b";
  at?: number;
}> = ({ a, b, chosen = "b", at = 0 }) => {
  const frame = useCurrentFrame();
  const { s, fps, vertical } = useScale();
  const slam = spring({ frame: frame - at * fps, fps, config: { damping: 14, stiffness: 260 } });
  const side = (x: { label: string; text: string }, on: boolean, delay: number) => (
    <div
      style={{
        flex: 1,
        padding: 36 * s,
        border: `${2 * s}px solid ${on ? K.signal : "transparent"}`,
        background: on ? "rgba(255,91,31,.08)" : "transparent",
        opacity: ez(frame, fps, at + delay),
        display: "flex",
        flexDirection: "column",
        gap: 16 * s,
      }}
    >
      <span style={{ fontFamily: FONT.mono, fontWeight: 500, fontSize: 21 * s, letterSpacing: TRACK.kicker, color: on ? K.signal : K.paperA(0.62) }}>{x.label}</span>
      <span style={{ fontFamily: FONT.body, fontWeight: 700, fontSize: 60 * s, lineHeight: LH.snug, color: K.paper }}>
        <RichText text={x.text} />
      </span>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", gap: 40 * s, alignItems: "stretch" }}>
      {side(a, chosen === "a", 0.25)}
      <div
        style={{
          background: K.paper,
          ...(vertical ? { height: 2 * s, transform: `scaleX(${slam})` } : { width: 2 * s, transform: `scaleY(${slam})` }),
        }}
      />
      {side(b, chosen === "b", 0.5)}
    </div>
  );
};
