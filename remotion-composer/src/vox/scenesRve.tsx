/**
 * Vox scenes adapted from React Video Editor free Remotion templates
 * (https://www.reactvideoeditor.com/remotion-templates — "free to use, credit appreciated").
 *
 *   chart-line  <- https://www.reactvideoeditor.com/remotion-templates/line-chart
 *   chart-pie   <- https://www.reactvideoeditor.com/remotion-templates/pie-chart
 *   list        <- https://www.reactvideoeditor.com/remotion-templates/animated-list
 *   parallax    <- https://www.reactvideoeditor.com/remotion-templates/parallax-pan
 *   typewriter  <- https://www.reactvideoeditor.com/remotion-templates/typewriter-subtitle
 *
 * Changes from upstream: everything is frame-driven (the parallax/ken-burns originals used CSS
 * @keyframes + <style jsx>, and typewriter used Math.random — none of which render deterministically
 * in Remotion), data comes from scene props, timing follows narration beats (`at`), and styling
 * comes from the Vox theme (one accent, hairlines, serif display + sans labels).
 */
import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { Col, CreditTag, Head, IllusTag, Kicker, Rise } from "./chrome";
import { cl, useAsset, useBeat, useSp, useT, useV, type VoxScene } from "./theme";

type P = { s: VoxScene };

const fmt = (n: number, unit?: string) => `${Number.isInteger(n) ? n : n.toFixed(1)}${unit ?? ""}`;
// round an axis max up to 1/2/2.5/5 x 10^k so ticks land on readable numbers
const niceMax = (m: number) => {
  const p = Math.pow(10, Math.floor(Math.log10(m)));
  const n = m / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};

