import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

export type LegalDocId = "terms" | "privacy" | "cookies" | "ai-disclosure" | "impressum";

export interface LegalDoc {
  id: LegalDocId;
  title: string;
  version: string;
  last_updated: string;
  status: "draft" | "published";
  body: string; // markdown
}

/** Loads `docs/legal/<id>.md` with a minimal frontmatter parser (SPEC §21.2). */
export async function loadLegalDoc(id: LegalDocId): Promise<LegalDoc> {
  const raw = await fs.readFile(path.join(process.cwd(), "docs", "legal", `${id}.md`), "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta: Record<string, string> = {};
  if (m) {
    for (const line of m[1].split("\n")) {
      const idx = line.indexOf(":");
      if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return {
    id,
    title: meta.title ?? id,
    version: meta.version ?? "0",
    last_updated: meta.last_updated ?? "",
    status: (meta.status as LegalDoc["status"]) ?? "draft",
    body: m ? m[2].trim() : raw,
  };
}

/** Tiny markdown → HTML for the placeholder documents (headings, paragraphs, lists, links, emphasis). */
export function markdownToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let list: string[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list.length) out.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`);
    list = [];
  };
  for (const line of lines) {
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushPara();
      flushList();
      out.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`);
      continue;
    }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      flushPara();
      list.push(li[1]);
      continue;
    }
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return out.join("\n");
}
