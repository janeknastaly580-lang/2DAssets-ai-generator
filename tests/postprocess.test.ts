import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { packSpriteSheet } from "@/lib/postprocess/atlas";
import { pixelate, medianCut, rgbToLab } from "@/lib/postprocess/pixelArt";
import { decodeWav, encodeWav, loopCrossfade, normalizePeak, synthMock, trimSilence } from "@/lib/postprocess/audio";
import { boxMesh, buildGlb, splitGlb } from "@/lib/postprocess/glb";
import { fileMatchesPreset, readmeFor } from "@/lib/postprocess/enginePresets";

async function solid(w: number, h: number, rgba: [number, number, number, number]) {
  return sharp({ create: { width: w, height: h, channels: 4, background: { r: rgba[0], g: rgba[1], b: rgba[2], alpha: rgba[3] / 255 } } })
    .png()
    .toBuffer();
}

describe("atlas packer (SPEC §10.3)", () => {
  it("packs equal frames on a grid and emits TexturePacker hash + Godot .tres", async () => {
    const frames = await Promise.all([solid(32, 32, [255, 0, 0, 255]), solid(32, 32, [0, 255, 0, 255]), solid(32, 32, [0, 0, 255, 255])]);
    const sheet = await packSpriteSheet([{ name: "walk", fps: 12, loop: true, frames }], { imageName: "walk.png" });
    expect(sheet.columns).toBe(3);
    expect(sheet.width).toBe(32 * 3 + 2 * 2);
    expect(Object.keys(sheet.atlas.frames)).toEqual(["walk_000", "walk_001", "walk_002"]);
    expect(sheet.atlas.animations.walk).toHaveLength(3);
    expect(sheet.atlas.frames.walk_001.frame).toEqual({ x: 34, y: 0, w: 32, h: 32 });
    expect(sheet.tres).toContain('[gd_resource type="SpriteFrames"');
    expect(sheet.tres).toContain('"name": &"walk"');
    expect(sheet.tres).toContain("region = Rect2(34, 0, 32, 32)");
  });

  it("wraps rows when exceeding 4096 px", async () => {
    const frames = await Promise.all(Array.from({ length: 5 }, () => solid(1024, 64, [1, 2, 3, 255])));
    const sheet = await packSpriteSheet([{ name: "a", fps: 8, loop: false, frames }], { imageName: "a.png" });
    expect(sheet.columns).toBe(3);
    expect(sheet.width).toBeLessThanOrEqual(4096);
  });
});

describe("pixel-art pipeline (SPEC §10.2)", () => {
  it("downscales to the pixel grid and quantizes to the locked palette", async () => {
    const src = await sharp({ create: { width: 256, height: 128, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } } }).png().toBuffer();
    const res = await pixelate(src, { pixelGrid: 32, palette: ["#ff0000", "#00ff00"] });
    expect(res.width).toBe(32);
    expect(res.height).toBe(16);
    expect(res.palette).toEqual(["#ff0000", "#00ff00"]);
    const { data } = await sharp(res.png1x).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2], data[3]]).toEqual([255, 0, 0, 255]);
  });

  it("median-cut returns at most N colours and Lab conversion is sane", () => {
    const pixels: [number, number, number][] = [];
    for (let i = 0; i < 200; i++) pixels.push([i, 255 - i, (i * 7) % 255]);
    expect(medianCut(pixels, 8).length).toBeLessThanOrEqual(8);
    const [l] = rgbToLab([255, 255, 255]);
    expect(Math.round(l)).toBe(100);
  });
});

describe("audio helpers (SPEC §9.4)", () => {
  it("WAV round-trips and normalisation/trim/loop behave", () => {
    const pcm = synthMock("laser", 1, "sfx");
    const wav = encodeWav(pcm);
    const back = decodeWav(wav)!;
    expect(back.sampleRate).toBe(44100);
    expect(back.channels).toBe(2);
    expect(back.samples[0].length).toBe(pcm.samples[0].length);
    const norm = normalizePeak(back, -1);
    const peak = Math.max(...Array.from(norm.samples[0]).map(Math.abs));
    expect(peak).toBeCloseTo(Math.pow(10, -1 / 20), 2);
    const trimmed = trimSilence(norm);
    expect(trimmed.samples[0].length).toBeLessThanOrEqual(norm.samples[0].length);
    const looped = loopCrossfade(trimmed, 30);
    expect(looped.samples[0].length).toBe(trimmed.samples[0].length - Math.round(44100 * 0.03));
  });
});

describe("GLB writer", () => {
  it("produces a valid glTF binary that can be split", () => {
    const glb = buildGlb(boxMesh("cube", 1, 1, 1, [1, 0, 0, 1]));
    expect(glb.readUInt32LE(0)).toBe(0x46546c67);
    const split = splitGlb(glb, "model.bin")!;
    const json = JSON.parse(split.gltf);
    expect(json.meshes[0].primitives[0].attributes.POSITION).toBe(0);
    expect(json.buffers[0].uri).toBe("model.bin");
    expect(split.bin.length).toBe(json.buffers[0].byteLength);
  });
});

describe("engine presets (SPEC §10.4/§10.5)", () => {
  it("filters files per preset", () => {
    const f = (format: string, variant: string | null = null, engine_preset: string | null = null) => ({ format, variant, engine_preset });
    expect(fileMatchesPreset(f("mp3"), "unreal", "audio_sfx")).toBe(false);
    expect(fileMatchesPreset(f("wav"), "unreal", "audio_sfx")).toBe(true);
    expect(fileMatchesPreset(f("tres", "sheet", "godot"), "unity", "sprite_animation")).toBe(false);
    expect(fileMatchesPreset(f("json_atlas", "sheet"), "unity", "sprite_animation")).toBe(true);
    expect(fileMatchesPreset(f("fbx", "unreal", "unreal"), "unity", "model_3d")).toBe(false);
    expect(readmeFor("godot", "sprite_animation", { pixel_grid: 32 })?.content).toContain("Nearest");
  });
});
