/** Object key schema (SPEC §13). */
export const storageKeys = {
  assetFile: (ws: string, project: string, asset: string, variant: string, ext: string) =>
    `ws/${ws}/proj/${project}/asset/${asset}/${variant}.${ext}`,
  assetPreview: (ws: string, project: string, asset: string, name: string) =>
    `ws/${ws}/proj/${project}/asset/${asset}/preview/${name}`,
  reference: (ws: string, refId: string, ext: string) => `ws/${ws}/refs/${refId}.${ext}`,
  upload: (ws: string, uploadId: string, ext: string) => `ws/${ws}/uploads/${uploadId}.${ext}`,
  download: (ws: string, downloadId: string) => `downloads/${ws}/${downloadId}.zip`,
  avatar: (userId: string, ext: string) => `users/${userId}/avatar.${ext}`,
};

/** Workspace id embedded in a key (used by the local-storage file gate). */
export function workspaceIdFromKey(key: string): string | null {
  const m = key.match(/^(?:ws|downloads)\/([0-9a-f-]{36})\//);
  return m ? m[1] : null;
}

export function userIdFromKey(key: string): string | null {
  const m = key.match(/^users\/([0-9a-f-]{36})\//);
  return m ? m[1] : null;
}

export const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  json: "application/json",
  tres: "text/plain",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  bin: "application/octet-stream",
  fbx: "application/octet-stream",
  obj: "text/plain",
  mtl: "text/plain",
  wav: "audio/wav",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  zip: "application/zip",
  md: "text/markdown",
  txt: "text/plain",
  svg: "image/svg+xml",
};

export function mimeFor(keyOrExt: string): string {
  const ext = keyOrExt.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

export function extForMime(mime: string): string {
  const entry = Object.entries(MIME_BY_EXT).find(([, m]) => m === mime);
  return entry ? entry[0] : "bin";
}
