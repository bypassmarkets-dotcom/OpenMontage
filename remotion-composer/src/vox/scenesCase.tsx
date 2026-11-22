// `case` — FBI-style case board with a virtual camera.
//
// Beat structure (all frame-driven, deterministic):
//   1. POP: the camera starts tight on the headline note; kicker types out, the head pops in with a
//      spring overshoot, the highlight tears in.
//   2. CAMERA: the camera pulls back and pans to each evidence card on its narration beat (`at[i]`),
//      the card pins in as the camera lands, a red pen circle is drawn around it and a string runs
//      back to the headline note.
//   3. WIDE: after the last card the camera pulls back to show the whole board.
// The host's face sits in screen space as an aged photo about a quarter of the frame (it does not move
// with the camera) and the whole scene gets an old-paper treatment (sepia, fibre, stains, burnt
// vignette, light film scratches).
//
// Camera move adapted from the React Video Editor "Ken Burns" and "Zoom Through" free templates
// (https://www.reactvideoeditor.com/remotion-templates/ken-burns,
//  https://www.reactvideoeditor.com/remotion-templates/zoom-through), rewritten frame-driven;
// text pop adapted from "Popping Scale Text"
// (https://www.reactvideoeditor.com/remotion-templates/popping-text).
import React, { useMemo } from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CreditTag } from "./chrome";
import { Note, PaperGrain, Pin, PinString, Polaroid, Stamp, TornPaper, TornStrip, hashStr, rng } from "./paper";
import { cl, useAsset, useBeat, useT, useV, type VoxCard, type VoxScene } from "./theme";

type P = { s: VoxScene; dur: number };

const EASE = Easing.bezier(0.65, 0, 0.35, 1);

type Cam = { f: number; x: number; y: number; z: number };

/** Piecewise camera: holds each key, then eases to the next over `travel` frames before it. */
const camAt = (keys: Cam[], f: number): Omit<Cam, "f"> => {
  if (f <= keys[0].f) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (f <= b.f) {
      const travel = Math.min(18, b.f - a.f);
      const t = interpolate(f, [b.f - travel, b.f], [0, 1], { ...cl, easing: EASE });
      // zoom interpolates in log space so pull-backs feel even
      const z = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * t);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z };
    }
  }
  return keys[keys.length - 1];
};

const boxOf = (c: VoxCard) => {
  const w = c.w ?? (c.kind === "note" ? 340 : 300);
  if (c.kind === "photo") return { w: w + 24, h: Math.round(w * 0.78) + 12 + (c.caption ? 46 : 26) };
  if (c.kind === "note") return { w, h: (c.title ? 84 : 30) + (c.items?.length ?? 0) * 46 + 30 };
  return { w: 320, h: 110 };
};

/** Red ballpoint circle drawn around a card (pen-click moment). */
const PenCircle: React.FC<{ cx: number; cy: number; rx: number; ry: number; from: number; seed: number }> = ({ cx, cy, rx, ry, from, seed }) => {
  const T = useT();
  const f = useCurrentFrame();
  const p = interpolate(f, [from, from + 12], [0, 1], { ...cl, easing: Easing.out(Easing.cubic) });
  const r = rng(seed);
  const pts = Array.from({ length: 26 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2 - 0.6;
    const k = 1 + (r() - 0.5) * 0.06 + i * 0.004;
    return `${cx + Math.cos(a) * rx * k},${cy + Math.sin(a) * ry * k}`;
  });
  return (
    <path d={`M${pts.join(" L")}`} fill="none" stroke={T.accent} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} opacity={0.9} />
  );
};

