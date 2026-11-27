"""Interval Doctrine — a book of plates. Renders cover + figs i, iii, iv, v and
binds them with fig. ii (from make_canvas.py) into one PDF."""
import math
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONTS = "/root/.claude/skills/synced/fee26923-348a-4920-a6b5-62b91ba00384_c4aba766-37df-4b07-83aa-d082cd1f0cf0/canvas-design/canvas-fonts/"
DIR = "/home/user/OpenMontage/canvas/"
W, H, S = 3600, 5400, 2
PAPER = (237, 231, 219)
INK = (30, 28, 26)
RED = (176, 64, 50)
M = 300
FX0, FX1 = 432, 3168           # field (shared with fig. ii)
FY0, FY1 = 600, 4182
RULE_Y = 4332
COLS, PITCH_X, GAP = 24, 114.0, 22
CW = PITCH_X - GAP
CH = round(CW / 1.375)
PITCH_Y = CH + GAP
RADIUS = 9
HAIR = 1.6

def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

def quant(t, steps=64):
    return round(t * steps) / steps

class Page:
    def __init__(self, ground=PAPER, ink=INK):
        self.ground, self.ink = ground, ink
        self.img = Image.new("RGB", (W * S, H * S), ground)
        self.d = ImageDraw.Draw(self.img)
        self.boxes = []

    def tone(self, t):                      # 0 = ground, 1 = ink
        return mix(self.ground, self.ink, t)

    def P(self, *v):
        return [round(x * S) for x in v]

    def font(self, name, size):
        return ImageFont.truetype(FONTS + name, round(size * S))

    def text(self, x, y, s, f, fill=None, track=0.0, anchor="l"):
        fill = fill or self.ink
        widths = [f.getlength(ch) / S for ch in s]
        total = sum(widths) + track * (len(s) - 1)
        if anchor == "r": x -= total
        elif anchor == "m": x -= total / 2
        asc, desc = f.getmetrics()
        cx = x
        for ch, w in zip(s, widths):
            self.d.text((cx * S, y * S), ch, font=f, fill=fill, anchor="ls")
            cx += w + track
        self.boxes.append((s, x, y - asc / S, x + total, y + desc / S))

    def line(self, x0, y0, x1, y1, fill, w=HAIR):
        self.d.line(self.P(x0, y0, x1, y1), fill=fill, width=max(1, round(w * S)))

    def cell(self, x, y, w, h, fill=None, outline=None, r=RADIUS, ow=1.1):
        self.d.rounded_rectangle(self.P(x, y, x + w, y + h), radius=r * S,
                                 fill=fill, outline=outline, width=max(1, round(ow * S)))

    def col_labels(self):
        f = self.font("DMMono-Regular.ttf", 21)
        for c in range(COLS):
            cx = FX0 + c * PITCH_X + PITCH_X / 2
            self.text(cx, FY0 - 44, f"{c:02d}", f, fill=self.tone(0.72), anchor="m")
            self.line(cx, FY0 - 30, cx, FY0 - 16, self.tone(0.6))

    def plate(self, title, line, meta, title_size=104, track=20):
        self.line(FX0, RULE_Y, FX1, RULE_Y, self.ink)
        ty = RULE_Y + 190
        self.text(FX0, ty, title, self.font("Italiana-Regular.ttf", title_size), track=track)
        self.text(FX0, ty + 108, line, self.font("InstrumentSerif-Italic.ttf", 50), fill=self.tone(0.82))
        fm = self.font("IBMPlexMono-Regular.ttf", 25)
        for i, s in enumerate(meta):
            self.text(FX1, ty + 20 + i * 44, s, fm, fill=self.tone(0.78), track=3, anchor="r")

    def finish(self, name):
        ok = True
        for s, x0, y0, x1, y1 in self.boxes:
            if x0 < M - 1 or x1 > W - M + 1 or y0 < M - 1 or y1 > H - M + 1:
                print("  OUT OF MARGIN:", s); ok = False
        for i in range(len(self.boxes)):
            for j in range(i + 1, len(self.boxes)):
                a, b = self.boxes[i], self.boxes[j]
                if a[1] < b[3] and b[1] < a[3] and a[2] < b[4] and b[2] < a[4]:
                    print("  OVERLAP:", a[0], "/", b[0]); ok = False
        img = self.img.resize((W, H), Image.LANCZOS)
        noise = Image.effect_noise((W, H), 22).filter(ImageFilter.GaussianBlur(0.6))
        img = Image.blend(img, Image.merge("RGB", (noise,) * 3), 0.035)
        img.save(DIR + name, dpi=(300, 300))
        print(name, "checks ok" if ok else "CHECKS FAILED")
        return img

