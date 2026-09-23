"""
Blender headless conversion (SPEC §9.3 post-processing, §10.4).
  blender -b --python convert.py -- <input.glb> <out_dir> '{"targets":["fbx_unity","fbx_unreal","obj"],"scale_m":1.8}'
- normalises scale to `scale_m` (height), origin bottom-centre, Y-up for GLB/GLTF
- FBX unity: Y-up, metres · FBX unreal: Z-up, centimetres
- OBJ+MTL + extracted textures zipped as model_obj.zip
"""
import json
import os
import sys
import zipfile

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
src, out_dir, opts = argv[0], argv[1], json.loads(argv[2] if len(argv) > 2 else "{}")
os.makedirs(out_dir, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]

# --- normalise: height = scale_m, origin at bottom centre ---
if meshes:
    mins = Vector((1e9, 1e9, 1e9))
    maxs = Vector((-1e9, -1e9, -1e9))
    for o in meshes:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            mins = Vector(map(min, mins, w))
            maxs = Vector(map(max, maxs, w))
    height = max(1e-6, maxs.z - mins.z)
    target = float(opts.get("scale_m") or 1.0)
    s = target / height
    centre = Vector(((mins.x + maxs.x) / 2, (mins.y + maxs.y) / 2, mins.z))
    for o in meshes:
        if o.parent is None:
            o.location = (o.location - centre) * s
            o.scale = o.scale * s

targets = opts.get("targets", [])
if "fbx_unity" in targets:
    bpy.ops.export_scene.fbx(filepath=os.path.join(out_dir, "model_unity.fbx"), axis_forward="-Z", axis_up="Y", global_scale=1.0, apply_unit_scale=True, bake_anim=True, path_mode="COPY", embed_textures=True)
if "fbx_unreal" in targets:
    bpy.ops.export_scene.fbx(filepath=os.path.join(out_dir, "model_unreal.fbx"), axis_forward="X", axis_up="Z", global_scale=100.0, apply_unit_scale=True, bake_anim=True, path_mode="COPY", embed_textures=True)
if "obj" in targets:
    obj_dir = os.path.join(out_dir, "obj")
    os.makedirs(obj_dir, exist_ok=True)
    bpy.ops.wm.obj_export(filepath=os.path.join(obj_dir, "model.obj"), export_materials=True, path_mode="COPY", forward_axis="NEGATIVE_Z", up_axis="Y")
    with zipfile.ZipFile(os.path.join(out_dir, "model_obj.zip"), "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(obj_dir):
            for f in files:
                z.write(os.path.join(root, f), f)