// ---------- chart-line ----------
export const ChartLine: React.FC<P> = ({ s }) => {
  const T = useT();
  const v = useV();
  const f = useCurrentFrame();
  const beat = useBeat();
  const data = s.data ?? [];
  const W = v ? 920 : 1180;
  const H = v ? 640 : 560;
  const pad = { l: 90, r: 40, t: 40, b: 70 };
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)) * 1.05);
  const xs = (i: number) => pad.l + (data.length < 2 ? 0 : (i / (data.length - 1)) * (W - pad.l - pad.r));
  const ys = (val: number) => H - pad.b - (val / max) * (H - pad.t - pad.b);
  const pts = data.map((d, i) => [xs(i), ys(d.value)] as const);
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const d0 = 16;
  const dEnd = data.length ? beat(s, data.length - 1, d0 + 60) : d0 + 60;
  const draw = interpolate(f, [d0, Math.max(d0 + 10, dEnd)], [0, 1], cl);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => k * max);
  return (
    <>
      <Col top16={130} top9={260} w={1500}>
        {s.kicker && <Kicker text={s.kicker} />}
        {s.head && <Head a={s.head} hi={s.hi} b={s.tail} size={s.size ?? 64} />}
      </Col>
      <svg width={W} height={H} style={{ position: "absolute", left: v ? 80 : 160, top: v ? 620 : 380 }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={ys(t)} y2={ys(t)} stroke={T.line} strokeWidth={1.5} />
            <text x={pad.l - 16} y={ys(t) + 8} textAnchor="end" fill={T.dim} fontFamily={T.sans} fontSize={22}>
              {fmt(Math.round(t * 10) / 10, s.unit)}
            </text>
          </g>
        ))}
        <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={T.accent} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - draw)} />
        {data.map((d, i) => {
          const at = beat(s, i, d0 + (i / Math.max(1, data.length - 1)) * 60);
          const p = interpolate(f, [at, at + 8], [0, 1], cl);
          const last = i === data.length - 1;
          return (
            <g key={i} opacity={p}>
              <circle cx={pts[i][0]} cy={pts[i][1]} r={(last ? 12 : 8) * p} fill={last ? T.accent : T.bg} stroke={T.accent} strokeWidth={4} />
              <text x={pts[i][0]} y={H - pad.b + 40} textAnchor="middle" fill={T.dim} fontFamily={T.sans} fontSize={22} fontWeight={600}>
                {d.label}
              </text>
              {last && (
                <text x={pts[i][0]} y={pts[i][1] - 26} textAnchor="end" fill={T.text} fontFamily={T.serif} fontSize={44} fontWeight={800}>
                  {fmt(d.value, s.unit)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <CreditTag credit={s.credit} />
    </>
  );
};

// ---------- chart-pie (donut) ----------
export const ChartPie: React.FC<P> = ({ s }) => {
  const T = useT();
  const v = useV();
  const f = useCurrentFrame();
  const beat = useBeat();
  const data = s.data ?? [];
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = v ? 200 : 210;
  const C = 2 * Math.PI * r;
  const size = r * 2 + 140;
  // first slice in the accent, the rest in steps of the dim/line tones so the story slice pops
  const tone = (i: number) => (i === 0 ? T.accent : [T.dim, T.line, T.panel, T.bg2][(i - 1) % 4]);
  let acc = 0;
  return (
    <>
      <Col top16={200} top9={260} w={720}>
        {s.kicker && <Kicker text={s.kicker} />}
        {s.head && <Head a={s.head} hi={s.hi} b={s.tail} size={s.size ?? 66} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16, alignItems: v ? "center" : "flex-start" }}>
          {data.map((d, i) => (
            <Rise key={i} delay={beat(s, i, 20 + i * 12) + 6} dy={14}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: T.sans, fontSize: v ? 34 : 30, fontWeight: 600, color: i === 0 ? T.text : T.dim }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, background: tone(i), border: `1px solid ${T.line}` }} />
                {d.label}
                <span style={{ fontFamily: T.serif, fontWeight: 800, color: i === 0 ? T.accentInk : T.dim }}>{fmt(Math.round((d.value / total) * 1000) / 10, s.unit ?? "%")}</span>
              </div>
            </Rise>
          ))}
        </div>
      </Col>
      <svg width={size} height={size} style={{ position: "absolute", left: v ? (1080 - size) / 2 : 1100, top: v ? 760 : 200 }}>
        {data.map((d, i) => {
          const seg = (d.value / total) * C;
          const off = acc;
          acc += seg;
          const at = beat(s, i, 20 + i * 12);
          const p = interpolate(f, [at, at + 16], [0, 1], cl);
          const L = seg * p;
          return <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone(i)} strokeWidth={i === 0 ? 96 : 84} strokeDasharray={`${L} ${C - L}`} strokeDashoffset={-off} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
        })}
        <circle cx={size / 2} cy={size / 2} r={r - 60} fill={T.bg} />
        {data[0] && (
          <text x={size / 2} y={size / 2 + 26} textAnchor="middle" fill={T.text} fontFamily={T.serif} fontWeight={800} fontSize={76} opacity={interpolate(f, [30, 44], [0, 1], cl)}>
            {fmt(Math.round((data[0].value / total) * 100), s.unit ?? "%")}
          </text>
        )}
      </svg>
    </>
  );
};

// ---------- list (checklist with strike-through for "not this" items prefixed "~") ----------
export const List: React.FC<P> = ({ s }) => {
  const T = useT();
  const v = useV();
  const f = useCurrentFrame();
  const beat = useBeat();
  const items = s.items ?? [];
  return (
    <Col top16={items.length > 4 ? 170 : 230} top9={300} w={1400}>
      {s.kicker && <Kicker text={s.kicker} />}
      {s.head && <Head a={s.head} hi={s.hi} b={s.tail} size={s.size ?? 72} />}
      <div style={{ display: "flex", flexDirection: "column", gap: v ? 26 : 20, marginTop: 18, alignSelf: v ? "center" : undefined }}>
        {items.map((raw, i) => {
          const struck = raw.startsWith("~");
          const text = struck ? raw.slice(1) : raw;
          const at = beat(s, i, 22 + i * 14);
          const x = interpolate(f, [at, at + 12], [-60, 0], cl);
          const o = interpolate(f, [at, at + 10], [0, 1], cl);
          const strike = interpolate(f, [at + 10, at + 22], [0, 1], cl);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 24, opacity: o, transform: `translateX(${x}px)` }}>
              <div style={{ width: 46, height: 46, borderRadius: 23, flexShrink: 0, border: `3px solid ${struck ? T.dim : T.accent}`, background: struck ? "transparent" : T.accent, display: "flex", alignItems: "center", justifyContent: "center", color: T.onAccent, fontFamily: T.sans, fontWeight: 800, fontSize: 26 }}>
                {struck ? "" : "✓"}
              </div>
              <div style={{ position: "relative", fontFamily: T.sans, fontWeight: 600, fontSize: v ? 42 : 38, color: struck ? T.dim : T.text, lineHeight: 1.4 }}>
                {text}
                {struck && <div style={{ position: "absolute", left: -4, top: "54%", height: 4, width: `calc(${strike * 100}% + 8px)`, background: T.accent }} />}
              </div>
            </div>
          );
        })}
      </div>
    </Col>
  );
};

