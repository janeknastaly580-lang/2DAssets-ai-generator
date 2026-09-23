"""
Veyraflow worker — Modal app (SPEC §14.2).

Endpoints (all require `Authorization: Bearer $MODAL_WORKER_TOKEN`):
  POST /rig-animate       Animated Drawings: image_url + clips -> frames ZIP (PNG per frame) -> output_put_url
  POST /convert-3d        Blender headless: GLB -> FBX (unity / unreal) / OBJ+MTL zip, normalisation, texture extraction
  POST /render-thumbnail  turntable PNG + GIF
  POST /audio-process     ffmpeg: peak/LUFS normalisation, silence trim, loop crossfade, WAV/OGG/MP3
  POST /make-gif          ffmpeg palettegen/paletteuse
  POST /pixelize          palette quantisation of frame packs
  GET  /tasks/{task_id}   task status (polled by the app); on completion the worker also POSTs
                          /api/webhooks/worker with an HMAC-SHA256 signature (X-Veyraflow-Signature).

Inputs/outputs travel via presigned R2 URLs only — the worker has no database or R2 credentials.

Deploy:  modal deploy worker/modal_app.py
Dev:     modal serve  worker/modal_app.py
Secrets: modal secret create veyraflow-worker MODAL_WORKER_TOKEN=... WORKER_WEBHOOK_SECRET=... APP_URL=https://veyraflow.eu
"""

from __future__ import annotations

import hashlib
import hmac
import io
import json
import os
import subprocess
import tempfile
import uuid
import zipfile
from pathlib import Path
from typing import Any

import modal

APP_NAME = "veyraflow-worker"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "git", "libgl1", "libglib2.0-0", "libxrender1", "libxi6", "libxkbcommon0", "libsm6", "xz-utils", "wget")
    .pip_install("fastapi[standard]", "requests", "pillow", "numpy", "boto3", "torch==2.3.1", "torchvision==0.18.1", extra_index_url="https://download.pytorch.org/whl/cpu")
    .run_commands(
        # Blender 4.x headless
        "wget -q https://download.blender.org/release/Blender4.1/blender-4.1.1-linux-x64.tar.xz -O /tmp/blender.tar.xz",
        "mkdir -p /opt/blender && tar -xf /tmp/blender.tar.xz -C /opt/blender --strip-components=1 && rm /tmp/blender.tar.xz",
        # Animated Drawings (Meta, Apache-2.0)
        "git clone --depth 1 https://github.com/facebookresearch/AnimatedDrawings.git /opt/animated_drawings",
        "pip install -e /opt/animated_drawings",
    )
    .add_local_dir(str(Path(__file__).parent / "animated_drawings"), remote_path="/opt/veyraflow/animated_drawings")
    .add_local_dir(str(Path(__file__).parent / "blender"), remote_path="/opt/veyraflow/blender")
)

app = modal.App(APP_NAME, image=image, secrets=[modal.Secret.from_name("veyraflow-worker")])
tasks = modal.Dict.from_name("veyraflow-worker-tasks", create_if_missing=True)


# ----------------------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------------------
def _auth(request) -> None:
    from fastapi import HTTPException

    token = os.environ.get("MODAL_WORKER_TOKEN", "")
    header = request.headers.get("authorization", "")
    if not token or not hmac.compare_digest(header, f"Bearer {token}"):
        raise HTTPException(status_code=401, detail="unauthorized")


def _download(url: str, dest: Path) -> Path:
    import requests

    with requests.get(url, stream=True, timeout=600) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
    return dest


def _upload(put_url: str, path: Path, content_type: str = "application/octet-stream") -> None:
    import requests

    with open(path, "rb") as f:
        r = requests.put(put_url, data=f, headers={"Content-Type": content_type}, timeout=600)
        r.raise_for_status()


def _notify(task_id: str, status: str, outputs: dict[str, Any] | None = None, error: str | None = None) -> None:
    """Persist task state and call the app webhook (HMAC over the raw body)."""
    import requests

    tasks[task_id] = {"status": status, "outputs": outputs or {}, "error": error, "progress": 100 if status == "done" else 0}
    app_url = os.environ.get("APP_URL")
    secret = os.environ.get("WORKER_WEBHOOK_SECRET")
    if not app_url or not secret:
        return
    body = json.dumps({"task_id": task_id, "status": status, "outputs": outputs or {}, "error": error}).encode()
    sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    try:
        requests.post(f"{app_url}/api/webhooks/worker", data=body, headers={"Content-Type": "application/json", "X-Veyraflow-Signature": sig}, timeout=30)
    except Exception:  # noqa: BLE001 — polling is the fallback
        pass


def _start(fn, payload: dict[str, Any]) -> dict[str, str]:
    task_id = str(uuid.uuid4())
    tasks[task_id] = {"status": "pending", "progress": 0}
    fn.spawn(task_id, payload)
    return {"task_id": task_id}