# ---------------------------------------------------------------- cover --
def cover():
    p = Page()
    aw = (FX1 - FX0) / 2
    ah = aw / 1.375
    ax0 = (W - aw) / 2
    ay0 = 1560
    p.cell(ax0, ay0, aw, ah, outline=INK, r=RADIUS * 6, ow=HAIR)
    # cue mark: upper-right of the aperture
    cr, inset = 15, aw * 0.075
    cx, cy = ax0 + aw - inset, ay0 + inset
    p.d.ellipse(p.P(cx - cr, cy - cr, cx + cr, cy + cr), fill=RED)
    p.plate("INTERVAL DOCTRINE", "plates on the space between.",
            ["PL. 24  —  VOL. I", "SIX PLATES", "MMXXVI"], title_size=128, track=26)
    return p.finish("book-0-cover.png")

# ------------------------------------------------------ i. persistence --
def persistence():
    p = Page()
    cols, rows, gx = 4, 6, 60
    fw = (FX1 - FX0 - (cols - 1) * gx) / cols
    fh = round(fw / 1.375)
    gy = (FY1 - FY0 - rows * fh) / (rows - 1)
    fl = p.font("DMMono-Regular.ttf", 21)
    th_max = math.radians(36)
    def angle(f):
        return th_max * math.cos(2 * math.pi * f / 24)
    for f in range(24):
        r, c = divmod(f, cols)
        x0 = FX0 + c * (fw + gx)
        y0 = FY0 + r * (fh + gy)
        p.cell(x0, y0, fw, fh, fill=p.tone(0.035), outline=p.tone(0.30))
        px, py = x0 + fw / 2, y0 + fh * 0.13
        L = fh * 0.66
        # the path, as a faint arc
        p.d.arc(p.P(px - L, py - L, px + L, py + L),
                start=90 - math.degrees(th_max), end=90 + math.degrees(th_max),
                fill=p.tone(0.16), width=round(1.2 * S))
        # afterimages, oldest first
        for k in range(5, 0, -1):
            th = angle(f - k)
            gx_, gy_ = px + L * math.sin(th), py + L * math.cos(th)
            rr = 26
            p.d.ellipse(p.P(gx_ - rr, gy_ - rr, gx_ + rr, gy_ + rr),
                        fill=p.tone(quant(0.42 * (1 - k / 6) ** 1.6)))
        th = angle(f)
        bx, by = px + L * math.sin(th), py + L * math.cos(th)
        p.line(px, py, bx, by, p.tone(0.85), w=1.4)
        p.d.ellipse(p.P(px - 6, py - 6, px + 6, py + 6), fill=p.tone(0.85))
        rr = 26
        p.d.ellipse(p.P(bx - rr, by - rr, bx + rr, by + rr), fill=RED if f == 12 else INK)
        p.text(x0, y0 + fh + 46, f"{f:02d}", fl, fill=p.tone(0.72))
    p.plate("STUDY OF PERSISTENCE", "the eye keeps what has already gone.",
            ["PL. 24  —  FIG. i", "24 APERTURES  ×  1 SECOND", "AFTERIMAGE  5 FRAMES"])
    return p.finish("book-1-persistence.png")

# -------------------------------------------------------- iii. adjacency --
def adjacency():
    p = Page()
    rows = 19
    ph = rows * PITCH_Y - GAP
    gap = (FY1 - FY0) - 2 * ph
    BR, BC = 8, 14                       # same 3x3 block in both fields
    for k, (lo, hi) in enumerate(((0.70, 0.90), (0.04, 0.22))):
        top = FY0 + k * (ph + gap)
        for r in range(rows):
            for c in range(COLS):
                if BR <= r < BR + 3 and BC <= c < BC + 3:
                    continue
                t = quant(lo + (hi - lo) * ((c + r * 0.35) / (COLS - 1 + rows * 0.35)))
                x = FX0 + c * PITCH_X + GAP / 2
                y = top + r * PITCH_Y
                p.cell(x, y, CW, CH, fill=p.tone(t), outline=p.tone(min(1, t + 0.14)))
        bx = FX0 + BC * PITCH_X + GAP / 2
        by = top + BR * PITCH_Y
        p.cell(bx, by, 3 * PITCH_X - GAP, 3 * PITCH_Y - GAP, fill=p.tone(0.5),
               outline=p.tone(0.64), r=RADIUS * 1.5)
    # the one relation: a red hairline across the gap
    cx = FX0 + (BC + 1.5) * PITCH_X
    p.line(cx, FY0 + ph + 34, cx, FY0 + ph + gap - 34, RED, w=2.0)
    p.col_labels()
    p.plate("STUDY OF ADJACENCY", "the same frame, twice, is never the same.",
            ["PL. 24  —  FIG. iii", "2 FIELDS  ×  456 APERTURES", "ONE TONE  0.50"])
    return p.finish("book-3-adjacency.png")

