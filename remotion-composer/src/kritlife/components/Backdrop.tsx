import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { TEX } from "../assets";
import { K, useScale } from "../tokens";

/** 90px graph-paper grid at 5% alpha, drifting ~13px/s. */
export const Grid: React.FC<{ onPaper?: boolean }> = ({ onPaper }) => {
  const frame = useCurrentFrame();
  const { s, fps } = useScale();
  const cell = 90 * s;
  const drift = ((frame / fps) * 13 * s) % cell;
  const line = onPaper ? K.inkA(0.06) : K.paperA(0.05);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
        backgroundSize: `${cell}px ${cell}px`,
        backgroundPosition: `${drift}px ${drift * 0.6}px`,
      }}
    />
  );
};

/** Film grain: jumps to a seeded offset at 24fps. Mandatory on dark full frames. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.14 }) => {
  const frame = useCurrentFrame();
  const { fps } = useScale();
  const step = Math.floor((frame / fps) * 24);
  const x = Math.floor(random(`grain-x-${step}`) * 512);
  const y = Math.floor(random(`grain-y-${step}`) * 512);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${TEX.grain})`,
        backgroundSize: "512px 512px",
        backgroundPosition: `${x}px ${y}px`,
        mixBlendMode: "overlay",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background: "radial-gradient(ellipse 75% 70% at 50% 45%, transparent 55%, rgba(0,0,0,.6) 100%)",
      pointerEvents: "none",
    }}
  />
);

/**
 * The stage every scene sits on. `ground`: ink (default), paper or cork.
 * Children render between the ground and the texture stack.
 */
export const Backdrop: React.FC<{
  ground?: "ink" | "paper" | "cork";
  grid?: boolean;
  children?: React.ReactNode;
}> = ({ ground = "ink", grid = true, children }) => {
  const { s } = useScale();
  const base: React.CSSProperties =
    ground === "paper"
      ? { backgroundColor: K.paper, backgroundImage: `url(${TEX.paper})`, backgroundSize: "cover", backgroundBlendMode: "multiply" }
      : ground === "cork"
        ? { backgroundColor: "#8a6a45", backgroundImage: `url(${TEX.corkTile})`, backgroundSize: `${420 * s}px ${420 * s}px` }
        : { backgroundColor: K.ink };
  return (
    <AbsoluteFill style={base}>
      {grid && ground !== "cork" ? <Grid onPaper={ground === "paper"} /> : null}
      {children}
      <Grain opacity={ground === "ink" ? 0.16 : 0.1} />
      {ground !== "paper" ? <Vignette /> : null}
    </AbsoluteFill>
  );
};
