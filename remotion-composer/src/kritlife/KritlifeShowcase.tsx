import React from "react";
import { AbsoluteFill, Sequence, Series, useCurrentFrame, useVideoConfig } from "remotion";
import { FOOTAGE } from "./assets";
import {
  Backdrop,
  Caption,
  CaptionCue,
  ChapterWipe,
  Chrome,
  Compare,
  DataMeter,
  EvidenceBoard,
  Focus,
  Grain,
  Highlighter,
  HostCutout,
  Kicker,
  PaperCard,
  Plate,
  RichText,
  Rise,
  Source,
  Vignette,
} from "./components";
import { loadKritlifeFonts } from "./fonts";
import { FONT, K, LH, T, TRACK, useScale } from "./tokens";

loadKritlifeFonts();

/** Scene lengths in seconds. Total drives the composition duration. */
const SCENES = {
  hook: 4.5,
  wipe1: 2.6,
  collage: 4.5,
  board: 5.5,
  plate: 4.5,
  compare: 4.5,
  data: 4.5,
  outro: 3.5,
} as const;
export const KRITLIFE_SHOWCASE_SECONDS = Object.values(SCENES).reduce((a, b) => a + b, 0);

const at = (key: keyof typeof SCENES) => {
  let t = 0;
  for (const k of Object.keys(SCENES) as Array<keyof typeof SCENES>) {
    if (k === key) return t;
    t += SCENES[k];
  }
  return t;
};

const CUES: CaptionCue[] = [
  { s: 0.6, e: 2.4, x: "AI กำลัง[ฉลาดขึ้น]จริง ๆ" },
  { s: 2.4, e: 4.3, x: "หรือเราแค่เข้าใจมันน้อยกว่าที่คิด?" },
  { s: at("collage") + 0.4, e: at("collage") + 4.3, x: "สิ่งที่ดูน่าเชื่อ ไม่ได้แปลว่า[ถูกต้อง]" },
  { s: at("board") + 0.4, e: at("board") + 5.3, x: "ลองตามเส้นด้ายดูว่า ใครได้ประโยชน์" },
  { s: at("plate") + 0.4, e: at("plate") + 4.3, x: "ข้อมูลไหลเร็วกว่าที่เราตรวจสอบทัน" },
  { s: at("compare") + 0.4, e: at("compare") + 4.3, x: "คุณจะใช้มันทำงานเดิม หรือสร้าง[สิ่งใหม่]?" },
];

const Headline: React.FC<{ children: React.ReactNode; size?: number; weight?: number; color?: string }> = ({
  children,
  size = T.h1,
  weight = 700,
  color = K.paper,
}) => {
  const { s } = useScale();
  return (
    <div style={{ fontFamily: FONT.body, fontWeight: weight, fontSize: size * s, lineHeight: LH.tight, letterSpacing: TRACK.head, color }}>
      {children}
    </div>
  );
};

/** 01 · Hook: host cutout, kicker, a question with the highlighter on the turn. */
const HookScene: React.FC = () => {
  const { s, pad, vertical } = useScale();
  return (
    <Backdrop>
      <div style={{ position: "absolute", right: vertical ? -40 * s : pad * 0.4, bottom: -60 * s }}>
        <HostCutout pose="front" at={0.2} size={vertical ? 900 : 980} />
      </div>
      <div style={{ position: "absolute", left: pad, top: (vertical ? 260 : 220) * s, width: (vertical ? 900 : 1100) * s, display: "flex", flexDirection: "column", gap: 28 * s }}>
        <Kicker at={0.15}>COLD OPEN</Kicker>
        <Rise at={0.55}>
          <Headline>AI กำลังฉลาดขึ้นจริง ๆ</Headline>
        </Rise>
        <Rise at={1.35}>
          <Headline size={T.h2} weight={600}>
            หรือเรา<Highlighter at={2.1}>เข้าใจมันน้อยลง</Highlighter>?
          </Headline>
        </Rise>
      </div>
    </Backdrop>
  );
};

