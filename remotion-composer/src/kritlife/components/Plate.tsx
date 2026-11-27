import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { K, PHOTO_GRADE } from "../tokens";

/**
 * Graded B-roll plate with a slow push-in (1.0 → 1.13 over 10s) and gradient
 * protection for left-aligned text. Never a capsule behind text.
 */
export const Plate: React.FC<{ src: string; protect?: "left" | "full" | "none"; dim?: number; children?: React.ReactNode }> = ({
  src,
  protect = "left",
  dim = 0.34,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = interpolate(frame, [0, 10 * fps], [1, 1.13], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: K.ink600, overflow: "hidden" }}>
      <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", filter: PHOTO_GRADE, transform: `scale(${scale})` }} />
      <AbsoluteFill style={{ background: K.plateA(dim) }} />
      {protect === "left" ? <AbsoluteFill style={{ background: `linear-gradient(90deg, ${K.plateA(0.85)}, transparent 58%)` }} /> : null}
      {protect === "full" ? <AbsoluteFill style={{ background: K.plateA(0.55) }} /> : null}
      {children}
    </AbsoluteFill>
  );
};