// ---------- parallax (two-layer image pan; img = background, img2 = optional foreground cut-out) ----------
export const Parallax: React.FC<P & { dur: number }> = ({ s, dur }) => {
  const T = useT();
  const asset = useAsset();
  const v = useV();
  const f = useCurrentFrame();
  const p = interpolate(f, [0, dur], [0, 1], cl);
  const dir = s.direction ?? "left";
  const axis = dir === "left" || dir === "right" ? "X" : "Y";
  const sign = dir === "left" || dir === "up" ? -1 : 1;
  const bg = sign * 4 * p; // % — slow layer
  const fg = sign * 11 * p; // % — fast layer
  const sh = T.shade;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        {s.img && <Img src={asset(s.img)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(1.18) translate${axis}(${bg}%)`, filter: "saturate(0.85) contrast(1.05)" }} />}
        {s.img2 && <Img src={asset(s.img2)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", transform: `scale(1.1) translate${axis}(${fg}%)` }} />}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: v ? `linear-gradient(180deg, rgba(${sh},0.8) 0%, rgba(${sh},0.1) 45%, rgba(${sh},0.85) 100%)` : `linear-gradient(0deg, rgba(${sh},0.85) 0%, rgba(${sh},0.1) 55%)` }} />
      <IllusTag />
      {(s.head || s.kicker) && (
        <div style={{ position: "absolute", left: v ? 80 : 160, right: v ? 80 : 160, bottom: v ? 520 : 170, display: "flex", flexDirection: "column", gap: 18, alignItems: v ? "center" : "flex-start" }}>
          {s.kicker && <Kicker text={s.kicker} />}
          {s.head && <Head a={s.head} hi={s.hi} b={s.tail} size={s.size ?? 80} />}
        </div>
      )}
      <CreditTag credit={s.credit} />
    </AbsoluteFill>
  );
};

// ---------- typewriter (quote / document line typed out, blinking block cursor) ----------
export const Typewriter: React.FC<P & { dur: number }> = ({ s, dur }) => {
  const T = useT();
  const v = useV();
  const f = useCurrentFrame();
  const beat = useBeat();
  const text = s.text ?? s.head ?? "";
  // Array.from keeps Thai combining marks / emoji from being split mid-glyph more often than .slice
  const chars = Array.from(text);
  const start = 10;
  const end = s.at && s.at.length ? beat(s, 0, start + 60) : Math.min(dur - 20, start + chars.length * 1.6);
  const n = Math.floor(interpolate(f, [start, Math.max(start + 1, end)], [0, chars.length], cl));
  const done = n >= chars.length;
  const card = useSp(0);
  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: v ? 900 : 1400, opacity: card, transform: `translateY(${(1 - card) * 24}px)`, display: "flex", flexDirection: "column", gap: 26, alignItems: v ? "center" : "flex-start", marginBottom: v ? 300 : 40 }}>
        {s.kicker && <Kicker text={s.kicker} />}
        <div style={{ fontFamily: T.serif, fontWeight: 700, fontSize: s.size ?? (v ? 62 : 68), lineHeight: 1.45, color: T.text, borderLeft: v ? undefined : `6px solid ${T.accent}`, paddingLeft: v ? 0 : 40, textAlign: v ? "center" : "left" }}>
          {chars.slice(0, n).join("")}
          <span style={{ display: "inline-block", width: "0.5em", height: "1em", marginLeft: 6, verticalAlign: "-0.12em", background: T.accent, opacity: done ? (Math.floor(f / 15) % 2 ? 0 : 1) : 1 }} />
        </div>
        {s.sub && (
          <div style={{ fontFamily: T.sans, fontWeight: 600, fontSize: 30, color: T.dim, opacity: done ? 1 : 0 }}>{s.sub}</div>
        )}
      </div>
    </AbsoluteFill>
  );
};
