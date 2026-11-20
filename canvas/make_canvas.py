"""Study of the Interval — Interval Doctrine, Pl. 24.  Renders PNG + PDF."""
import math, random, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONTS = "/root/.claude/skills/synced/fee26923-348a-4920-a6b5-62b91ba00384_c4aba766-37df-4b07-83aa-d082cd1f0cf0/canvas-design/canvas-fonts/"
OUT = "/home/user/OpenMontage/canvas/interval-doctrine"

W, H = 3600, 5400          # final pixels (12 x 18 in @ 300 dpi)
S = 2                      # supersample factor
PAPER = (237, 231, 219)
INK = (30, 28, 26)
RED = (176, 64, 50)        # muted safelight

# ---- grid system --------------------------------------------------------
COLS, ROWS = 24, 40
CUT_ROW = 25                         # shot A = rows 0..24 (600 frames)
M = 300                              # outer margin
GUT = 132                            # tick gutter either side of the field
FX0 = M + GUT                        # field left
FX1 = W - M - GUT                    # field right
PITCH_X = (FX1 - FX0) / COLS         # 114
GAP = 22
CW = PITCH_X - GAP                   # cell width  92
CH = round(CW / 1.375)               # cell height (academy-ish ratio)
PITCH_Y = CH + GAP
CUT_EXTRA = PITCH_Y / 2              # the half-step slip at the cut
FY0 = 600                            # field top
RADIUS = 9

def row_y(r):
    return FY0 + r * PITCH_Y + (CUT_EXTRA if r >= CUT_ROW else 0)

FY1 = row_y(ROWS - 1) + CH           # field bottom

def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

def quant(t, steps=64):
    return round(t * steps) / steps

def tone(r, c):
    if r < CUT_ROW:                       # shot A: slow exposure, light -> dark
        f = r * COLS + c
        t = f / (CUT_ROW * COLS - 1)
        return quant(0.035 + 0.80 * (t ** 1.18))
    f = (r - CUT_ROW) * COLS + c          # shot B: begins mid-dark, recedes
    t = f / ((ROWS - CUT_ROW) * COLS - 1)
    return quant(0.62 - 0.50 * (t ** 0.85))

# ---- canvas -------------------------------------------------------------
img = Image.new("RGB", (W * S, H * S), PAPER)
d = ImageDraw.Draw(img)

def font(name, size):
    return ImageFont.truetype(FONTS + name, round(size * S))

def P(*v):
    return [round(x * S) for x in v]

boxes = []  # final-unit bboxes of text, for overlap checking

def text(x, y, s, f, fill=INK, track=0.0, anchor="l"):
    """Draw tracked text; (x, y) = left/right edge & baseline in final units."""
    widths = [f.getlength(ch) / S for ch in s]
    total = sum(widths) + track * (len(s) - 1)
    if anchor == "r":
        x -= total
    elif anchor == "m":
        x -= total / 2
    asc, desc = f.getmetrics()
    cx = x
    for ch, w in zip(s, widths):
        d.text((cx * S, y * S), ch, font=f, fill=fill, anchor="ls")
        cx += w + track
    boxes.append((s, x, y - asc / S, x + total, y + desc / S))
    return total

# cells
for r in range(ROWS):
    y = row_y(r)
    for c in range(COLS):
        x = FX0 + c * PITCH_X + GAP / 2
        is_red = (r == CUT_ROW and c == 0)
        t = tone(r, c)
        fill = RED if is_red else mix(PAPER, INK, t)
        d.rounded_rectangle(P(x, y, x + CW, y + CH), radius=RADIUS * S,
                            fill=fill, outline=RED if is_red else mix(PAPER, INK, min(1.0, t + 0.14)),
                            width=max(1, round(1.1 * S)))

