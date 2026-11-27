import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT, K, TRACK, ez, useScale } from "../tokens";
import { Source } from "./Text";

/**
 * Horizontal meters that grow, values counting up. `source` is REQUIRED:
 * provenance is copy, not a disclaimer. Mark approximate figures with `approx`.
 */
export const DataMeter: React.FC<{
  rows: Array<{ label: string; value: number; highlight?: boolean }>;
  max?: number;
  unit?: string;
  source: string;
  approx?: boolean;
  at?: number;
}> = ({ rows, max = 100, unit = "%", source, approx, at = 0 }) => {
  const frame = useCurrentFrame();
  const { s, fps } = useScale();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 * s }}>
      {approx ? (
        <span style={{ fontFamily: FONT.mono, fontWeight: 500, fontSize: 21 * s, letterSpacing: TRACK.label, color: K.signal }}>ตัวเลขโดยประมาณ</span>
      ) : null}
      {rows.map((r, i) => {
        const p = ez(frame, fps, at + 0.2 + i * 0.3, 0.8);
        const v = Math.round(r.value * p);
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 12 * s }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", color: K.paper }}>
              <span style={{ fontFamily: FONT.body, fontWeight: 600, fontSize: 40 * s }}>{r.label}</span>
              <span style={{ fontFamily: FONT.display, fontSize: 64 * s, color: r.highlight ? K.signal : K.paper }}>
                {v}
                {unit}
              </span>
            </div>
            <div style={{ height: 20 * s, background: K.paperA(0.16) }}>
              <div style={{ width: `${(r.value / max) * 100 * p}%`, height: "100%", background: r.highlight ? K.signal : K.paperA(0.62) }} />
            </div>
          </div>
        );
      })}
      <Source at={at + 1}>{source}</Source>
    </div>
  );
};
