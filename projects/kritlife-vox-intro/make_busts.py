"""Crop each transparent host cut-out (public/vox/host/host-<pose>-cut.png) to a head-and-shoulders
bust (host-<pose>-bust.png) so the face reads clearly at about a quarter of the frame.
Heuristic on the alpha mask: head band = top 16% of the person; crop is centred on the head,
3.1 head-widths tall, aspect 1.25:1, with a little headroom. Run: python3 make_busts.py"""
from pathlib import Path
import numpy as np
from PIL import Image

D = Path(__file__).resolve().parents[2] / "remotion-composer/public/vox/host"
for p in sorted(D.glob("host-*-cut.png")):
    im = Image.open(p).convert("RGBA")
    a = np.array(im)[:, :, 3] > 40
    rows = np.where(a.any(1))[0]
    top, bot = rows[0], rows[-1]
    band = a[top: top + max(8, int((bot - top) * 0.16))]
    xs = np.where(band.any(0))[0]
    spans = [np.where(r)[0] for r in band if r.any()]
    head_w = float(np.median([s[-1] - s[0] for s in spans[len(spans) // 3:]] or [xs[-1] - xs[0]]))
    cx = float(np.mean([(s[0] + s[-1]) / 2 for s in spans]))
    ch = min(im.height * 1.0, head_w * 3.1)
    cw = ch * 1.25
    y0 = top - ch * 0.08
    box = (int(cx - cw / 2), int(y0), int(cx + cw / 2), int(y0 + ch))
    canvas = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), (0, 0, 0, 0))
    canvas.paste(im.crop((max(0, box[0]), max(0, box[1]), min(im.width, box[2]), min(im.height, box[3]))),
                 (max(0, -box[0]), max(0, -box[1])))
    out = p.with_name(p.name.replace("-cut.png", "-bust.png"))
    canvas.resize((1000, 800), Image.LANCZOS).save(out)
    print(out.name, box, round(head_w))