HAIR = 1.6
# column indices above field
fm_small = font("DMMono-Regular.ttf", 21)
for c in range(COLS):
    cx = FX0 + c * PITCH_X + PITCH_X / 2
    text(cx, FY0 - 44, f"{c:02d}", fm_small, fill=mix(PAPER, INK, 0.72), anchor="m")
    d.line(P(cx, FY0 - 30, cx, FY0 - 16), fill=mix(PAPER, INK, 0.6), width=round(HAIR * S))

# row ticks: left labelled, right bare
for r in range(ROWS):
    cy = row_y(r) + CH / 2
    long = (r % 5 == 0) or r == CUT_ROW
    lx1 = FX0 - 18
    d.line(P(lx1 - (34 if long else 16), cy, lx1, cy), fill=mix(PAPER, INK, 0.75), width=round(HAIR * S))
    rx0 = FX1 + 18
    d.line(P(rx0, cy, rx0 + (34 if long else 16), cy), fill=mix(PAPER, INK, 0.75), width=round(HAIR * S))
    if r % 5 == 0:
        text(lx1 - 50, cy + 7, f"{r:02d}", fm_small, fill=mix(PAPER, INK, 0.72), anchor="r")

# the cut: hairlines in the gutters marking the slip
cut_y = (row_y(CUT_ROW - 1) + CH + row_y(CUT_ROW)) / 2
for x0, x1 in ((M, FX0 - 70), (FX1 + 70, W - M)):
    d.line(P(x0, cut_y, x1, cut_y), fill=INK, width=round(HAIR * S))

# ---- plate block ---------------------------------------------------------
rule_y = FY1 + 150
d.line(P(FX0, rule_y, FX1, rule_y), fill=INK, width=round(HAIR * S))

f_title = font("Italiana-Regular.ttf", 104)
f_ital = font("InstrumentSerif-Italic.ttf", 50)
f_mono = font("IBMPlexMono-Regular.ttf", 25)

ty = rule_y + 190
text(FX0, ty, "STUDY OF THE INTERVAL", f_title, track=20)
text(FX0, ty + 108, "what is seen is what falls between.", f_ital, fill=mix(PAPER, INK, 0.82))

meta = ["PL. 24  —  FIG. ii", "24 APERTURES  ×  40 ROWS", "SLIP  1/2 PITCH  AT  600 | 601"]
my = ty + 20
for i, s in enumerate(meta):
    text(FX1, my + i * 44, s, f_mono, fill=mix(PAPER, INK, 0.78), track=3, anchor="r")


# ---- finish -------------------------------------------------------------
img = img.resize((W, H), Image.LANCZOS)

noise = Image.effect_noise((W, H), 22).filter(ImageFilter.GaussianBlur(0.6))
grain = Image.merge("RGB", (noise, noise, noise))
img = Image.blend(img, Image.composite(grain, img, Image.new("L", (W, H), 255)), 0.035)

# ---- checks -------------------------------------------------------------
ok = True
for s, x0, y0, x1, y1 in boxes:
    if x0 < M - 1 or x1 > W - M + 1 or y0 < M - 1 or y1 > H - M + 1:
        print("OUT OF MARGIN:", s, (x0, y0, x1, y1)); ok = False
for i in range(len(boxes)):
    for j in range(i + 1, len(boxes)):
        a, b = boxes[i], boxes[j]
        if a[1] < b[3] and b[1] < a[3] and a[2] < b[4] and b[2] < a[4]:
            print("OVERLAP:", a[0], "/", b[0]); ok = False
print("field", FX0, FX1, FY0, round(FY1), "pitch", PITCH_X, PITCH_Y, "rule", round(rule_y))
print("checks ok" if ok else "CHECKS FAILED")

img.save(OUT + ".png", dpi=(300, 300))
img.save(OUT + ".pdf", "PDF", resolution=300.0)
img.resize((W // 4, H // 4), Image.LANCZOS).save("/tmp/claude-0/-home-user-OpenMontage/4b468a38-2c66-509b-b955-6900b35e0a3e/scratchpad/preview.png")
