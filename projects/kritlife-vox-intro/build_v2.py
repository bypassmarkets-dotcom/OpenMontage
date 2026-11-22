"""KRITLIFE TECH intro v2 — storyboard source of truth.

One table drives both deliverables so they never drift:
  vox-v2.props.json  -> VoxExplainer / VoxExplainerVertical props (render data)
  storyboard-v2.md   -> human-readable storyboard (shot, VO, look, motion, SFX)

Narration (public/kritlife/vox/narration.mp3, 263.89 s) is the locked master; every time below
is seconds on it, taken from transcript.json. Looks are mixed by chapter: dossier (dark evidence
board) for the intro and the "other side of AI" chapter, collage (cream/gold) everywhere else.
Host cut-outs live in remotion-composer/public/vox/host/ (gitignored: personal likeness).

Run:  python3 projects/kritlife-vox-intro/build_v2.py
"""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).parent
DURATION = 263.89
H = "vox/host/host-{}-cut.png"  # transparent host cut-outs
P = "vox/proto/{}"  # CC0 / public-domain Openverse stills
K = "kritlife/vox/{}"

D, C = "dossier", "collage"


def card(kind, **kw):
    return {"kind": kind, "x": 0, "y": 0, **kw}


# 16:9 card slots (1920x1080 design px): right of the headline note, clear of the host (left),
# the brand (top-left) and the caption (bottom). 9:16 ignores x/y and re-flows into its own slots.
SLOTS_16 = [(1390, 110), (1630, 160), (1400, 450), (1635, 480), (1500, 760)]


def place16(cards: list[dict]) -> list[dict]:
    out = []
    for i, c in enumerate(cards):
        x, y = SLOTS_16[i % len(SLOTS_16)]
        out.append({**c, "x": x, "y": y, "w": min(c.get("w", 240), 240)})
    return out


