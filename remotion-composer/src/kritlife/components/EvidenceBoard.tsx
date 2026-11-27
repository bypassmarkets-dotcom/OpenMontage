import React from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { FONT, K, PHOTO_GRADE, SHADOW, TRACK, ez, EASE, useScale } from "../tokens";
import { Backdrop } from "./Backdrop";
import { Pin } from "./Paper";
import { PaperCard } from "./Paper";

export type BoardItem = {
  /** Position of the item's centre, in % of the frame. */
  x: number;
  y: number;
  rotate?: number;
  /** Thai note on paper, or a photo. */
  text?: string;
  image?: string;
  tag?: string; // e.g. "EXHIBIT 07"
  w?: number; // px at 1080
};

/**
 * Vox "conspiracy board": cork, pinned paper and photos, red thread drawn
 * between them. Threads draw in order after the items land.
 */
export const EvidenceBoard: React.FC<{
  items: BoardItem[];
  threads: Array<[number, number]>;
  stamp?: string; // e.g. "OPEN"
  at?: number;
}> = ({ items, threads, stamp, at = 0 }) => {
  const frame = useCurrentFrame();
  const { s, fps, width, height } = useScale();
  // Threads tie to the pins, which sit on each item's top edge.
  const pt = (i: number) => {
    const it = items[i];
    const half = it.image ? (((it.w ?? 300) * 0.7) / 2 + 10) * s : 62 * s;
    return { x: (it.x / 100) * width, y: (it.y / 100) * height - half + 5 * s };
  };
  return (
    <Backdrop ground="cork">
      <AbsoluteFill>
        {items.map((it, i) => {
          const w = (it.w ?? 300) * s;
          const itemAt = at + i * 0.25;
          return (
            <div key={i} style={{ position: "absolute", left: `${it.x}%`, top: `${it.y}%`, width: w, transform: "translate(-50%, -50%)" }}>
              {it.image ? (
                <div style={{ opacity: ez(frame, fps, itemAt), transform: `rotate(${it.rotate ?? 0}deg) scale(${0.9 + 0.1 * ez(frame, fps, itemAt)})` }}>
                  <Img src={it.image} style={{ width: w, height: w * 0.7, objectFit: "cover", filter: PHOTO_GRADE, border: `${10 * s}px solid ${K.paper150}`, boxShadow: SHADOW.paper, display: "block" }} />
                  <Pin at={itemAt + 0.3} color="thread" style={{ left: "50%", top: -12 * s, marginLeft: -15 * s }} />
                </div>
              ) : (
                <PaperCard at={itemAt} rotate={it.rotate ?? -2} pin="thread" style={{ padding: `${28 * s}px ${30 * s}px` }}>
                  {it.tag ? (
                    <div style={{ fontFamily: FONT.mono, fontWeight: 500, fontSize: 20 * s, letterSpacing: TRACK.kicker, color: K.signalDeep, marginBottom: 8 * s }}>{it.tag}</div>
                  ) : null}
                  <div style={{ fontFamily: FONT.body, fontWeight: 700, fontSize: 36 * s, lineHeight: 1.3 }}>{it.text}</div>
                </PaperCard>
              )}
            </div>
          );
        })}
      </AbsoluteFill>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden="true">
        {threads.map(([a, b], i) => {
          const p = ez(frame, fps, at + items.length * 0.25 + 0.3 + i * 0.35, 0.7, EASE.inOutCubic);
          const A = pt(a);
          const B = pt(b);
          const len = Math.hypot(B.x - A.x, B.y - A.y);
          // A slight sag: the string hangs between pins.
          const mx = (A.x + B.x) / 2;
          const my = (A.y + B.y) / 2 + len * 0.06;
          return (
            <path
              key={i}
              d={`M${A.x} ${A.y} Q${mx} ${my} ${B.x} ${B.y}`}
              fill="none"
              stroke={K.thread}
              strokeWidth={4 * s}
              strokeDasharray={len * 1.1}
              strokeDashoffset={len * 1.1 * (1 - p)}
              style={{ filter: "drop-shadow(0 4px 3px rgba(0,0,0,.45))" }}
            />
          );
        })}
      </svg>
      {stamp ? (
        <div
          style={{
            position: "absolute",
            right: "8%",
            bottom: "22%",
            border: `${6 * s}px solid ${K.thread}`,
            color: K.thread,
            background: K.paperA(0.88),
            padding: `${8 * s}px ${22 * s}px`,
            fontFamily: FONT.display,
            fontSize: 56 * s,
            transform: `rotate(-8deg) scale(${1.6 - 0.6 * ez(frame, fps, at + 2.6, 0.35, EASE.outBack)})`,
            opacity: ez(frame, fps, at + 2.6, 0.15),
          }}
        >
          {stamp}
        </div>
      ) : null}
    </Backdrop>
  );
};