# ---------------------------------------------------------- iv. splice --
def splice():
    p = Page()
    rows = 40
    cut = [round(27 - 16 * math.sin(math.pi * c / (COLS - 1))) for c in range(COLS)]
    apex = min(range(COLS), key=lambda c: (cut[c], c))
    for c in range(COLS):
        x = FX0 + c * PITCH_X + GAP / 2
        for r in range(rows):
            y = FY0 + r * PITCH_Y + (PITCH_Y / 2 if r >= cut[c] else 0)
            if r < cut[c]:
                t = quant(0.05 + 0.22 * r / rows)
            else:
                t = quant(0.58 + 0.30 * (r - cut[c]) / rows)
            red = (c == apex and r == cut[c])
            p.cell(x, y, CW, CH, fill=RED if red else p.tone(t),
                   outline=RED if red else p.tone(min(1, t + 0.14)))
    p.col_labels()
    p.plate("STUDY OF THE SPLICE", "every seam, joined, becomes a horizon.",
            ["PL. 24  —  FIG. iv", "24 STRIPS  ×  40 FRAMES", "24 SLIPS  1/2 PITCH"])
    return p.finish("book-4-splice.png")

# ---------------------------------------------------------- v. leader --
def leader():
    p = Page(ground=(26, 24, 23), ink=PAPER)
    rows = 40
    N = rows * COLS
    for r in range(rows):
        for c in range(COLS):
            f = r * COLS + c
            light = max(0.0, 1 - f / 380) ** 2.2
            t = quant(0.62 * light)
            o = 0.20 - 0.13 * (f / (N - 1))
            x = FX0 + c * PITCH_X + GAP / 2
            y = FY0 + r * PITCH_Y + PITCH_Y / 2
            p.cell(x, y, CW, CH, fill=p.tone(t), outline=p.tone(max(t + 0.06, o)))
    # end-of-reel cue: upper right of the last aperture
    lx = FX0 + (COLS - 1) * PITCH_X + GAP / 2
    ly = FY0 + (rows - 1) * PITCH_Y + PITCH_Y / 2
    cr = 7
    cx, cy = lx + CW - 17, ly + 17
    p.d.ellipse(p.P(cx - cr, cy - cr, cx + cr, cy + cr), fill=RED)
    p.col_labels()
    p.plate("STUDY OF THE LAST LIGHT", "and then, only the gap remains.",
            ["PL. 24  —  FIG. v", "960 APERTURES", "LIGHT  1.00  →  0.00"])
    return p.finish("book-5-last-light.png")

if __name__ == "__main__":
    which = sys.argv[1:] or ["cover", "persistence", "adjacency", "splice", "leader", "bind"]
    fns = dict(cover=cover, persistence=persistence, adjacency=adjacency, splice=splice, leader=leader)
    for w in which:
        if w in fns:
            fns[w]()
    if "bind" in which:
        order = ["book-0-cover.png", "book-1-persistence.png", "interval-doctrine.png",
                 "book-3-adjacency.png", "book-4-splice.png", "book-5-last-light.png"]
        pages = [Image.open(DIR + n).convert("RGB") for n in order]
        pages[0].save(DIR + "interval-doctrine-book.pdf", "PDF", resolution=300.0,
                      save_all=True, append_images=pages[1:])
        sp = "/tmp/claude-0/-home-user-OpenMontage/4b468a38-2c66-509b-b955-6900b35e0a3e/scratchpad/"
        thumbs = [pg.resize((W // 6, H // 6), Image.LANCZOS) for pg in pages]
        sheet = Image.new("RGB", (3 * W // 6 + 80, 2 * H // 6 + 60), (200, 200, 200))
        for i, t in enumerate(thumbs):
            sheet.paste(t, (20 + (i % 3) * (W // 6 + 20), 20 + (i // 3) * (H // 6 + 20)))
        sheet.save(sp + "contact.png")
        print("bound", len(pages), "pages")