# ----------------------------------------------------------------------------------------
# background jobs
# ----------------------------------------------------------------------------------------
@app.function(cpu=2.0, memory=4096, timeout=15 * 60)
def rig_animate_job(task_id: str, p: dict[str, Any]) -> None:
    """Animated Drawings: rig the character and render the requested clips as PNG frames."""
    try:
        with tempfile.TemporaryDirectory() as tmp:
            tmpd = Path(tmp)
            img = _download(p["image_url"], tmpd / "character.png")
            out_dir = tmpd / "frames"
            out_dir.mkdir()
            cmd = [
                "python", "/opt/veyraflow/animated_drawings/render_clips.py",
                "--image", str(img), "--out", str(out_dir),
                "--clips", ",".join(p["clips"]), "--fps", str(p["fps"]), "--size", str(p["frame_size"]),
                "--motions", "/opt/veyraflow/animated_drawings/motions",
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=13 * 60)
            if res.returncode == 22:
                _notify(task_id, "error", error=f"not riggable: {res.stderr[-400:]}")
                return
            if res.returncode != 0:
                raise RuntimeError(res.stderr[-800:])
            zip_path = tmpd / "frames.zip"
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
                for f in sorted(out_dir.rglob("*.png")):
                    z.write(f, f.relative_to(out_dir).as_posix())
            _upload(p["output_put_url"], zip_path, "application/zip")
            _notify(task_id, "done", {"frames_zip": True, "clips": p["clips"]})
    except Exception as e:  # noqa: BLE001
        _notify(task_id, "error", error=str(e)[:500])


@app.function(cpu=4.0, memory=8192, timeout=15 * 60)
def convert_3d_job(task_id: str, p: dict[str, Any]) -> None:
    """Blender: GLB -> normalised FBX (unity Y-up m / unreal Z-up cm), OBJ+MTL zip, textures."""
    try:
        with tempfile.TemporaryDirectory() as tmp:
            tmpd = Path(tmp)
            glb = _download(p["model_url"], tmpd / "model.glb")
            out = tmpd / "out"
            out.mkdir()
            cmd = ["/opt/blender/blender", "-b", "--python", "/opt/veyraflow/blender/convert.py", "--", str(glb), str(out), json.dumps({"targets": p["targets"], "scale_m": p.get("scale_m")})]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=13 * 60)
            if res.returncode != 0:
                raise RuntimeError(res.stderr[-800:])
            outputs: dict[str, Any] = {}
            for target, put_url in p["output_put_urls"].items():
                produced = out / ("model_unity.fbx" if target == "fbx_unity" else "model_unreal.fbx" if target == "fbx_unreal" else "model_obj.zip")
                if produced.exists():
                    _upload(put_url, produced)
                    outputs[target] = True
            _notify(task_id, "done", outputs)
    except Exception as e:  # noqa: BLE001
        _notify(task_id, "error", error=str(e)[:500])


@app.function(cpu=2.0, memory=4096, timeout=10 * 60)
def render_thumbnail_job(task_id: str, p: dict[str, Any]) -> None:
    try:
        with tempfile.TemporaryDirectory() as tmp:
            tmpd = Path(tmp)
            glb = _download(p["model_url"], tmpd / "model.glb")
            out = tmpd / "out"
            out.mkdir()
            cmd = ["/opt/blender/blender", "-b", "--python", "/opt/veyraflow/blender/turntable.py", "--", str(glb), str(out)]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=8 * 60)
            if res.returncode != 0:
                raise RuntimeError(res.stderr[-800:])
            _upload(p["output_put_url"], out / "front.png", "image/png")
            if p.get("gif_put_url") and (out / "turntable.gif").exists():
                _upload(p["gif_put_url"], out / "turntable.gif", "image/gif")
            _notify(task_id, "done", {"thumbnail": True})
    except Exception as e:  # noqa: BLE001
        _notify(task_id, "error", error=str(e)[:500])


@app.function(cpu=2.0, memory=2048, timeout=10 * 60)
def audio_process_job(task_id: str, p: dict[str, Any]) -> None:
    """ffmpeg: trim silence, normalise (peak or EBU R128 loudnorm), loop crossfade, encode WAV/OGG/MP3."""
    try:
        with tempfile.TemporaryDirectory() as tmp:
            tmpd = Path(tmp)
            src = _download(p["audio_url"], tmpd / "in.bin")
            ops = p.get("ops", {})
            filters = ["silenceremove=start_periods=1:start_threshold=-60dB:stop_periods=1:stop_threshold=-60dB"]
            if ops.get("lufs") is not None:
                filters.append(f"loudnorm=I={ops['lufs']}:TP=-1:LRA=11")
            else:
                filters.append(f"alimiter=limit={10 ** (float(ops.get('peak_db', -1)) / 20):.4f}")
            loop_ms = int(ops.get("loop_ms") or 0)
            if loop_ms > 0:
                filters.append(f"afade=t=in:d={loop_ms / 1000},afade=t=out:d={loop_ms / 1000}")
            af = ",".join(filters)
            wav = tmpd / "out.wav"
            subprocess.run(["ffmpeg", "-y", "-i", str(src), "-af", af, "-ar", "44100", "-sample_fmt", "s16", str(wav)], check=True, capture_output=True)
            ogg = tmpd / "out.ogg"
            mp3 = tmpd / "out.mp3"
            subprocess.run(["ffmpeg", "-y", "-i", str(wav), "-c:a", "libvorbis", "-q:a", "5", str(ogg)], check=True, capture_output=True)
            subprocess.run(["ffmpeg", "-y", "-i", str(wav), "-c:a", "libmp3lame", "-b:a", "192k", str(mp3)], check=True, capture_output=True)
            for fmt, path, ct in (("wav", wav, "audio/wav"), ("ogg", ogg, "audio/ogg"), ("mp3", mp3, "audio/mpeg")):
                if fmt in p["output_put_urls"]:
                    _upload(p["output_put_urls"][fmt], path, ct)
            _notify(task_id, "done", {"formats": list(p["output_put_urls"].keys())})
    except Exception as e:  # noqa: BLE001
        _notify(task_id, "error", error=str(e)[:500])


