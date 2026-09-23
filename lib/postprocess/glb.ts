/**
 * Minimal glTF 2.0 writer used in MOCK_PROVIDERS mode and for GLB → GLTF/OBJ conversion of
 * simple meshes when the Blender worker is not configured. Produces a valid binary GLB that
 * three.js and every engine importer can load.
 */
export interface SimpleMesh {
  positions: number[]; // xyz
  normals: number[];
  indices: number[];
  color: [number, number, number, number];
  name: string;
}

/** Y-up, metres, origin at bottom-centre (SPEC §9.3 normalisation). */
export function boxMesh(name: string, sx: number, sy: number, sz: number, color: SimpleMesh["color"]): SimpleMesh {
  const hx = sx / 2,
    hz = sz / 2;
  const faces: { n: [number, number, number]; v: [number, number, number][] }[] = [
    { n: [0, 0, 1], v: [[-hx, 0, hz], [hx, 0, hz], [hx, sy, hz], [-hx, sy, hz]] },
    { n: [0, 0, -1], v: [[hx, 0, -hz], [-hx, 0, -hz], [-hx, sy, -hz], [hx, sy, -hz]] },
    { n: [1, 0, 0], v: [[hx, 0, hz], [hx, 0, -hz], [hx, sy, -hz], [hx, sy, hz]] },
    { n: [-1, 0, 0], v: [[-hx, 0, -hz], [-hx, 0, hz], [-hx, sy, hz], [-hx, sy, -hz]] },
    { n: [0, 1, 0], v: [[-hx, sy, hz], [hx, sy, hz], [hx, sy, -hz], [-hx, sy, -hz]] },
    { n: [0, -1, 0], v: [[-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz]] },
  ];
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  faces.forEach((f, i) => {
    f.v.forEach((p) => {
      positions.push(...p);
      normals.push(...f.n);
    });
    const b = i * 4;
    indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  return { positions, normals, indices, color, name };
}

function pad4(n: number) {
  return (4 - (n % 4)) % 4;
}

export function buildGlb(mesh: SimpleMesh): Buffer {
  const pos = new Float32Array(mesh.positions);
  const nor = new Float32Array(mesh.normals);
  const idx = new Uint16Array(mesh.indices);
  const posBytes = Buffer.from(pos.buffer);
  const norBytes = Buffer.from(nor.buffer);
  const idxBytes = Buffer.from(idx.buffer);
  const idxPad = Buffer.alloc(pad4(idxBytes.length));
  const bin = Buffer.concat([posBytes, norBytes, idxBytes, idxPad]);

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      min[c] = Math.min(min[c], pos[i + c]);
      max[c] = Math.max(max[c], pos[i + c]);
    }
  }

  const gltf = {
    asset: { version: "2.0", generator: "Veyraflow" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: mesh.name }],
    meshes: [{ name: mesh.name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    materials: [{ name: "Default", pbrMetallicRoughness: { baseColorFactor: mesh.color, metallicFactor: 0, roughnessFactor: 0.8 } }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBytes.length, target: 34962 },
      { buffer: 0, byteOffset: posBytes.length, byteLength: norBytes.length, target: 34962 },
      { buffer: 0, byteOffset: posBytes.length + norBytes.length, byteLength: idxBytes.length, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: pos.length / 3, type: "VEC3", min, max },
      { bufferView: 1, componentType: 5126, count: nor.length / 3, type: "VEC3" },
      { bufferView: 2, componentType: 5123, count: idx.length, type: "SCALAR" },
    ],
  };
  let json = Buffer.from(JSON.stringify(gltf));
  json = Buffer.concat([json, Buffer.alloc(pad4(json.length), 0x20)]);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // glTF
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const jsonChunk = Buffer.alloc(8);
  jsonChunk.writeUInt32LE(json.length, 0);
  jsonChunk.writeUInt32LE(0x4e4f534a, 4); // JSON
  const binChunk = Buffer.alloc(8);
  binChunk.writeUInt32LE(bin.length, 0);
  binChunk.writeUInt32LE(0x004e4942, 4); // BIN
  return Buffer.concat([header, jsonChunk, json, binChunk, bin]);
}

/** Wavefront OBJ + MTL text for the same mesh (generic export). */
export function buildObj(mesh: SimpleMesh, mtlName: string): { obj: string; mtl: string } {
  const lines = [`# Veyraflow export`, `mtllib ${mtlName}`, `o ${mesh.name}`];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    lines.push(`v ${mesh.positions[i]} ${mesh.positions[i + 1]} ${mesh.positions[i + 2]}`);
  }
  for (let i = 0; i < mesh.normals.length; i += 3) {
    lines.push(`vn ${mesh.normals[i]} ${mesh.normals[i + 1]} ${mesh.normals[i + 2]}`);
  }
  lines.push("usemtl Default");
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i] + 1,
      b = mesh.indices[i + 1] + 1,
      c = mesh.indices[i + 2] + 1;
    lines.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
  }
  const [r, g, b] = mesh.color;
  const mtl = [`newmtl Default`, `Kd ${r} ${g} ${b}`, `Ka 0 0 0`, `Ks 0.1 0.1 0.1`, `d 1`, `illum 2`].join("\n");
  return { obj: lines.join("\n") + "\n", mtl: mtl + "\n" };
}

/** Parse a GLB produced by buildGlb (or any single-mesh GLB) into JSON + BIN parts for .gltf export. */
export function splitGlb(glb: Buffer, binName: string): { gltf: string; bin: Buffer } | null {
  if (glb.readUInt32LE(0) !== 0x46546c67) return null;
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString("utf8"));
  const binOffset = 20 + jsonLen + 8;
  const binLen = glb.readUInt32LE(20 + jsonLen);
  const bin = glb.subarray(binOffset, binOffset + binLen);
  json.buffers = [{ byteLength: binLen, uri: binName }];
  return { gltf: JSON.stringify(json, null, 2), bin: Buffer.from(bin) };
}
