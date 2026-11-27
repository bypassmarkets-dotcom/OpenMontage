import React from "react";
import { spring, useCurrentFrame } from "remotion";
import { TEX } from "../assets";
import { K, SHADOW, TORN_CLIP, ez, useScale } from "../tokens";

/** The only round thing in the system: a physical pin that drops in with weight. */
export const Pin: React.FC<{ at?: number; color?: "signal" | "thread"; style?: React.CSSProperties }> = ({ at = 0, color = "signal", style }) => {
  const frame = useCurrentFrame();
  const { s, fps } = useScale();
  const land = spring({ frame: frame - at * fps, fps, config: { damping: 11, stiffness: 180 } });
  const c = color === "thread" ? ["#e86a62", K.thread, "#5c100c"] : ["#ff9a6e", K.signal, "#8f2a06"];
  const size = 30 * s;
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 30%, ${c[0]}, ${c[1]} 45%, ${c[2]} 100%)`,
        boxShadow: SHADOW.pin,
        transform: `translateY(${(1 - land) * -40 * s}px) scale(${0.4 + 0.6 * Math.min(land, 1.2)})`,
        opacity: Math.min(1, land * 2),
        zIndex: 2,
        ...style,
      }}
    />
  );
};

/**
 * A sheet of textured paper. It scales 0.9 → 1 while rotating into `rotate`
 * degrees (1–3° is house style). `torn` gives jagged top/bottom edges.
 */
export const PaperCard: React.FC<{
  at?: number;
  rotate?: number;
  torn?: boolean;
  pin?: boolean | "signal" | "thread";
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ at = 0, rotate = -2, torn, pin, style, children }) => {
  const frame = useCurrentFrame();
  const { s, fps } = useScale();
  const p = ez(frame, fps, at, 0.7);
  const card: React.CSSProperties = {
    position: "relative",
    backgroundColor: K.paper150,
    backgroundImage: `url(${TEX.paperTex})`,
    backgroundSize: "cover",
    backgroundBlendMode: "multiply",
    color: K.ink,
    padding: `${40 * s}px ${44 * s}px`,
    clipPath: torn ? TORN_CLIP : undefined,
    ...style,
  };
  return (
    <div
      style={{
        position: "relative",
        transform: `scale(${0.9 + 0.1 * p}) rotate(${rotate + (1 - p) * rotate * 2}deg) translateY(${(1 - p) * 30 * s}px)`,
        opacity: p,
        // drop-shadow (not box-shadow) so a torn clip-path still casts one.
        filter: "drop-shadow(0 18px 30px rgba(0,0,0,.45)) drop-shadow(0 2px 4px rgba(0,0,0,.35))",
      }}
    >
      <div style={card}>{children}</div>
      {pin ? <Pin at={at + 0.35} color={pin === "thread" ? "thread" : "signal"} style={{ left: "50%", top: -10 * s, marginLeft: -15 * s }} /> : null}
    </div>
  );
};
