"""Mix the KRITLIFE v2 soundtrack: narration + BGM (ducked under the voice) + SFX.

SFX events (sfx-events-v2.json, written by build_v2.py) are either
  {"t": 12.3, "sample": "pen-click", "gain": 0.5, "dur": 0.6, "offset": 0.0}   recorded CC0 sample
  {"t": 12.3, "type": "pop", "gain": 0.2}                                        synth (kritlife sfx.py)
Samples live in remotion-composer/public/vox/sfx/ (gitignored; CC0 from Openverse/Freesound,
credits in SFX_CREDITS below). BGM: remotion-composer/public/kritlife/vox/BGM.mp3 if present
(the Dark Gold Explainer design-system track); without it the mix is voice + SFX only.

Run:  python3 projects/kritlife-vox-intro/mix_v2.py
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PUB = ROOT / "remotion-composer" / "public"
SFX_DIR = PUB / "vox" / "sfx"
VOICE = PUB / "kritlife" / "vox" / "narration.mp3"
BGM = PUB / "kritlife" / "vox" / "BGM.mp3"
OUT = PUB / "kritlife" / "vox" / "mix-v2.wav"
SYNTH = Path.home() / ".claude/skills/synced"  # kritlife-brand-video/scripts/sfx.py lives under here
SR = 48000

SFX_CREDITS = {
    "typewriter-long": '"Long Sound Typewriter" by fellwell5 (CC0) freesound.org/s/170547',
    "typewriter-key": '"Typewriter - single key - type 2.wav" by yottasounds (CC0) freesound.org/s/380137',
    "typewriter-ding": '"Typewriter Ding.wav" by NHumphrey (CC0) freesound.org/s/204466',
    "paper-rip": '"paper tearing rip.mp3" by Mikes-MultiMedia (CC0) freesound.org/s/349702',
    "paper-tear-short": '"Packaging Paper Tear Short.wav" by afleetingspeck (CC0) freesound.org/s/140461',
    "pen-click": '"Retractable Pen Click In Out" by dslrguide (CC0) freesound.org/s/321484',
    "pen-clicks": '"Pen Clicks-GAIN_01.wav" by XxBirdoxX (CC0) freesound.org/s/52283',
    "scanner": '"Sci Fi Scanner 2 (Also Loopable)" by neopolitansixth (CC0) freesound.org/s/547258',
}


def decode(path: Path) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def write_wav(path: Path, x: np.ndarray) -> None:
    y = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(y.tobytes())


def main() -> None:
    cfg = json.loads((HERE / "sfx-events-v2.json").read_text())
    dur = float(cfg["duration"])
    L = int(SR * dur)
    track = np.zeros(L, dtype=np.float32)

    # 1) synth events through the brand sfx.py (no network)
    synth_cfg = {"duration": dur, "whoosh_at_bounds": cfg.get("whoosh_at_bounds", []),
                 "events": [e for e in cfg["events"] if "type" in e]}
    sfx_py = next(SYNTH.glob("*/kritlife-brand-video/scripts/sfx.py"), None)
    with tempfile.TemporaryDirectory() as td:
        if sfx_py and (synth_cfg["events"] or synth_cfg["whoosh_at_bounds"]):
            ev = Path(td) / "synth.json"
            ev.write_text(json.dumps(synth_cfg))
            out = Path(td) / "synth.wav"
            subprocess.run([sys.executable, str(sfx_py), str(ev), "--out", str(out)], check=True, capture_output=True)
            s = decode(out)[:L]
            track[: len(s)] += s * 2.0  # sfx.py writes at 0.5 peak

        # 2) recorded samples
        cache: dict[str, np.ndarray] = {}
        for e in cfg["events"]:
            name = e.get("sample")
            if not name:
                continue
            if name not in cache:
                cache[name] = decode(SFX_DIR / f"{name}.mp3")
            x = cache[name]
            off = int(e.get("offset", 0) * SR)
            seg = x[off: off + int(e.get("dur", len(x) / SR) * SR)].copy()
            fade = min(len(seg), int(0.04 * SR))
            if fade:
                seg[-fade:] *= np.linspace(1, 0, fade)
            o = int(e["t"] * SR)
            n = max(0, min(len(seg), L - o))
            track[o: o + n] += seg[:n] * float(e.get("gain", 0.4))
        track = np.tanh(track * 0.9) * 0.55
        sfx_wav = Path(td) / "sfx.wav"
        write_wav(sfx_wav, track)

        # 3) voice (loudnorm) + BGM ducked by the voice (sidechain) + SFX
        inputs = ["-i", str(VOICE), "-i", str(sfx_wav)]
        if BGM.exists():
            inputs += ["-stream_loop", "-1", "-i", str(BGM)]
            fc = ("[0:a]aresample=48000,loudnorm=I=-16:TP=-1.5:LRA=11,asplit=2[v][vk];"
                  "[2:a]aresample=48000,volume=0.22,afade=t=in:d=1.5,"
                  f"afade=t=out:st={dur - 3:.2f}:d=3[b];"
                  "[b][vk]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[bd];"
                  "[v][1:a][bd]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.95[o]")
        else:
            fc = ("[0:a]aresample=48000,loudnorm=I=-16:TP=-1.5:LRA=11[v];"
                  "[v][1:a]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[o]")
        subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", fc, "-map", "[o]",
                        "-t", f"{dur:.3f}", "-ar", str(SR), "-ac", "2", str(OUT)], check=True)
    print(f"wrote {OUT.relative_to(ROOT)} ({dur:.2f}s, BGM {'on' if BGM.exists() else 'missing'})")


if __name__ == "__main__":
    main()