/** 03 · Paper collage on a paper ground: found words rack into focus. */
const CollageScene: React.FC = () => {
  const { s, pad, vertical } = useScale();
  return (
    <Backdrop ground="paper">
      <div style={{ position: "absolute", left: pad, top: (vertical ? 260 : 200) * s, width: (vertical ? 860 : 980) * s, display: "flex", flexDirection: "column", gap: 40 * s }}>
        <Kicker at={0.15} color={K.signalDeep}>
          EXHIBIT 01
        </Kicker>
        <PaperCard at={0.4} rotate={-2.5} torn pin>
          <Focus at={0.9}>
            <Headline color={K.ink} size={T.h2}>
              น่าเชื่อ <span style={{ color: K.signalDeep }}>≠</span> ถูกต้อง
            </Headline>
          </Focus>
        </PaperCard>
        <div style={{ marginLeft: 120 * s, width: 780 * s }}>
          <PaperCard at={1.2} rotate={1.8} torn style={{ padding: `${28 * s}px ${34 * s}px` }}>
            <div style={{ fontFamily: FONT.body, fontWeight: 600, fontSize: 40 * s, lineHeight: LH.snug }}>
              <RichText onPaper text="ข้อมูลที่ถูก{ส่งต่อ} ไม่ใช่ข้อมูลที่ถูก[ยืนยัน]" />
            </div>
          </PaperCard>
        </div>
        <div style={{ fontFamily: FONT.editorial, fontStyle: "italic", fontSize: 44 * s, color: K.ink, marginLeft: 40 * s }}>— a printed case file, shot at night.</div>
      </div>
      <div style={{ position: "absolute", right: vertical ? -60 * s : pad, bottom: vertical ? -60 * s : -40 * s }}>
        <HostCutout pose="think" at={0.6} size={vertical ? 700 : 820} rotate={2} />
      </div>
    </Backdrop>
  );
};

const BoardScene: React.FC = () => {
  const { vertical } = useScale();
  return (
    <EvidenceBoard
      at={0.2}
      stamp="OPEN"
      items={
        vertical
          ? [
              { x: 30, y: 22, image: FOOTAGE.newsOld, rotate: -4, w: 420 },
              { x: 72, y: 34, text: "ใครจ่าย?", tag: "EXHIBIT 02", rotate: 3 },
              { x: 32, y: 50, text: "ใครได้?", tag: "EXHIBIT 03", rotate: -2 },
              { x: 70, y: 62, image: FOOTAGE.serverAisle, rotate: 4, w: 380 },
            ]
          : [
              { x: 22, y: 34, image: FOOTAGE.newsOld, rotate: -4, w: 460 },
              { x: 50, y: 26, text: "ใครจ่าย?", tag: "EXHIBIT 02", rotate: 3 },
              { x: 48, y: 68, text: "ใครได้?", tag: "EXHIBIT 03", rotate: -2 },
              { x: 78, y: 46, image: FOOTAGE.serverAisle, rotate: 4, w: 420 },
            ]
      }
      threads={[
        [0, 1],
        [1, 3],
        [0, 2],
        [2, 3],
      ]}
    />
  );
};

const PlateScene: React.FC = () => {
  const { s, pad, vertical } = useScale();
  return (
    <Plate src={FOOTAGE.city} protect={vertical ? "full" : "left"}>
      <div style={{ position: "absolute", left: pad, top: (vertical ? 520 : 320) * s, width: (vertical ? 900 : 1000) * s, display: "flex", flexDirection: "column", gap: 28 * s }}>
        <Kicker at={0.15}>THE CITY</Kicker>
        <Rise at={0.55}>
          <Headline>เมืองที่ไม่เคยหลับ</Headline>
        </Rise>
        <Rise at={1.35}>
          <Headline size={T.h3} weight={600} color={K.paperA(0.78)}>
            และข้อมูลที่ไม่เคยหยุด
          </Headline>
        </Rise>
        <Source at={2.6}>ภาพ: "Seattle city night" — Still Vision · CC BY 2.0 · Openverse</Source>
      </div>
      <Grain opacity={0.16} />
      <Vignette />
    </Plate>
  );
};

const CompareScene: React.FC = () => {
  const { s, pad, vertical } = useScale();
  return (
    <Backdrop>
      <div style={{ position: "absolute", left: pad, right: pad, top: (vertical ? 260 : 220) * s, display: "flex", flexDirection: "column", gap: 48 * s }}>
        <Kicker at={0.15}>TWO WAYS</Kicker>
        <Compare
          at={0.4}
          chosen="b"
          a={{ label: "A · เดิม", text: "ทำงานเดิมให้{เร็วขึ้น}" }}
          b={{ label: "B · ใหม่", text: "สร้างสิ่งที่เคยคิดว่า[ทำไม่ได้]" }}
        />
      </div>
    </Backdrop>
  );
};