# Each shot: scene props + storyboard-only fields (vo, motion, sfx).
SHOTS: list[dict] = [
    # ---------------- Ch1 บทนำ — DOSSIER ----------------
    dict(id="S01", start=0.0, theme=D, type="case", chapter="บทนำ",
         kicker="CASE FILE 01", head="เทคโนโลยี", hi="เร็วกว่า", tail="ที่มนุษย์จะตามทัน", size=150,
         cards=[card("photo", img=P.format("newsprint.webp"), caption="ทุกวันนี้", w=300, rot=-4),
                card("photo", img=P.format("map.webp"), caption="ยุคแห่งการเปลี่ยนแปลง", w=300, rot=3),
                card("stamp", title="ตามไม่ทัน", rot=-10)],
         at=[0.6, 2.2, 4.3], host="vox/host/host-surprised.jpg",
         vo="ทุกวันนี้ เรากำลังอยู่ในยุคที่เทคโนโลยีเปลี่ยนแปลงเร็วกว่าที่มนุษย์จะตามทัน",
         motion="note pin-drop → 2 clippings pin-drop on beats → stamp slam on “ตามทัน”; host springs up; push-in",
         sfx="paper rustle 0.0 · pin ticks 0.6/2.2 · stamp thud 4.3"),
    dict(id="S02", start=5.6, theme=D, type="split", chapter="บทนำ", kicker="จากอนาคต สู่ปัจจุบัน",
         left={"label": "เมื่อไม่กี่ปีก่อน", "text": "เรื่องของอนาคต"},
         right={"label": "วันนี้", "text": "เครื่องมือที่ใคร ๆ ก็เข้าถึงได้"}, at=[5.6, 9.4],
         vo="สิ่งที่เมื่อไม่กี่ปีก่อน เราเคยคิดว่าเป็นเรื่องของอนาคต / วันนี้ กลับกลายเป็นเครื่องมือที่ใครๆก็สามารถเข้าถึงได้",
         motion="left panel rises on 5.6, right on 9.4 with torn highlight", sfx="whoosh 5.6 · pop 9.4"),
    dict(id="S03", start=13.58, theme=D, type="case", chapter="บทนำ", kicker="EVIDENCE",
         head="AI", hi="ทำได้แล้ว", size=190,
         cards=[card("note", title="01", items=["เขียนบทความ"], w=300, rot=-3),
                card("note", title="02", items=["สร้างภาพยนตร์"], w=300, rot=2),
                card("note", title="03", items=["แต่งเพลง"], w=300, rot=-2),
                card("note", title="04", items=["วิเคราะห์ข้อมูล"], w=300, rot=3),
                card("note", title="05", items=["งานที่เคยใช้คนจำนวนมาก"], w=320, rot=-2)],
         links=[[-1, 0], [-1, 1], [-1, 2], [-1, 3], [-1, 4]],
         at=[13.9, 15.3, 16.4, 17.3, 19.2], host="vox/host/host-point.jpg",
         vo="ปัญญาประดิษฐ์สามารถเขียนบทความ สร้างภาพยนตร์ แต่งเพลง วิเคราะห์ข้อมูล หรือแม้แต่ช่วยเราทำงานที่ครั้งหนึ่งต้องใช้คนจำนวนมาก",
         motion="each evidence card pins on its word; red string draws note→card 6f after each pin",
         sfx="pin tick ×5 on beats"),
    dict(id="S04", start=22.56, theme=D, type="case", chapter="บทนำ", kicker="คำถามที่น่าสนใจกว่า",
         head="มนุษย์", hi="จะสร้างอะไร", tail="ได้บ้าง?", size=150,
         cards=[card("photo", img="vox/host/host-think.jpg", caption="ในวันที่ AI ฉลาดขึ้น", w=300, rot=-3),
                card("stamp", title="?", rot=8)],
         links=[[-1, 0]], at=[25.5, 27.7], host="vox/host/host-think.jpg",
         vo="แต่มีคำถามหนึ่งที่ผมคิดว่าน่าสนใจกว่า ในวันที่ AI ฉลาดขึ้นทุกวัน มนุษย์เราจะใช้ความสามารถเหล่านี้สร้างอะไรได้บ้าง",
         motion="polaroid pins on 25.5; “?” stamp slams on 27.7", sfx="pin 25.5 · stamp 27.7"),
    dict(id="S05", start=31.26, theme=D, type="typewriter", chapter="บทนำ", kicker="และนี่คือ",
         text="จุดเริ่มต้นของเรื่องราว",
         vo="และนี่คือจุดเริ่มต้นของเรื่องราวที่ผมอยากนำมาแบ่งปัน",
         motion="typewriter reveal; torn-paper ChapterWipe → collage centred on 34.94",
         sfx="type clicks · paper tear 34.9"),
    # ---------------- Ch2 ผมคือใคร — COLLAGE ----------------
    dict(id="S06", start=34.94, theme=C, type="collage", chapter="ผมคือใคร", kicker="สวัสดีครับ",
         head="KRITLIFE", hi="TECH", size=200, host=H.format("wave"),
         vo="สวัสดีครับ ผมคือผู้สร้างคอนเทนต์เบื้องหลัง KRITLIFE TECH",
         motion="type slams in (scale 1.25→1); gold disc spring; host waves up from below",
         sfx="paper tear (wipe) · pop 35.9"),
    dict(id="S07", start=38.5, theme=C, type="list", chapter="ผมคือใคร", kicker="พื้นที่เล็ก ๆ ที่ผมตั้งใจสร้าง",
         head="เพื่อ", hi="ทดลองเรียนรู้", size=88,
         items=["พูดคุย", "แลกเปลี่ยน", "ทดลองเรียนรู้", "เทคโนโลยี · AI · คอนเทนต์"], at=[40.8, 41.7, 42.6, 44.7],
         vo="พื้นที่เล็กๆที่ผมตั้งใจสร้างขึ้น เพื่อพูดคุย แลกเปลี่ยน และทดลองเรียนรู้เกี่ยวกับเทคโนโลยี ปัญญาประดิษฐ์ และโลกของการสร้างสรรค์คอนเทนต์",
         motion="items tick in on each word", sfx="pop ×4"),
    dict(id="S08", start=47.74, theme=C, type="split", chapter="ผมคือใคร", kicker="ตัวตนของผม",
         left={"label": "ไม่ใช่", "text": "ผู้เชี่ยวชาญที่รู้ทุกเรื่อง"},
         right={"label": "แต่เป็น", "text": "คนที่ชอบตั้งคำถาม"}, at=[47.9, 50.6],
         vo="ผมไม่ได้มองว่าตัวเองเป็นผู้เชี่ยวชาญที่รู้ทุกเรื่อง แต่ผมเป็นคนหนึ่งที่ชอบตั้งคำถาม",
         motion="left in 47.9, right in 50.6", sfx="pop 50.6"),
    dict(id="S09", start=52.8, theme=C, type="collage", chapter="ผมคือใคร", kicker="ชอบทดลอง · ชอบค้นหา",
         head="มันทำงาน", hi="อย่างไร?", size=170, host=H.format("think"),
         img=P.format("columns.jpg"), items=["ทดลอง", "ค้นหา", "ใช้ได้จริง"], at=[52.9, 54.9, 59.7],
         vo="ชอบทดลอง และชอบค้นหาว่า เบื้องหลังเทคโนโลยีที่เราเห็นอยู่ทุกวันนี้ มันทำงานอย่างไร และจะนำมาใช้ประโยชน์ได้จริงแค่ไหน",
         motion="duotone photo tears in behind host; icons on beats", sfx="pop ×3"),
    dict(id="S10", start=61.5, theme=C, type="list", chapter="ผมคือใคร", kicker="การเรียนรู้เทคโนโลยี คือการเปลี่ยน",
         head="ไม่ใช่แค่", hi="เครื่องมือใหม่", size=84,
         items=["วิธีคิด", "วิธีทำงาน", "วิธีสร้างสรรค์"], at=[68.9, 70.0, 71.0],
         vo="เพราะสำหรับผม การเรียนรู้เทคโนโลยี ไม่ใช่แค่การรู้จักเครื่องมือใหม่ แต่คือการเข้าใจว่าเราจะใช้เครื่องมือเหล่านั้น เพื่อเปลี่ยนวิธีคิด วิธีทำงาน และวิธีสร้างสรรค์สิ่งต่าง ๆ ได้อย่างไร",
         motion="hold on the statement; 3 items land on their words", sfx="pop ×3"),
    # ---------------- Ch3 ความเป็นไปได้ — COLLAGE ----------------
    dict(id="S11", start=73.68, theme=C, type="collage", chapter="ความเป็นไปได้", kicker="ไม่ใช่เพราะเป็นกระแส",
         head="ความเป็นไปได้", hi="ที่ซ่อนอยู่", size=130, host=H.format("surprised"), stamp="AI",
         vo="ผมสนใจโลกของ AI ไม่ใช่เพียงเพราะมันกำลังเป็นกระแส แต่เพราะผมมองเห็นความเป็นไปได้ที่ซ่อนอยู่ในเทคโนโลยีเหล่านี้",
         motion="kicker first; big type slams on 77.1 region", sfx="whoosh · pop"),
    dict(id="S12", start=80.84, theme=C, type="network", chapter="ความเป็นไปได้", kicker="ความเป็นไปได้",
         head="สิ่งที่ AI ", hi="ทำได้", hub="AI",
         items=["ข้อความ → ภาพ", "ความคิด → วิดีโอ", "เสียงสังเคราะห์ → ประสบการณ์", "AI Agent → งานซับซ้อน"],
         at=[80.9, 83.3, 85.5, 87.8],
         vo="จากการสร้างภาพจากข้อความเพียงไม่กี่บรรทัด การเปลี่ยนความคิดให้กลายเป็นวิดีโอ การใช้เสียงสังเคราะห์สร้างประสบการณ์ใหม่ ไปจนถึงการนำ AI Agent เข้ามาช่วยวางแผน วิเคราะห์ และทำงานแทนกระบวนการที่ซับซ้อน",
         motion="hub first, each spoke draws on its phrase", sfx="pop ×4"),
    dict(id="S13", start=93.96, theme=C, type="collage", chapter="ความเป็นไปได้", kicker="จินตนาการ ↔ ความจริง",
         head="เส้นแบ่ง", hi="เล็กลงเรื่อย ๆ", size=170, img=P.format("sungod.jpg"),
         vo="สิ่งเหล่านี้กำลังทำให้เส้นแบ่งระหว่างจินตนาการกับความเป็นจริงเล็กลงเรื่อยๆ",
         motion="duotone photo tears in, slow drift; torn highlight on เล็กลง", sfx="low whoosh"),
    dict(id="S14", start=98.82, theme=C, type="split", chapter="ความเป็นไปได้", kicker="คำถามที่แท้จริง",
         left={"label": "ไม่ใช่", "text": "AI จะทำอะไรได้บ้าง?"},
         right={"label": "แต่คือ", "text": "มนุษย์จะเลือกใช้มันอย่างไร?"}, at=[99.5, 102.3],
         vo="และสิ่งที่น่าสนใจที่สุด ไม่ใช่ว่า AI จะทำอะไรได้บ้าง แต่คือ มนุษย์จะเลือกใช้มันอย่างไร",
         motion="left 99.5 → right 102.3", sfx="pop 102.3"),
    # ---------------- Ch4 สิ่งที่ผมเชื่อ — COLLAGE ----------------
    dict(id="S15", start=105.4, theme=C, type="collage", chapter="สิ่งที่ผมเชื่อ", kicker="สิ่งที่ผมเชื่อ",
         head="เทคโนโลยีที่ดี", hi="เข้าใจง่าย", size=120, host=H.format("open"),
         vo="ผมเชื่อว่าเทคโนโลยีที่ดี ไม่ควรเป็นเรื่องที่เข้าใจยากสำหรับคนทั่วไป",
         motion="open-arms host; torn highlight on เข้าใจง่าย", sfx="pop"),
    dict(id="S16", start=109.8, theme=C, type="list", chapter="สิ่งที่ผมเชื่อ", kicker="เราไม่จำเป็นต้อง",
         head="เริ่มได้", hi="ตั้งแต่วันนี้", size=84,
         items=["เป็นโปรแกรมเมอร์", "มีอุปกรณ์ราคาแพง", "รู้ทุกอย่างตั้งแต่วันแรก"], at=[109.9, 111.6, 113.7],
         vo="เราไม่จำเป็นต้องเป็นโปรแกรมเมอร์ ไม่จำเป็นต้องมีอุปกรณ์ราคาแพง และไม่จำเป็นต้องรู้ทุกอย่างตั้งแต่วันแรก",
         motion="items tick in", sfx="pop ×3"),
    dict(id="S17", start=116.08, theme=C, type="network", chapter="สิ่งที่ผมเชื่อ", kicker="สิ่งสำคัญคือ",
         head="เริ่มจาก", hi="คำถามที่ถูก", hub="เริ่มต้น",
         items=["เริ่มต้นเรียนรู้", "เข้าใจหลักการ", "ตั้งคำถามให้ถูก"], at=[116.6, 118.2, 119.4],
         vo="สิ่งสำคัญคือการเริ่มต้นเรียนรู้ เข้าใจหลักการ และรู้จักตั้งคำถามให้ถูกต้อง",
         motion="spokes on beats", sfx="pop ×3"),
    dict(id="S18", start=121.38, theme=C, type="split", chapter="สิ่งที่ผมเชื่อ", kicker="เครื่องมือที่ทรงพลังที่สุด",
         left={"label": "ไม่ใช่", "text": "ฟังก์ชันมากที่สุด"},
         right={"label": "แต่คือ", "text": "ใช้ได้อย่างเหมาะสม"}, at=[121.6, 126.4],
         vo="เพราะบางครั้งเครื่องมือที่ทรงพลังที่สุดอาจไม่ใช่เครื่องมือที่มีฟังก์ชันมากที่สุด แต่เป็นเครื่องมือที่เรารู้จักนำมาใช้ได้อย่างเหมาะสม",
         motion="left 121.6 → right 126.4", sfx="pop 126.4"),
    dict(id="S19", start=129.72, theme=C, type="collage", chapter="สิ่งที่ผมเชื่อ", kicker="สิ่งที่ช่องนี้จะพาไปดู",
         head="เข้าใจง่าย", hi="ไม่ลดทอน", size=130, host=H.format("point"),
         vo="ผมอยากนำเสนอเรื่องราวเหล่านี้ในแบบที่เข้าใจง่าย แต่ไม่ลดทอนความสำคัญของเนื้อหา",
         motion="point host; highlight on ไม่ลดทอน", sfx="pop"),
    dict(id="S20", start=134.8, theme=C, type="list", chapter="สิ่งที่ผมเชื่อ", kicker="ไม่ใช่แค่บอกว่าดี แต่พาไปดูว่า",
         head="เครื่องมือนี้", hi="ใช้จริงได้แค่ไหน", size=84,
         items=["มันทำงานอย่างไร", "มีข้อจำกัดอะไร", "ใช้ในสถานการณ์จริงได้แค่ไหน"], at=[137.6, 139.9, 141.6],
         vo="ไม่ใช่แค่บอกว่าเครื่องมือนี้ดีอย่างไร แต่จะพาไปดูว่ามันทำงานอย่างไร มีข้อจำกัดอะไร และสามารถนำไปใช้ในสถานการณ์จริงได้แค่ไหน",
         motion="items on beats", sfx="pop ×3"),
    # ---------------- Ch5 การสร้างคอนเทนต์ — COLLAGE ----------------
    dict(id="S21", start=144.26, theme=C, type="network", chapter="การสร้างคอนเทนต์", kicker="โลกของการสร้างสรรค์คอนเทนต์",
         head="ทุกขั้นตอน ", hi="เชื่อมกัน", hub="คอนเทนต์",
         items=["คิดไอเดีย", "ค้นคว้าข้อมูล", "เขียนบท", "ถ่ายทำ", "สร้างภาพ", "ออกแบบเสียง", "ตัดต่อ", "เผยแพร่"],
         at=[148.1, 149.3, 150.6, 151.5, 152.6, 153.6, 155.2, 156.2],
         vo="อีกสิ่งหนึ่งที่ผมให้ความสำคัญ คือโลกของการสร้างสรรค์คอนเทนต์ ตั้งแต่การคิดไอเดีย การค้นคว้าข้อมูล การเขียนบท การถ่ายทำ การสร้างภาพ การออกแบบเสียง ไปจนถึงกระบวนการตัดต่อและเผยแพร่",
         motion="8 spokes, one per word, fast cadence", sfx="pop ×8 (quiet)"),
    dict(id="S22", start=157.12, theme=C, type="big", chapter="การสร้างคอนเทนต์", kicker="เป้าหมาย",
         head="เชื่อมทุกขั้นตอนให้เป็น", hi="ระบบเดียว", sub="ไม่ใช่แค่เร็วขึ้น — แต่มีเวลาโฟกัสกับสิ่งที่สำคัญกว่า", size=96,
         vo="ผมสนใจที่จะนำเทคโนโลยีเข้ามาเชื่อมโยงกระบวนการเหล่านี้ให้เป็นระบบเดียวกัน ไม่ใช่เพียงเพื่อทำงานให้เร็วขึ้น แต่เพื่อให้เรามีเวลาไปโฟกัสกับสิ่งที่สำคัญกว่า",
         motion="hold; sub fades on 161.7", sfx="—"),
    dict(id="S23", start=166.8, theme=C, type="collage", chapter="การสร้างคอนเทนต์", kicker="สิ่งที่สำคัญกว่า",
         head="สร้างสรรค์", hi="+ คุณภาพ", size=150, host=H.format("smile"), stamp="★",
         vo="นั่นคือ ความคิดสร้างสรรค์และคุณภาพของผลงาน",
         motion="type slam; stamp", sfx="stamp thud"),
    dict(id="S24", start=170.48, theme=C, type="split", chapter="การสร้างคอนเทนต์", kicker="มนุษย์ + AI",
         left={"label": "AI", "text": "จัดการงานที่ซ้ำซ้อน"},
         right={"label": "มนุษย์", "text": "กำหนดทิศทาง ความหมาย และคุณค่า"}, at=[170.7, 175.4],
         vo="ผมกำลังทดลองสร้างรูปแบบการทำงานที่ผสมผสานระหว่างมนุษย์กับ AI ให้ AI ช่วยจัดการงานที่ซ้ำซ้อน ขณะที่มนุษย์ยังคงเป็นผู้กำหนดทิศทาง ความหมาย และคุณค่าของสิ่งที่กำลังสร้างขึ้น",
         motion="left 170.7 → right 175.4; ChapterWipe → dossier on 184.0", sfx="pop · paper tear 184"),
    # ---------------- Ch6 อีกด้านของ AI — DOSSIER ----------------
    dict(id="S25", start=184.0, theme=D, type="case", chapter="อีกด้านของ AI", kicker="CASE FILE 02 · อีกด้านของ AI",
         head="ไม่ใช่แค่", hi="ด้านที่น่าตื่นเต้น", size=130,
         cards=[card("note", title="!", items=["ข้อผิดพลาด"], w=300, rot=-3),
                card("note", title="!", items=["ข้อจำกัด"], w=300, rot=2),
                card("note", title="!", items=["ความเสี่ยง"], w=300, rot=-2),
                card("note", title="?", items=["สิ่งที่เรายังไม่เข้าใจ"], w=320, rot=3)],
         links=[[-1, 0], [-1, 1], [-1, 2], [-1, 3]], at=[188.8, 190.1, 191.1, 192.3], host="vox/host/host-serious.jpg",
         vo="และผมคิดว่าการพูดถึง AI ไม่ควรมีแค่ด้านที่น่าตื่นเต้น เราควรพูดถึงข้อผิดพลาด ข้อจำกัด ความเสี่ยง และสิ่งที่เรายังไม่เข้าใจด้วย",
         motion="newsprint ground; 4 cards pin on words; strings draw", sfx="paper tear (wipe) · pin ×4"),
    dict(id="S26", start=194.44, theme=D, type="split", chapter="อีกด้านของ AI", kicker="พื้นที่แห่งนี้",
         left={"label": "ไม่ใช่แค่", "text": "ช่องที่บอกว่าอะไรกำลังมาแรง"},
         right={"label": "แต่เป็น", "text": "พื้นที่ตั้งคำถามอย่างตรงไปตรงมา"}, at=[194.6, 202.1],
         vo="ผมไม่อยากให้พื้นที่แห่งนี้เป็นเพียงช่องที่คอยนำเสนอว่า เครื่องมือไหนกำลังมาแรงหรือเทคโนโลยีอะไรที่กำลังเป็นกระแส แต่อยากให้เป็นพื้นที่ที่เราสามารถตั้งคำถามกับสิ่งเหล่านั้นได้อย่างตรงไปตรงมา",
         motion="left 194.6 → right 202.1", sfx="pop 202.1"),
    dict(id="S27", start=207.12, theme=D, type="redact", chapter="อีกด้านของ AI", kicker="FILE // ตรงไปตรงมา",
         head="ไม่ดีพอ ก็บอกว่า", hi="ไม่ดีพอ",
         vo="ถ้าสิ่งไหนยังไม่ดีพอก็ควรพูดว่ายังไม่ดีพอ ถ้าสิ่งไหนมีข้อจำกัดก็ควรอธิบายข้อจำกัดนั้น",
         motion="redaction bars lift to reveal the line", sfx="marker squeak"),
    dict(id="S28", start=214.0, theme=D, type="big", chapter="อีกด้านของ AI", kicker="ถ้ามีวิธีที่ดีกว่า",
         head="เปิดใจเรียนรู้", hi="วิธีใหม่", tail=" เสมอ", size=110,
         vo="และถ้ามีวิธีที่ดีกว่า เราก็ควรเปิดใจเรียนรู้วิธีใหม่ๆอยู่เสมอ",
         motion="display type, torn highlight", sfx="—"),
    dict(id="S29", start=218.68, theme=D, type="case", chapter="อีกด้านของ AI", kicker="เพราะผมเชื่อว่า",
         head="ความเข้าใจ", hi="ที่แท้จริง", size=150,
         cards=[card("note", title="ไม่ใช่", items=["เชื่อทุกอย่างที่เห็น"], w=320, rot=-3),
                card("stamp", title="กล้าตั้งคำถาม", rot=-8)],
         links=[[-1, 0]], at=[221.5, 223.8], host="vox/host/host-profile.jpg",
         vo="เพราะผมเชื่อว่า ความเข้าใจที่แท้จริง ไม่ได้เกิดจากการเชื่อทุกอย่างที่เราเห็น แต่มาจากการกล้าตั้งคำถามกับมัน",
         motion="note pins 221.5; stamp slams 223.8; ChapterWipe → collage 226.36", sfx="pin · stamp · paper tear"),
    # ---------------- Ch7 สุดท้ายนี้ — COLLAGE ----------------
    dict(id="S30", start=226.36, theme=C, type="collage", chapter="สุดท้ายนี้", kicker="สุดท้ายนี้",
         head="เข้าใจโลก", hi="ที่กำลังเปลี่ยน", size=140, host=H.format("seated"),
         vo="สุดท้ายนี้ ผมไม่ได้อยากสร้างพื้นที่ ที่มีแต่เรื่องราวของเทคโนโลยี แต่อยากสร้างพื้นที่ ที่ทำให้เราเข้าใจโลก ที่กำลังเปลี่ยนแปลงไป",
         motion="calm hold, slow drift", sfx="paper tear (wipe)"),
    dict(id="S31", start=235.0, theme=C, type="list", chapter="สุดท้ายนี้", kicker="ไปพร้อมกัน",
         head="ค้นหา", hi="ความเป็นไปได้", size=84,
         items=["เรียนรู้สิ่งใหม่ไปพร้อมกัน", "ทดลองสิ่งที่ยังไม่เคยทำ", "ค้นหาความเป็นไปได้จากเครื่องมือวันนี้"], at=[235.0, 236.8, 238.8],
         vo="เรียนรู้สิ่งใหม่ๆไปพร้อมกัน ทดลองสิ่งที่ยังไม่เคยทำ และค้นหาความเป็นไปได้ ที่อาจเกิดขึ้น จากเครื่องมือที่เรามีอยู่ในวันนี้",
         motion="items on beats", sfx="pop ×3"),
    dict(id="S32", start=243.52, theme=C, type="collage", chapter="สุดท้ายนี้", kicker="ยินดีต้อนรับสู่",
         head="KRITLIFE", hi="TECH", sub="เข้าใจเทคโนโลยี มากกว่าแค่รู้จัก", size=200, host=H.format("smile"),
         vo="ยินดีต้อนรับสู่ KRITLIFE TECH พื้นที่ของคนที่อยากเข้าใจเทคโนโลยีมากกว่าที่จะแค่รู้จักมัน",
         motion="brand slam on 245.3; sub strip", sfx="pop 245.3"),
    dict(id="S33", start=250.7, theme=C, type="big", chapter="สุดท้ายนี้", kicker="อนาคต",
         head="คือสิ่งที่เรา", hi="ร่วมกันสร้าง", sub="ตั้งแต่วันนี้", size=110,
         vo="เพราะอนาคตไม่ได้เป็นเพียงสิ่งที่เรากำลังรอให้มาถึง แต่มันคือสิ่งที่เรากำลังร่วมกันสร้างขึ้นตั้งแต่วันนี้",
         motion="hold; sub on 254.2", sfx="—"),
    dict(id="S34", start=258.22, theme=C, type="end", chapter="สุดท้ายนี้",
         items=["Understand Technology", "Think Differently", "Create the Future"], at=[259.48, 261.2, 262.62],
         vo="KRITLIFE TECH — Understand Technology, Think Differently, Create the Future",
         motion="end card, 3 taglines on beats", sfx="pop ×3"),
]

