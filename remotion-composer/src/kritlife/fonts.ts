import { cancelRender, continueRender, delayRender } from "remotion";

import archivo from "./assets/fonts/ArchivoBlack-Regular.ttf";
import plex400 from "./assets/fonts/IBMPlexSansThai-Regular.ttf";
import plex500 from "./assets/fonts/IBMPlexSansThai-Medium.ttf";
import plex600 from "./assets/fonts/IBMPlexSansThai-SemiBold.ttf";
import plex700 from "./assets/fonts/IBMPlexSansThai-Bold.ttf";
import mono400 from "./assets/fonts/IBMPlexMono-Regular.ttf";
import mono500 from "./assets/fonts/IBMPlexMono-Medium.ttf";
import serifItalic from "./assets/fonts/InstrumentSerif-Italic.ttf";

/**
 * Bundled fonts (SIL OFL 1.1), so a render needs no network.
 * Registration is deferred to a microtask for the same reason as
 * ../lib/localFonts.ts: a delayRender handle created during bundle
 * evaluation can be wiped by Remotion's own init.
 */
const FACES: Array<[family: string, url: string, weight: string, style: "normal" | "italic"]> = [
  ["Archivo Black", archivo, "400", "normal"],
  ["IBM Plex Sans Thai", plex400, "400", "normal"],
  ["IBM Plex Sans Thai", plex500, "500", "normal"],
  ["IBM Plex Sans Thai", plex600, "600", "normal"],
  ["IBM Plex Sans Thai", plex700, "700", "normal"],
  ["IBM Plex Mono", mono400, "400", "normal"],
  ["IBM Plex Mono", mono500, "500", "normal"],
  ["Instrument Serif", serifItalic, "400", "italic"],
];

let started = false;

export const loadKritlifeFonts = () => {
  if (started || typeof FontFace === "undefined") return;
  started = true;
  for (const [family, url, weight, style] of FACES) {
    queueMicrotask(() => {
      const key = `${family} ${weight} ${style}`;
      const handle = delayRender(`Loading kritlife font ${key}`);
      const face = new FontFace(family, `url(${url}) format('truetype')`, { weight, style });
      face
        .load()
        .then(() => {
          document.fonts.add(face);
          continueRender(handle);
        })
        // Never fall back to a system font silently.
        .catch((err) => cancelRender(new Error(`kritlife font ${key} failed to load: ${err}`)));
    });
  }
};
