// Core Vox scene renderers: title, photo, redact, split, network, big, end.
import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { Col, CreditTag, Head, Hi, IllusTag, Kicker, Rise } from "./chrome";
import { cl, useAsset, useBeat, useSp, useT, useV, useVox, type VoxScene } from "./theme";

type P = { s: VoxScene };

export const Items: React.FC<P> = ({ s }) => {
  const T = useT();
  const v = useV();
  const beat = useBeat();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: v ? 22 : 18, marginTop: 20, width: v ? "100%" : undefined }}>
      {s.items!.map((it, i) => (
        <Rise key={i} delay={beat(s, i, 24 + i * 24)} dy={20}>
          <div style={{ display: "flex", alignItems: "center", gap: 22, background: T.panel, border: `1px solid ${T.line}`, borderLeft: `6px solid ${T.accent}`, borderRadius: 10, padding: v ? "18px 28px 24px" : "14px 26px 20px" }}>
            <div style={{ fontFamily: T.serif, fontWeight: 800, fontSize: v ? 44 : 38, color: T.accentInk, minWidth: 54 }}>{String(i + 1).padStart(2, "0")}</div>
            <div style={{ fontFamily: T.sans, fontWeight: 600, fontSize: v ? 40 : 34, color: T.text, lineHeight: 1.4 }}>{it}</div>
          </div>
        </Rise>
      ))}
    </div>
  );
};

export const Title: React.FC<P> = ({ s }) => {
  const T = useT();
  return (
    <Col top16={s.items ? 230 : 330} top9={s.items ? 330 : 520}>
      {s.kicker && <Kicker text={s.kicker} />}
      <Head a={s.head} hi={s.hi} b={s.tail} size={s.size ?? 100} />
      {s.sub && (
        <Rise delay={30}>
          <div style={{ fontFamily: T.sans, fontWeight: 500, fontSize: 36, color: T.dim, lineHeight: 1.5 }}>{s.sub}</div>
        </Rise>
      )}
      {s.items && <Items s={s} />}
    </Col>
  );
};

