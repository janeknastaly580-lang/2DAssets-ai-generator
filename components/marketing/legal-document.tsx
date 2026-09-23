import { loadLegalDoc, markdownToHtml, type LegalDocId } from "@/lib/legal";
import { Badge } from "@/components/ui/primitives";

/** SPEC §17.2 / §21.2 — document layout with "Last updated"; bodies are placeholders. */
export async function LegalDocument({ id }: { id: LegalDocId }) {
  const doc = await loadLegalDoc(id);
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{doc.title}</h1>
        {doc.status === "draft" && <Badge variant="warning">Draft</Badge>}
      </div>
      <p className="text-muted-foreground mb-8 text-sm">
        Version {doc.version} · Last updated {doc.last_updated || "—"}
      </p>
      <div className="prose prose-invert max-w-none [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:my-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_a]:underline" dangerouslySetInnerHTML={{ __html: markdownToHtml(doc.body) }} />
    </article>
  );
}
