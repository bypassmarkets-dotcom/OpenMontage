// Display + hand fonts for the paper presets (dossier / collage), bundled in src/fonts so renders
// need no network (headless Chromium cannot reach Google Fonts behind some proxies) and are
// deterministic. Registered ONLY when a theme asks for them (theme.paperFonts), so the other
// presets are untouched. Files are the exact woff2s @remotion/google-fonts requests.
//   display: Anton (condensed caps, OFL)        -> Kanit 800/900 for Thai (OFL)
//   hand:    Permanent Marker (Apache 2.0)      -> Mali 700 for Thai (OFL)
//   type:    Special Elite (typewriter, Apache 2.0)
// Licences: src/fonts/*-OFL.txt, src/fonts/*-LICENSE.txt
import { LATIN_RANGE, registerBundledFont } from "../lib/localFonts";
import antonLatin from "../fonts/Anton-latin.woff2";
import kanit800Latin from "../fonts/Kanit-800-latin.woff2";
import kanit800Thai from "../fonts/Kanit-800-thai.woff2";
import kanit900Latin from "../fonts/Kanit-900-latin.woff2";
import kanit900Thai from "../fonts/Kanit-900-thai.woff2";
import mali700Latin from "../fonts/Mali-700-latin.woff2";
import mali700Thai from "../fonts/Mali-700-thai.woff2";
import markerLatin from "../fonts/PermanentMarker-latin.woff2";
import eliteLatin from "../fonts/SpecialElite-latin.woff2";

const THAI_RANGE = "U+02D7, U+0303, U+0331, U+0E01-0E5B, U+200C-200D, U+25CC";

export type PaperFonts = { display: string; hand: string; type: string };

let cache: PaperFonts | null = null;

export const paperFonts = (): PaperFonts => {
  if (cache) return cache;
  const anton = registerBundledFont("Vox Anton", antonLatin, "normal", ["400"]);
  const kanit = registerBundledFont("Vox Kanit", kanit800Latin, "normal", ["800"]);
  registerBundledFont("Vox Kanit", kanit800Thai, "normal", ["800"], THAI_RANGE);
  registerBundledFont("Vox Kanit", kanit900Latin, "normal", ["900"], LATIN_RANGE);
  registerBundledFont("Vox Kanit", kanit900Thai, "normal", ["900"], THAI_RANGE);
  const mali = registerBundledFont("Vox Mali", mali700Latin, "normal", ["700"]);
  registerBundledFont("Vox Mali", mali700Thai, "normal", ["700"], THAI_RANGE);
  const marker = registerBundledFont("Vox Marker", markerLatin, "normal", ["400"]);
  const elite = registerBundledFont("Vox Elite", eliteLatin, "normal", ["400"]);
  cache = {
    // Thai glyphs fall through to Kanit / Mali (Anton and Marker have no Thai)
    display: `'${anton}', '${kanit}', 'Noto Sans Thai', sans-serif`,
    hand: `'${marker}', '${mali}', cursive`,
    type: `'${elite}', 'Noto Sans Thai', monospace`,
  };
  return cache;
};