@app.function(cpu=1.0, memory=2048, timeout=5 * 60)
def make_gif_job(task_id: str, p: dict[str, Any]) -> None:
    try:
        with tempfile.TemporaryDirectory() as tmp:
            tmpd = Path(tmp)
            zpath = _download(p["frames_zip_url"], tmpd / "frames.zip")
            frames = tmpd / "frames"
            with zipfile.ZipFile(zpath) as z:
                z.extractall(frames)
            pngs = sorted(frames.rglob("*.png"))
            listing = tmpd / "list.txt"
            listing.write_text("".join(f"file '{f}'\nduration {1 / p['fps']:.4f}\n" for f in pngs))
            gif = tmpd / "out.gif"
            subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing), "-vf", "scale=256:-1:flags=neighbor,split[s0][s1];[s0]palettegen=reserve_transparent=1[p];[s1][p]paletteuse", "-loop", "0", str(gif)], check=True, capture_output=True)
            _upload(p["output_put_url"], gif, "image/gif")
            _notify(task_id, "done", {"gif": True})
    except Exception as e:  # noqa: BLE001
        _notify(task_id, "error", error=str(e)[:500])


@app.function(cpu=2.0, memory=2048, timeout=10 * 60)
def pixelize_job(task_id: str, p: dict[str, Any]) -> None:
    """Palette quantisation of a frame pack (Pillow); mirrors lib/postprocess/pixelArt.ts."""
    try:
        from PIL import Image

        with tempfile.TemporaryDirectory() as tmp:
            tmpd = Path(tmp)
            zpath = _download(p["frames_zip_url"], tmpd / "frames.zip")
            src = tmpd / "src"
            with zipfile.ZipFile(zpath) as z:
                z.extractall(src)
            out_zip = tmpd / "out.zip"
            palette_img = None
            if p.get("palette"):
                pal = [int(h[i : i + 2], 16) for h in p["palette"] for i in (1, 3, 5)]
                palette_img = Image.new("P", (1, 1))
                palette_img.putpalette(pal + [0] * (768 - len(pal)))
            with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as z:
                for f in sorted(src.rglob("*.png")):
                    im = Image.open(f).convert("RGBA")
                    scale = p["pixel_grid"] / max(im.size)
                    small = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.NEAREST)
                    alpha = small.split()[3].point(lambda a: 255 if a >= 128 else 0)
                    rgb = small.convert("RGB")
                    q = rgb.quantize(palette=palette_img, dither=Image.Dither.NONE) if palette_img else rgb.quantize(colors=int(p.get("palette_size", 16)), method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
                    res = q.convert("RGBA")
                    res.putalpha(alpha)
                    buf = io.BytesIO()
                    res.save(buf, "PNG")
                    z.writestr(f.relative_to(src).as_posix(), buf.getvalue())
            _upload(p["output_put_url"], out_zip, "application/zip")
            _notify(task_id, "done", {"frames_zip": True})
    except Exception as e:  # noqa: BLE001
        _notify(task_id, "error", error=str(e)[:500])


# ----------------------------------------------------------------------------------------
# HTTP API
# ----------------------------------------------------------------------------------------
@app.function()
@modal.asgi_app()
def api():
    from fastapi import FastAPI, Request

    web = FastAPI(title=APP_NAME)

    @web.post("/rig-animate")
    async def rig_animate(request: Request):
        _auth(request)
        return _start(rig_animate_job, await request.json())

    @web.post("/convert-3d")
    async def convert_3d(request: Request):
        _auth(request)
        return _start(convert_3d_job, await request.json())

    @web.post("/render-thumbnail")
    async def render_thumbnail(request: Request):
        _auth(request)
        return _start(render_thumbnail_job, await request.json())

    @web.post("/audio-process")
    async def audio_process(request: Request):
        _auth(request)
        return _start(audio_process_job, await request.json())

    @web.post("/make-gif")
    async def make_gif(request: Request):
        _auth(request)
        return _start(make_gif_job, await request.json())

    @web.post("/pixelize")
    async def pixelize(request: Request):
        _auth(request)
        return _start(pixelize_job, await request.json())

    @web.get("/tasks/{task_id}")
    async def task_status(task_id: str, request: Request):
        _auth(request)
        return tasks.get(task_id, {"status": "error", "error": "unknown task"})

    return web
