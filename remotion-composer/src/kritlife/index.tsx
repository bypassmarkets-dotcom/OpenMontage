import React from "react";
import { Composition, registerRoot } from "remotion";
import { VoxDoc, VOX_TOTAL, FPS } from "./VoxDoc";

const Root: React.FC = () => (
  <>
    <Composition id="KritVoxDoc169" component={VoxDoc} durationInFrames={VOX_TOTAL} fps={FPS} width={1920} height={1080} />
    <Composition id="KritVoxDoc916" component={VoxDoc} durationInFrames={VOX_TOTAL} fps={FPS} width={1080} height={1920} />
  </>
);

registerRoot(Root);
