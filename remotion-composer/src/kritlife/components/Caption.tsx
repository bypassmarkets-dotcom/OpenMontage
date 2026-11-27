import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT, K, LH, T, useScale } from "../tokens";
import { parseMark } from "./Text";

export type CaptionCue = { s: number; e: number; x: string };

/**
 * Word-paced burned-in caption. It does not fade: it FILLS character-
 * proportionally to (t - s) / (e - s). Spoken text is opaque, unspoken at 34%.
 * `[keyword]` renders in signal orange. On 9:16 it sits at y≈1418–1540,
 * above the platform keep-out.
 */
export const Caption: React.FC<{ cues: CaptionCue[]; plate?: boolean }> = ({ cues, plate = true }) => {
  const frame = useCurrentFrame();
  const { s, fps, vertical, pad, height } = useScale();
  const t = frame / fps;
  const cue = cues.find((c) => t >= c.s && t < c.e);
  if (!cue) return null;
  const runs = parseMark(cue.x);
  const total = runs.reduce((n, r) => n + r.text.length, 0);
  const spoken = Math.round(Math.min(1, (t - cue.s) / (cue.e - cue.s)) * total);
  let seen = 0;
  const top = vertical ? 1418 * s : height - 190 * s;
  return (
    <div style={{ position: "absolute", left: pad, right: pad, top, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          background: plate ? K.plateA(0.72) : "transparent",
          padding: `${14 * s}px ${26 * s}px`,
          fontFamily: FONT.body,
          fontWeight: 500,
          fontSize: T.caption * s * (vertical ? 1.15 : 1),
          lineHeight: LH.body,
          textAlign: "center",
          maxWidth: 1180 * s,
        }}
      >
        {runs.map((r, i) =>
          Array.from(r.text).map((ch, j) => {
            const on = seen++ < spoken;
            const color = r.kind === "accent" ? K.signal : K.paper;
            return (
              <span key={`${i}-${j}`} style={{ color, opacity: on ? 1 : 0.34 }}>
                {ch}
              </span>
            );
          }),
        )}
      </div>
    </div>
  );
};
