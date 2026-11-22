import React from "react";
import { VoxExplainer, VOX_KRITLIFE, VOX_FPS } from "../vox";
import { SCENES, CUES, DURATION } from "./VoxDocData";

// KRITLIFE TECH — VOX-style documentary, now a thin preset over the reusable kit in src/vox.
export const FPS = VOX_FPS;
export const VOX_TOTAL = Math.round(DURATION * FPS);
export const D = VOX_KRITLIFE;

export const VoxDoc: React.FC = () => (
  <VoxExplainer
    theme="kritlife"
    scenes={SCENES}
    cues={CUES}
    duration={DURATION}
    audio="mix.wav"
    assetBase="kritlife/vox"
    brand={{ name: "KRITLIFE ", hi: "TECH" }}
    labels={{ illustration: "ภาพประกอบ" }}
  />
);