/** Old-paper treatment over the whole scene (screen space). */
const AgedPaper: React.FC<{ seed: number }> = ({ seed }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // film scratches re-seeded every 3 frames: deterministic flicker
  const step = Math.floor(f / 3);
  const r = rng(seed * 997 + step);
  const scratches = Array.from({ length: 3 }, () => ({ x: r() * 100, o: r() * 0.18, h: 40 + r() * 60, y: r() * 40 }));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "#B8925A", mixBlendMode: "multiply", opacity: 0.22 }} />
      <PaperGrain strength={0.9} seed={seed} />
      {scratches.map((s, i) => (
        <div key={i} style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, width: 1.5, height: `${s.h}%`, background: "#F3E7CC", opacity: s.o }} />
      ))}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse ${width > height ? "75% 85%" : "95% 70%"} at 50% 48%, transparent 55%, rgba(58,34,12,0.55) 88%, rgba(30,16,4,0.85) 100%)` }} />
    </AbsoluteFill>
  );
};

/** Host face as an aged instant photo, about a quarter of the frame, scaling up into place. */
const HostFace: React.FC<{ img: string; delay: number; v: boolean; seed: number }> = ({ img, delay, v, seed }) => {
  const asset = useAsset();
  const T = useT();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 15, stiffness: 120, mass: 0.9 } });
  // quarter of the frame: 9:16 -> half width x ~half height; 16:9 -> ~half height, portrait photo
  const box = v ? { w: 560, h: 700, left: 30, top: 1000 } : { w: 520, h: 620, left: 50, top: 330 };
  return (
    <div style={{ position: "absolute", left: box.left, top: box.top, zIndex: 20, opacity: interpolate(f - delay, [0, 5], [0, 1], cl), transform: `rotate(${-4 + (1 - s) * -6}deg) scale(${0.35 + 0.65 * s})`, transformOrigin: "30% 100%" }}>
      <div style={{ background: "#E9DDC2", padding: "16px 16px 64px", boxShadow: "0 24px 40px rgba(0,0,0,0.65)", position: "relative" }}>
        <div style={{ width: box.w, height: box.h, overflow: "hidden", position: "relative", background: "#3a3128" }}>
          <Img src={asset(img)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 22%", transform: "scale(1.35)", transformOrigin: "50% 25%", filter: "grayscale(1) sepia(0.55) contrast(1.15) brightness(0.95)" }} />
          <PaperGrain strength={1.2} seed={seed + 5} />
          <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 40%, transparent 50%, rgba(40,22,6,0.5) 100%)" }} />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, textAlign: "center", fontFamily: T.typeFace ?? T.sans, fontSize: v ? 28 : 24, letterSpacing: 4, color: "#3A2E20" }}>HOST · KRITLIFE</div>
        {/* tape */}
        <div style={{ position: "absolute", top: -18, left: "38%", width: 120, height: 36, background: "rgba(235,222,190,0.75)", transform: "rotate(4deg)", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }} />
      </div>
    </div>
  );
};

/** The wall the camera travels over: newsprint scraps + faint filed documents across the whole board. */
const CaseWall: React.FC<{ BW: number; BH: number; seed: number; avoid: { x: number; y: number; w: number; h: number } }> = ({ BW, BH, seed, avoid }) => {
  const T = useT();
  const items = useMemo(() => {
    const r = rng(seed + 31);
    const clips = Array.from({ length: Math.round((BW * BH) / 52000) }, () => ({ x: r() * BW, y: r() * BH, w: 140 + r() * 280, rot: (r() - 0.5) * 14, lines: 6 + Math.floor(r() * 10), o: 0.06 + r() * 0.12 }));
    const docs: { x: number; y: number; w: number; h: number; rot: number; s: number }[] = [];
    for (let i = 0; docs.length < 16 && i < 200; i++) {
      const w = 220 + r() * 220;
      const h = w * (1.1 + r() * 0.4);
      const x = r() * (BW - w);
      const y = r() * (BH - h);
      const hit = x < avoid.x + avoid.w && x + w > avoid.x && y < avoid.y + avoid.h && y + h > avoid.y;
      if (!hit) docs.push({ x, y, w, h, rot: (r() - 0.5) * 16, s: Math.floor(r() * 1000) });
    }
    return { clips, docs };
  }, [BW, BH, seed, avoid.x, avoid.y, avoid.w, avoid.h]);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: BW, height: BH, background: T.bg, overflow: "hidden" }}>
      {items.clips.map((c, i) => (
        <div key={i} style={{ position: "absolute", left: c.x, top: c.y, width: c.w, transform: `rotate(${c.rot}deg)`, opacity: c.o }}>
          {Array.from({ length: c.lines }).map((_, k) => (
            <div key={k} style={{ height: 4, margin: "5px 0", width: `${70 + ((k * 37 + i) % 30)}%`, background: T.dim }} />
          ))}
        </div>
      ))}
      {items.docs.map((d, i) => (
        <div key={`d${i}`} style={{ position: "absolute", left: d.x, top: d.y, opacity: 0.32 }}>
          <TornPaper seed={d.s} rot={d.rot} style={{ position: "relative", width: d.w, height: d.h }} amp={2} shadow>
            <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 9 }}>
              {Array.from({ length: Math.floor(d.h / 30) }).map((_, k) => (
                <div key={k} style={{ height: 5, width: `${55 + ((k * 29 + i * 7) % 40)}%`, background: "#2A241C", opacity: 0.55 }} />
              ))}
            </div>
          </TornPaper>
        </div>
      ))}
    </div>
  );
};

export const Case: React.FC<P> = ({ s, dur }) => {
  const T = useT();
  const v = useV();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beat = useBeat();
  const W = v ? 1080 : 1920;
  const H = v ? 1920 : 1080;
  // the board is a larger virtual wall the camera travels over
  const BW = v ? 2400 : 3400;
  const BH = v ? 3400 : 2200;
  const note = v ? { w: 900, h: 760 } : { w: 1000, h: 720 };
  const nx = (BW - note.w) / 2;
  const ny = (BH - note.h) / 2;
  const ncx = BW / 2;
  const ncy = BH / 2;
  const cards = s.cards ?? [];
  const seed = hashStr(s.head ?? "case");

  // evidence placed on an ellipse around the note (seeded jitter), first card upper-right, clockwise
  const placed = useMemo(() => {
    const r = rng(seed);
    const n = Math.max(cards.length, 1);
    const rx = v ? 560 : 900;
    const ry = v ? 780 : 560;
    return cards.map((c, i) => {
      const a = -Math.PI / 3 + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.25;
      const b = boxOf(c);
      const cx = ncx + Math.cos(a) * rx;
      const cy = ncy + Math.sin(a) * ry;
      return { c, b, x: cx - b.w / 2, y: cy - b.h / 2, cx, cy, rot: c.rot ?? (r() - 0.5) * 8 };
    });
  }, [cards, v, ncx, ncy, seed]);

  const delays = cards.map((_, i) => beat(s, i, 40 + i * 30));
  const popEnd = 26;
  // camera keys in board px (x,y = point at the frame centre, z = zoom)
  const fit = Math.min(W / (BW * 0.92), H / (BH * 0.92));
  const zNote = Math.min(W / (note.w * 1.08), H / (note.h * 1.25));
  const zCard = v ? 1.6 : 1.25;
  // where a card should sit on screen while the camera is on it: upper-right of the frame in 9:16
  // (host photo is lower-left, caption mid-low), right half in 16:9 (host photo bottom-left)
  const aim = v ? { x: 0.6, y: 0.3 } : { x: 0.62, y: 0.42 };
  const keys: Cam[] = [{ f: 0, x: ncx, y: ncy, z: zNote * 1.04 }, { f: popEnd, x: ncx, y: ncy, z: zNote }];
  placed.forEach((p, i) => {
    const land = Math.max(delays[i], popEnd + 14 + i * 2);
    keys.push({ f: land, x: p.cx - (aim.x - 0.5) * W / zCard, y: p.cy - (aim.y - 0.5) * H / zCard, z: zCard });
  });
  const lastLand = keys[keys.length - 1].f;
  const wideAt = Math.min(dur - 4, Math.max(lastLand + 36, popEnd + 40));
  keys.push({ f: wideAt, x: ncx, y: ncy + (v ? 120 : 60), z: fit * 1.18 });
  // slow drift on the final wide
  const cam = camAt(keys, f);
  const drift = interpolate(f, [wideAt, dur], [1, 1.04], cl);
  const z = cam.z * (f > wideAt ? drift : 1);
  const tx = W / 2 - cam.x * z;
  const ty = H / 2 - cam.y * z;

  // text pop
  const sp = (d: number) => spring({ frame: f - d, fps, config: { damping: 9, stiffness: 160, mass: 0.7 } });
  const display = T.display ?? T.serif;
  const ink = T.noteInk ?? "#1B1712";
  const up = T.uppercase ? ("uppercase" as const) : undefined;
  const big = s.size ?? 170;
  const kicker = s.kicker ?? "";
  const typed = kicker.slice(0, Math.max(0, Math.floor((f - 1) * 1.6)));

  return (
    <AbsoluteFill style={{ isolation: "isolate", overflow: "hidden", background: T.bg }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: BW, height: BH, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${z})` }}>
        {/* wall */}
        <CaseWall BW={BW} BH={BH} seed={seed} avoid={{ x: nx - 60, y: ny - 60, w: note.w + 120, h: note.h + 120 }} />
        {/* strings */}
        <svg width={BW} height={BH} style={{ position: "absolute", inset: 0, zIndex: 3, overflow: "visible" }}>
          {placed.map((p, i) =>
            p.c.kind === "stamp" ? null : <PinString key={i} a={[ncx, ny + 26]} b={[p.cx, p.y + 10]} from={delays[i] + 4} dur={14} />,
          )}
          {placed.map((p, i) =>
            p.c.kind === "stamp" ? null : <PenCircle key={`c${i}`} cx={p.cx} cy={p.cy} rx={p.b.w * 0.66} ry={p.b.h * 0.7} from={delays[i] + 10} seed={seed + i} />,
          )}
        </svg>
        {/* headline note */}
        <div style={{ position: "absolute", left: nx, top: ny, width: note.w, height: note.h, zIndex: 4 }}>
          <TornPaper seed={seed} rot={-1} style={{ inset: 0, width: note.w, height: note.h }} amp={1.4}>
            <div style={{ position: "absolute", inset: "54px 44px 44px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 8 }}>
              {kicker && <div style={{ fontFamily: T.typeFace ?? T.sans, fontSize: 30, letterSpacing: 4, color: T.accentInk ?? T.accent, minHeight: 36 }}>{typed}</div>}
              {s.head && <div style={{ fontFamily: display, fontSize: big, lineHeight: 0.95, color: ink, textTransform: up, transform: `scale(${sp(3)})` }}>{s.head}</div>}
              {s.hi && (
                <div style={{ fontFamily: display, fontSize: big * 0.62, lineHeight: 1, textTransform: up, margin: "10px 0", transform: `scale(${sp(9)})` }}>
                  <TornStrip delay={11} pad="0.06em 0.28em 0.1em">{s.hi}</TornStrip>
                </div>
              )}
              {s.tail && <div style={{ fontFamily: display, fontSize: big * 0.55, lineHeight: 1, color: ink, textTransform: up, transform: `scale(${sp(14)})` }}>{s.tail}</div>}
            </div>
          </TornPaper>
          <Pin x={note.w / 2} y={26} />
        </div>
        {/* evidence */}
        {placed.map((p, i) => {
          const d = delays[i];
          const k = spring({ frame: f - d, fps, config: { damping: 13, stiffness: 140, mass: 0.8 } });
          if (f < d) return null;
          return (
            <div key={i} style={{ position: "absolute", left: p.x, top: p.y, zIndex: 5, opacity: interpolate(f - d, [0, 3], [0, 1], cl), transform: `translateY(${(1 - k) * -50}px) rotate(${p.rot}deg) scale(${1.1 - 0.1 * k})`, transformOrigin: "50% 0" }}>
              {p.c.kind === "photo" && p.c.img && <Polaroid img={p.c.img} w={p.c.w ?? 300} caption={p.c.caption} redact={p.c.redact} seed={i + 3} />}
              {p.c.kind === "note" && <Note title={p.c.title} items={p.c.items} w={p.c.w ?? 340} delayItems={d + 6} seed={i + 3} />}
              {p.c.kind === "stamp" && <Stamp text={p.c.title ?? ""} delay={d} rot={p.rot - 6} size={64} />}
              {p.c.kind !== "stamp" && <Pin x={p.b.w / 2} y={10} />}
            </div>
          );
        })}
      </div>
      <AgedPaper seed={seed} />
      {s.host && <HostFace img={s.host} delay={popEnd - 4} v={v} seed={seed} />}
      <CreditTag credit={s.credit} />
    </AbsoluteFill>
  );
};
