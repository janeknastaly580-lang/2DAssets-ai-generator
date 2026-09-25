import { describe, expect, it } from "vitest";
import { sanitizeUrl } from "@/lib/analytics";

describe("GA4 URL sanitizing (SPEC §21.6)", () => {
  const o = "https://veyraflow.eu";
  it("replaces share/invite tokens and UUIDs in the path", () => {
    expect(sanitizeUrl(`${o}/s/Qm9vLXNoYXJlLXRva2VuLXRoYXQtaXMtNDMtY2hhcnMtbG9uZw`)).toBe(`${o}/s/[id]`);
    expect(sanitizeUrl(`${o}/invite/9f2c4e1ab37d4c0e8b1f6a2d5e7c9b3a`)).toBe(`${o}/invite/[id]`);
    expect(sanitizeUrl(`${o}/app/assets/3f1e2d4c-5b6a-4789-9abc-def012345678`)).toBe(`${o}/app/assets/[id]`);
  });
  it("keeps route names", () => {
    expect(sanitizeUrl(`${o}/app/generate/audio_music`)).toBe(`${o}/app/generate/audio_music`);
    expect(sanitizeUrl(`${o}/forgot-password`)).toBe(`${o}/forgot-password`);
  });
  it("drops the query string (e-mails, next=) and hash but keeps utm_*", () => {
    expect(sanitizeUrl(`${o}/verify?email=jan%40example.com`)).toBe(`${o}/verify`);
    expect(sanitizeUrl(`${o}/login?next=%2Fapp%2Fbilling#x`)).toBe(`${o}/login`);
    expect(sanitizeUrl(`${o}/pricing?utm_source=reddit&email=a%40b.co&utm_campaign=launch`)).toBe(`${o}/pricing?utm_source=reddit&utm_campaign=launch`);
  });
});
