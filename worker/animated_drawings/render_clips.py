"""
Render motion clips for a character image with Animated Drawings (Meta, Apache-2.0).

  python render_clips.py --image character.png --out frames/ --clips idle,walk --fps 12 --size 128 --motions ./motions

Exit codes: 0 ok · 22 character not riggable (pose confidence below threshold)
Output: <out>/<clip>/<clip>_000.png … (transparent background, facing right)

Pipeline (SPEC §9.2): alpha mask -> pose detection -> skeleton validation -> rig -> BVH retarget -> per-frame render.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

CONFIDENCE_THRESHOLD = 0.45


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--clips", required=True)
    ap.add_argument("--fps", type=int, default=12)
    ap.add_argument("--size", type=int, default=128)
    ap.add_argument("--motions", required=True)
    args = ap.parse_args()

    from animated_drawings import render  # type: ignore
    from annotate import annotate_character  # alpha mask + joint detection helper (ships with the worker image)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    index = json.loads((Path(args.motions) / "index.json").read_text())
    clips = {c["id"]: c for c in index["clips"]}

    char_dir = out / "_character"
    confidence = annotate_character(args.image, str(char_dir))
    if confidence < CONFIDENCE_THRESHOLD:
        print(f"skeleton confidence {confidence:.2f} < {CONFIDENCE_THRESHOLD}", file=sys.stderr)
        return 22

    for clip_id in args.clips.split(","):
        clip = clips[clip_id]
        clip_out = out / clip_id
        clip_out.mkdir(exist_ok=True)
        cfg = {
            "scene": {
                "ANIMATED_CHARACTERS": [
                    {
                        "character_cfg": str(char_dir / "char_cfg.yaml"),
                        "motion_cfg": str(Path(args.motions) / clip["file"].replace(".bvh", ".yaml")),
                        "retarget_cfg": str(Path(args.motions) / "retarget_humanoid.yaml"),
                    }
                ]
            },
            "view": {"WINDOW_DIMENSIONS": [args.size, args.size], "CAMERA_POS": [0.1, 1.3, 2.7], "USE_MESA": True, "CLEAR_COLOR": [0, 0, 0, 0]},
            "controller": {"MODE": "video_render", "OUTPUT_VIDEO_PATH": str(clip_out / "clip.gif"), "OUTPUT_FPS": args.fps, "FRAMES_DIR": str(clip_out), "FRAME_PREFIX": f"{clip_id}_"},
        }
        cfg_path = out / f"_{clip_id}.json"
        cfg_path.write_text(json.dumps(cfg))
        render.start(str(cfg_path))
    return 0


if __name__ == "__main__":
    sys.exit(main())
