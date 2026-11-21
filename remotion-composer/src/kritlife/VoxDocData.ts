// Scene + subtitle timing for VoxDoc. Filled from the verified Whisper transcript (seconds on the narration master).
export type SceneDef = {
  start: number;
  type: "title" | "photo" | "redact" | "split" | "network" | "big";
  chapter?: string;
  kicker?: string;
  head?: string;
  hi?: string;
  tail?: string;
  sub?: string;
  size?: number;
  items?: string[];
  at?: number[];
  img?: string;
  focus?: [number, number];
  left?: { label: string; text: string };
  right?: { label: string; text: string };
  hub?: string;
};
export type Cue = { s: number; e: number; t: string; hi?: string };

export const DURATION = 263.84;
export const SCENES: SceneDef[] = [{ start: 0, type: "big", kicker: "KRITLIFE TECH", head: "กำลังถอดเสียง…" }];
export const CUES: Cue[] = [];
