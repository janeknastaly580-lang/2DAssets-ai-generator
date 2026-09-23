"""Render a front PNG + 8-frame turntable GIF for a GLB (SPEC §9.3 thumbnails)."""
import math
import os
import subprocess
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :]
src, out_dir = argv[0], argv[1]
os.makedirs(out_dir, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT" if hasattr(bpy.types, "SceneEEVEE") else "BLENDER_EEVEE"
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.film_transparent = True

cam_data = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
light_data = bpy.data.lights.new("sun", "SUN")
light = bpy.data.objects.new("sun", light_data)
light.rotation_euler = (math.radians(50), 0, math.radians(30))
scene.collection.objects.link(light)

for i in range(8):
    a = i / 8 * math.tau
    cam.location = (math.sin(a) * 3.2, -math.cos(a) * 3.2, 1.6)
    cam.rotation_euler = (math.radians(70), 0, a)
    scene.render.filepath = os.path.join(out_dir, f"frame_{i:02d}.png")
    bpy.ops.render.render(write_still=True)
os.replace(os.path.join(out_dir, "frame_00.png"), os.path.join(out_dir, "front.png"))
subprocess.run(
    ["ffmpeg", "-y", "-framerate", "6", "-pattern_type", "glob", "-i", os.path.join(out_dir, "frame_*.png"), "-vf", "scale=256:-1,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse", "-loop", "0", os.path.join(out_dir, "turntable.gif")],
    check=False,
)
