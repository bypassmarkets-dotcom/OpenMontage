import React from "react";
import { Img, useCurrentFrame } from "remotion";
import { HOST, HostPose } from "../assets";
import { PHOTO_GRADE, ez, useScale } from "../tokens";

/**
 * Vox-style host: a background-removed pose with a paper "cut" outline and a
 * cast shadow, as if cut out of a magazine. Breathes with a hand-held drift.
 */
export const HostCutout: React.FC<{
  pose?: HostPose;
  at?: number;
  size?: number; // px at 1080
  rotate?: number;
  style?: React.CSSProperties;
}> = ({ pose = "front", at = 0, size = 900, rotate = -1.5, style }) => {
  const frame = useCurrentFrame();
  const { s, fps } = useScale();
  const t = frame / fps;
  const p = ez(frame, fps, at, 0.7);
  const breathX = (4 * Math.sin(0.71 * t) + 2 * Math.sin(1.93 * t + 2)) * s;
  const breathY = 3 * Math.sin(0.53 * t + 1) * s;
  const outline = 9 * s;
  return (
    <Img
      src={HOST[pose]}
      style={{
        width: size * s,
        height: size * s,
        objectFit: "contain",
        transform: `translate(${breathX}px, ${breathY + (1 - p) * 60 * s}px) rotate(${rotate}deg)`,
        opacity: p,
        filter: `${PHOTO_GRADE} drop-shadow(${outline}px ${outline}px 0 rgba(238,234,225,.94)) drop-shadow(0 ${26 * s}px ${30 * s}px rgba(0,0,0,.55))`,
        ...style,
      }}
    />
  );
};