BOARD_ONLY = {"id", "vo", "motion", "sfx"}


def props() -> dict:
    cues = json.loads((HERE / "cues.json").read_text())
    scenes = [{k: v for k, v in s.items() if k not in BOARD_ONLY} for s in SHOTS]
    for sc in scenes:
        if sc.get("cards"):
            sc["cards"] = place16(sc["cards"])
    return {
        "theme": "collage",
        "scenes": scenes,
        "cues": cues,
        "duration": DURATION,
        "audio": "kritlife/vox/mix-v2.wav",
        "assetBase": "",
        "brand": {"name": "KRITLIFE ", "hi": "TECH"},
        "labels": {"illustration": ""},
    }


def storyboard_md() -> str:
    out = [
        "# KRITLIFE TECH intro v2: storyboard (9:16 first)",
        "",
        "Generated by `build_v2.py`. Edit the table there, not this file.",
        "",
        "- **Audio master:** `narration.mp3` (263.89 s). Every time is in seconds on that track.",
        "- **Looks by chapter:**",
        "  - **DOSSIER** (dark evidence board, newsprint, black-and-white, red string): the intro, and *the other side of AI*.",
        "  - **COLLAGE** (cream paper, gold duotone, condensed type): every other chapter.",
        "- **Chapter changes:** a torn-paper `ChapterWipe` at 34.94, 184.0 and 226.36 (14 frames each side). It is an overlay, so it does not shift any timing.",
        "- **Layout zones (9:16):**",
        "  - Brand: about 6%.",
        "  - Headline or note: 11–45%.",
        "  - Host: 45–100%, standing in front of a disc or the board.",
        "  - Caption: about 72–79%, always on top.",
        "",
        "## Motion grammar",
        "",
        "| Element | Motion | Duration |",
        "|---|---|---|",
        "| Note / card | pin-drop: spring (damping 14), rotation settles ±2–4° | ~12f |",
        "| Pin → string | pin pops, red string draws (pathLength) | 8f + 14f |",
        "| Stamp | slam scale 1.25→1 + 1-frame shake | 6f |",
        "| Collage type | slam scale 1.25→1, torn highlight strip wipes in | 10–14f |",
        "| Host | springs up from below, breathes ±0.6% | 12f |",
        "| Camera | slow push-in 1→1.035 across the shot | whole shot |",
        "| Chapter change | torn-paper sheet sweeps up over the cut | 28f |",
        "",
        "Every beat lands on the word time from `transcript.json` (`at[]`), so nothing runs on a fixed rhythm.",
        "",
        "## Shot list",
        "",
        "| # | Time | Look | Type | On screen | Host | Motion | SFX |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for i, s in enumerate(SHOTS):
        end = SHOTS[i + 1]["start"] if i + 1 < len(SHOTS) else DURATION
        on = " ".join(x for x in [s.get("kicker"), s.get("head"), s.get("hi"), s.get("tail"), s.get("text")] if x)
        if s.get("left"):
            on += f" — {s['left']['label']}: {s['left']['text']} / {s['right']['label']}: {s['right']['text']}"
        if s.get("items"):
            on += " — " + " · ".join(s["items"])
        host = s.get("host", "").replace("vox/host/host-", "").replace("-cut.png", "") or "–"
        beats = f" (beats {', '.join(str(a) for a in s['at'])})" if s.get("at") else ""
        out.append(f"| {s['id']} | {s['start']:.2f}–{end:.2f} | {s['theme']} | {s['type']} | {on} | {host} | {s['motion']}{beats} | {s['sfx']} |")
    out += ["", "## Voice-over by shot", ""]
    for s in SHOTS:
        out.append(f"- **{s['id']}** ({s['start']:.2f}) {s['vo']}")
    return "\n".join(out) + "\n"


WIPES = [34.94, 184.0, 226.36]


def sfx_events() -> dict:
    """SFX cues for mix_v2.py: recorded CC0 samples ("sample") + brand synth ("type").

    case board: typing on the kicker, paper slap on the pop, scanner ("search") as the camera travels
    to each card, pin tick + pen click as the red circle is drawn; stamps thump.
    chapter wipes: paper rip. typewriter scene: typing + bell. Other beats: quiet synth pops.
    Gains stay 0.15-0.55 under the voice.
    """
    ev: list[dict] = []
    for w in WIPES:  # torn-paper chapter wipe: a real rip under the sweep
        ev.append({"t": round(w - 0.42, 2), "sample": "paper-rip", "offset": 0.35, "dur": 0.9, "gain": 0.55})
    for s in SHOTS:
        at = s.get("at") or []
        t = s["type"]
        if t == "case":
            # mirrors scenesCase.tsx: kicker types (frames 1..), head pops (3f), camera lands on card i at
            # max(beat, start + (40 + 2i)/30 s) after an 18-frame travel, pen circle at beat + 10f
            st = s["start"]
            ev.append({"t": round(st + 0.03, 2), "sample": "typewriter-long", "offset": 1.0, "dur": 0.75, "gain": 0.32})
            ev.append({"t": round(st + 0.12, 2), "sample": "paper-tear-short", "gain": 0.28})
            for i, a in enumerate(at):
                kind = s["cards"][i]["kind"] if i < len(s.get("cards", [])) else "note"
                land = max(a, st + (40 + 2 * i) / 30)
                ev.append({"t": round(land - 0.62, 2), "sample": "scanner", "offset": 0.2, "dur": 0.6, "gain": 0.16})
                if kind == "stamp":
                    ev.append({"t": round(a + 0.05, 2), "type": "thump", "gain": 0.5})
                else:
                    ev.append({"t": round(a + 0.1, 2), "type": "tick", "gain": 0.28})
                    ev.append({"t": round(a + 10 / 30, 2), "sample": "pen-click", "dur": 0.45, "gain": 0.55})
        elif t == "board":
            kinds = [c["kind"] for c in s.get("cards", [])]
            for i, a in enumerate(at):
                if i < len(kinds) and kinds[i] == "stamp":
                    ev.append({"t": round(a + 0.05, 2), "type": "thump", "gain": 0.45})
                else:
                    ev.append({"t": round(a + 0.12, 2), "type": "tick", "gain": 0.3})
        elif t == "split":
            if len(at) > 1:
                ev.append({"t": round(at[1] + 0.05, 2), "type": "pop", "gain": 0.22})
        elif t == "typewriter":
            ev.append({"t": round(s["start"] + 0.25, 2), "sample": "typewriter-long", "offset": 3.0, "dur": 2.0, "gain": 0.3})
            ev.append({"t": round(s["start"] + 2.3, 2), "sample": "typewriter-ding", "dur": 0.8, "gain": 0.22})
        elif t in ("list", "network", "collage", "end"):
            quiet = 0.14 if len(at) > 5 else 0.2
            for a in at:
                ev.append({"t": round(a + 0.05, 2), "type": "pop", "gain": quiet})
        if s.get("stamp") and t == "collage":
            ev.append({"t": round(s["start"] + 0.6, 2), "type": "thump", "gain": 0.35})
    # soft whoosh on every other cut (not on wipes, which have their own)
    bounds = [s["start"] for s in SHOTS[1:] if all(abs(s["start"] - w) > 0.1 for w in WIPES)]
    return {"duration": DURATION, "whoosh_at_bounds": bounds, "events": sorted(ev, key=lambda e: e["t"])}


if __name__ == "__main__":
    (HERE / "sfx-events-v2.json").write_text(json.dumps(sfx_events(), ensure_ascii=False, indent=1))
    (HERE / "vox-v2.props.json").write_text(json.dumps(props(), ensure_ascii=False, indent=1))
    (HERE / "storyboard-v2.md").write_text(storyboard_md())
    print(f"{len(SHOTS)} shots -> vox-v2.props.json, storyboard-v2.md")