export const Photo: React.FC<P & { dur: number }> = ({ s, dur }) => {
  const T = useT();
  const asset = useAsset();
  const f = useCurrentFrame();
  const v = useV();
  const p = f / dur;
  const scale = 1.08 + 0.12 * p;
  const [ox, oy] = s.focus ?? [50, 50];
  const sh = T.shade;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        {s.img && <Img src={asset(s.img)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${ox}% ${oy}%`, transform: `scale(${scale})`, transformOrigin: `${ox}% ${oy}%`, filter: "saturate(0.85) contrast(1.05)" }} />}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: v ? `linear-gradient(180deg, rgba(${sh},0.85) 0%, rgba(${sh},0.25) 40%, rgba(${sh},0.35) 65%, rgba(${sh},0.9) 100%)` : `linear-gradient(90deg, rgba(${sh},0.92) 0%, rgba(${sh},0.55) 45%, rgba(${sh},0.15) 100%)` }} />
      <IllusTag />
      {(s.head || s.kicker) && (
        <Col top16={s.items ? 230 : 360} top9={260} w={900}>
          {s.kicker && <Kicker text={s.kicker} />}
          {s.head && <Head a={s.head} hi={s.hi} b={s.tail} size={s.size ?? 88} />}
          {s.items && <Items s={s} />}
        </Col>
      )}
      <CreditTag credit={s.credit} />
    </AbsoluteFill>
  );
};

// dossier: lines of text get blacked out, one phrase stays revealed in an accent frame
export const Redact: React.FC<P> = ({ s }) => {
  const T = useT();
  const { labels } = useVox();
  const f = useCurrentFrame();
  const v = useV();
  const rows = 7;
  const keep = 4;
  const w = v ? 900 : 1000;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: v ? 90 : 460, top: v ? 520 : 170, width: w, background: T.paper, borderRadius: 6, padding: "50px 60px", boxShadow: "0 40px 80px rgba(0,0,0,0.6)", transform: `rotate(-1.2deg)` }}>
        <div style={{ fontFamily: "monospace", fontSize: 26, color: "#2B2824", letterSpacing: 2, marginBottom: 26 }}>{s.kicker ?? labels.file}</div>
        {Array.from({ length: rows }).map((_, i) => {
          const bar = interpolate(f, [10 + i * 5, 24 + i * 5], [0, 1], cl);
          if (i === keep) {
            const box = interpolate(f, [50, 64], [0, 1], cl);
            return (
              <div key={i} style={{ position: "relative", margin: "18px 0", padding: "10px 16px 16px", fontFamily: T.serif, fontWeight: 800, fontSize: v ? 50 : 54, color: "#1E1B18", lineHeight: 1.3 }}>
                {s.head}
                {s.hi && <span style={{ color: T.accent }}>{s.hi}</span>}
                <div style={{ position: "absolute", inset: 0, border: `3px solid ${T.accent}`, boxShadow: `0 0 24px ${T.accent}`, opacity: box, transform: `scale(${1.08 - 0.08 * box})` }} />
              </div>
            );
          }
          return <div key={i} style={{ height: 30, margin: "16px 0", background: "#141210", width: `${(70 + ((i * 37) % 28)) * bar}%`, borderRadius: 3 }} />;
        })}
      </div>
      <CreditTag credit={s.credit} />
    </AbsoluteFill>
  );
};

export const Split: React.FC<P> = ({ s }) => {
  const T = useT();
  const v = useV();
  const beat = useBeat();
  const box = (side: { label: string; text: string }, i: number) => (
    <Rise key={i} delay={beat(s, i, 10 + i * 26)} style={{ flex: 1 }}>
      <div style={{ height: "100%", background: i ? T.accentSoft : T.panel, border: `2px solid ${i ? T.accent : T.line}`, borderRadius: 16, padding: "34px 40px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontFamily: T.sans, fontWeight: 700, fontSize: 28, letterSpacing: 2, color: i ? T.accentInk : T.dim }}>{side.label}</div>
        <div style={{ fontFamily: T.serif, fontWeight: 800, fontSize: v ? 54 : 52, lineHeight: 1.35, color: T.text }}>{side.text}</div>
      </div>
    </Rise>
  );
  return (
    <>
      <Col top16={170} top9={270} w={1600}>
        {s.kicker && <Kicker text={s.kicker} />}
      </Col>
      <div style={{ position: "absolute", left: v ? 80 : 160, right: v ? 80 : 160, top: v ? 380 : 270, height: v ? 960 : 520, display: "flex", flexDirection: v ? "column" : "row", gap: 36 }}>
        {s.left && box(s.left, 0)}
        {s.right && box(s.right, 1)}
      </div>
    </>
  );
};

// node graph with accent connector lines drawing between labelled nodes
export const Network: React.FC<P> = ({ s }) => {
  const T = useT();
  const f = useCurrentFrame();
  const v = useV();
  const beat = useBeat();
  const nodes = s.items ?? [];
  const W = v ? 1080 : 1920;
  const cx = v ? 540 : 1220,
    cy = v ? 900 : 560,
    R = v ? 340 : 330;
  const pos = nodes.map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / nodes.length;
    return [cx + R * Math.cos(a) * (v ? 1 : 1.25), cy + R * Math.sin(a) * (v ? 1.1 : 0.85)];
  });
  const hubS = useSp(4);
  return (
    <>
      {s.kicker && (
        <Col top16={200} top9={260} w={560}>
          <Kicker text={s.kicker} />
          {!v && s.head && <Head a={s.head} hi={s.hi} b={s.tail} size={70} />}
        </Col>
      )}
      <svg width={W} height={v ? 1920 : 1080} style={{ position: "absolute", left: 0, top: 0 }}>
        {pos.map(([x, y], i) => {
          const d0 = beat(s, i, 14 + i * 10) - 8;
          const p = interpolate(f, [d0, d0 + 16], [0, 1], cl);
          return <line key={i} x1={cx} y1={cy} x2={cx + (x - cx) * p} y2={cy + (y - cy) * p} stroke={T.accent} strokeWidth={3} strokeDasharray="10 8" opacity={0.85} />;
        })}
      </svg>
      <div style={{ position: "absolute", left: cx - 120, top: cy - 120, width: 240, height: 240, borderRadius: 120, background: T.accent, opacity: hubS, transform: `scale(${hubS})`, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: T.serif, fontWeight: 800, fontSize: 38, lineHeight: 1.3, color: T.onAccent, boxShadow: `0 0 60px ${T.accent}`, padding: 20 }}>
        {s.hub ?? s.hi}
      </div>
      {pos.map(([x, y], i) => {
        const d0 = beat(s, i, 26 + i * 10);
        const sp = interpolate(f, [d0, d0 + 12], [0, 1], cl);
        const nw = nodes.length > 6 ? 250 : 300;
        return (
          <div key={i} style={{ position: "absolute", left: x - nw / 2, top: y - 50, width: nw, minHeight: 100, opacity: sp, transform: `scale(${0.8 + 0.2 * sp})`, background: T.panel, border: `2px solid ${T.line}`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "10px 18px 16px", fontFamily: T.sans, fontWeight: 700, fontSize: v ? 34 : 30, lineHeight: 1.35, color: T.text }}>
            {nodes[i]}
          </div>
        );
      })}
    </>
  );
};

export const Big: React.FC<P> = ({ s }) => {
  const T = useT();
  const v = useV();
  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: v ? "0 80px 500px" : "0 200px 80px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 28, alignItems: "center", textAlign: "center" }}>
        {s.kicker && <Kicker text={s.kicker} />}
        <Rise delay={6}>
          <div style={{ fontFamily: T.serif, fontWeight: 800, fontSize: v ? (s.size ?? 120) * 0.9 : s.size ?? 120, lineHeight: 1.3, color: T.text }}>
            {s.head}
            {s.hi && <Hi delay={20}>{s.hi}</Hi>}
            {s.tail}
          </div>
        </Rise>
        {s.sub && (
          <Rise delay={30}>
            <div style={{ fontFamily: T.sans, fontWeight: 500, fontSize: v ? 40 : 36, color: T.dim }}>{s.sub}</div>
          </Rise>
        )}
      </div>
    </AbsoluteFill>
  );
};

// end card: brand (or scene head/hi) + up to 3 sign-off lines; last line gets the accent
export const End: React.FC<P> = ({ s }) => {
  const T = useT();
  const { brand } = useVox();
  const v = useV();
  const beat = useBeat();
  const f = useCurrentFrame();
  const glow = interpolate(f, [0, 30], [0, 1], cl);
  const name = s.head ?? brand?.name ?? "";
  const hi = s.head ? s.hi : brand?.hi;
  const items = s.items ?? [];
  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: v ? 60 : 44 }}>
      <Rise delay={2}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ width: v ? 44 : 40, height: v ? 44 : 40, background: T.accent, transform: "rotate(45deg)", boxShadow: `0 0 ${40 * glow}px ${T.accent}` }} />
          <div style={{ fontFamily: T.sans, fontWeight: 800, fontSize: v ? 110 : 130, letterSpacing: 6, color: T.text }}>
            {name}
            {hi && <span style={{ color: T.accentInk }}>{hi}</span>}
          </div>
        </div>
      </Rise>
      <div style={{ display: "flex", flexDirection: v ? "column" : "row", gap: v ? 26 : 50, alignItems: "center" }}>
        {items.map((t, i) => (
          <Rise key={i} delay={beat(s, i, 30 + i * 30)} dy={20}>
            <div style={{ fontFamily: T.sans, fontWeight: 600, fontSize: v ? 50 : 40, letterSpacing: 3, color: i === items.length - 1 && items.length > 1 ? T.accentInk : T.dim }}>{t}</div>
          </Rise>
        ))}
      </div>
    </AbsoluteFill>
  );
};