const DataScene: React.FC = () => {
  const { s, pad, vertical } = useScale();
  return (
    <Backdrop>
      <div style={{ position: "absolute", left: pad, right: pad, top: (vertical ? 260 : 200) * s, display: "flex", flexDirection: "column", gap: 44 * s, maxWidth: 1300 * s }}>
        <Kicker at={0.15}>CONCEPT</Kicker>
        <Rise at={0.4}>
          <Headline size={T.h2}>เวลาที่ใช้ ไปอยู่ตรงไหน?</Headline>
        </Rise>
        <DataMeter
          at={0.8}
          rows={[
            { label: "ตรวจสอบ", value: 62, highlight: true },
            { label: "เขียน", value: 24 },
            { label: "เผยแพร่", value: 14 },
          ]}
          source="* แผนภาพประกอบแนวคิด ไม่ใช่ข้อมูลวัดจริง"
        />
      </div>
    </Backdrop>
  );
};

const OutroScene: React.FC = () => {
  const { s, pad, vertical } = useScale();
  return (
    <Backdrop>
      <div style={{ position: "absolute", left: pad, top: (vertical ? 520 : 240) * s, display: "flex", flexDirection: "column", gap: 34 * s }}>
        <Rise at={0.2}>
          <div style={{ fontFamily: FONT.display, fontSize: T.display * s * (vertical ? 1.3 : 1.4), lineHeight: 0.95, color: K.paper }}>
            KRITLIFE<span style={{ color: K.signal }}>■</span>
            <br />
            TECH
          </div>
        </Rise>
        {["01 Understand Technology.", "02 Think Differently.", "03 Create the Future."].map((line, i) => (
          <Rise key={line} at={0.9 + i * 0.3}>
            <div style={{ fontFamily: FONT.mono, fontWeight: 500, fontSize: 30 * s, letterSpacing: TRACK.source, color: i === 2 ? K.signal : K.paperA(0.72) }}>{line}</div>
          </Rise>
        ))}
      </div>
      <div style={{ position: "absolute", right: vertical ? -80 * s : pad, bottom: -60 * s }}>
        <HostCutout pose="arms" at={0.4} size={vertical ? 720 : 860} />
      </div>
    </Backdrop>
  );
};

/** Root overlay: chrome hidden during the chapter wipe and the outro. */
const Overlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const inWipe = t >= at("wipe1") && t < at("collage");
  const inOutro = t >= at("outro");
  const chapter = t < at("wipe1") ? "CH 00 / 04 — COLD OPEN" : t < at("plate") ? "CH 01 / 04 — THE QUESTION" : "CH 02 / 04 — THE METHOD";
  return (
    <>
      {inWipe || inOutro ? null : (
        <Chrome chapter={chapter} progress={frame / durationInFrames} ticks={4} footer={`F ${String(frame).padStart(6, "0")} · TH`} />
      )}
      <Caption cues={CUES} />
    </>
  );
};

/**
 * Walk-through of every kritlife component. Registered at 1080×1920 and
 * 1920×1080 from the same code: sizes come from useScale().
 */
export const KritlifeShowcase: React.FC = () => {
  const { fps } = useVideoConfig();
  const f = (sec: number) => Math.round(sec * fps);
  return (
    <AbsoluteFill style={{ backgroundColor: K.ink }}>
      <Series>
        <Series.Sequence durationInFrames={f(SCENES.hook)}>
          <HookScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={f(SCENES.wipe1)}>
          <Backdrop />
          <ChapterWipe n="01" of="04" title="THE QUESTION" thai="คำถาม" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={f(SCENES.collage)}>
          <CollageScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={f(SCENES.board)}>
          <BoardScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={f(SCENES.plate)}>
          <PlateScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={f(SCENES.compare)}>
          <CompareScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={f(SCENES.data)}>
          <DataScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={f(SCENES.outro)}>
          <OutroScene />
        </Series.Sequence>
      </Series>
      <Sequence>
        <Overlay />
      </Sequence>
    </AbsoluteFill>
  );
};

