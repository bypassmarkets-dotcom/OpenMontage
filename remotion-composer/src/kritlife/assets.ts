import grain from "./assets/tex/grain.png";
import paperTex from "./assets/tex/paper_tex.jpg";
import paper from "./assets/tex/paper.jpg";
import corkTile from "./assets/tex/cork_tile.jpg";
import hostFront from "./assets/host/front.webp";
import hostThink from "./assets/host/think.webp";
import hostArms from "./assets/host/arms.webp";
import city from "./assets/footage/city.jpg";
import serverAisle from "./assets/footage/server_aisle.jpg";
import newsOld from "./assets/footage/news_old.jpg";

export const TEX = { grain, paperTex, paper, corkTile } as const;
/** Background-removed host poses (1024²). The full set of 16 lives in the kritlife source zip. */
export const HOST = { front: hostFront, think: hostThink, arms: hostArms } as const;
/** Openverse CC B-roll — see assets/footage/CREDITS.md. Always graded with PHOTO_GRADE. */
export const FOOTAGE = { city, serverAisle, newsOld } as const;
export type HostPose = keyof typeof HOST;
