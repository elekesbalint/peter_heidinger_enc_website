import React from "react";

import { looksLikeLegalHtml } from "@/lib/legal-content";

type ParsedNode =
  | { type: "section-heading"; text: string }
  | { type: "numbered-heading"; number: string; text: string }
  | { type: "sub-paragraph"; number: string; text: string }
  | { type: "paragraph"; text: string };

function parseInlineBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

function parseContent(content: string): ParsedNode[] {
  const rawBlocks = content.split(/\n\s*\n/g).map((b) => b.trim()).filter(Boolean);
  const nodes: ParsedNode[] = [];

  for (const block of rawBlocks) {
    const lines = block.split("\n");
    const firstLine = lines[0].trim();

    if (firstLine.startsWith("## ")) {
      nodes.push({ type: "section-heading", text: firstLine.slice(3).trim() });
      const rest = lines.slice(1).join("\n").trim();
      if (rest) nodes.push({ type: "paragraph", text: rest });
      continue;
    }

    // numbered heading: "1.", "2.", etc. (single digit group)
    const numberedHeadingMatch = firstLine.match(/^(\d+)\.\s+(.+)/);
    if (numberedHeadingMatch && !firstLine.match(/^\d+\.\d+/)) {
      const headingText = lines.slice(1).length
        ? [numberedHeadingMatch[2], ...lines.slice(1)].join("\n")
        : numberedHeadingMatch[2];
      nodes.push({
        type: "numbered-heading",
        number: numberedHeadingMatch[1] + ".",
        text: headingText.trim(),
      });
      continue;
    }

    // sub-paragraph: "1.1.", "1.2.", etc.
    const subMatch = firstLine.match(/^(\d+\.\d+\.?)\s+([\s\S]+)/);
    if (subMatch) {
      const rest = lines.slice(1).join("\n").trim();
      const fullText = rest ? subMatch[2] + "\n" + rest : subMatch[2];
      nodes.push({ type: "sub-paragraph", number: subMatch[1], text: fullText.trim() });
      continue;
    }

    nodes.push({ type: "paragraph", text: block });
  }

  return nodes;
}

interface LegalDocumentProps {
  title: string;
  label?: string;
  lastUpdated?: string;
  intro?: string;
  content: string;
  documentUrl?: string;
  documentLabel?: string;
}

export function LegalDocument({
  title,
  label,
  lastUpdated,
  intro,
  content,
  documentUrl,
  documentLabel = "Dokumentum megnyitása / letöltése",
}: LegalDocumentProps) {
  const hasDocument = Boolean(documentUrl);
  const isHtml = !hasDocument && looksLikeLegalHtml(content);
  const nodes = hasDocument || isHtml ? [] : parseContent(content);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      {label && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
          {label}
        </p>
      )}
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      {lastUpdated && (
        <p className="mt-2 text-sm text-muted">Utoljára frissítve: {lastUpdated}</p>
      )}

      {hasDocument ? (
        <a
          href={documentUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100"
        >
          {documentLabel}
        </a>
      ) : (
        <>
          {intro && (
            <p className="mt-4 text-sm leading-relaxed text-muted">{intro}</p>
          )}
          {isHtml ? (
            <div
              className="legal-prose mt-8"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
          <div className="mt-8 space-y-1 text-sm leading-relaxed text-foreground">
            {nodes.map((node, idx) => {
              if (node.type === "section-heading") {
                return (
                  <h2
                    key={idx}
                    className="pb-1 pt-8 text-base font-semibold text-foreground first:pt-0"
                  >
                    {parseInlineBold(node.text)}
                  </h2>
                );
              }
              if (node.type === "numbered-heading") {
                return (
                  <div key={idx} className="pb-1 pt-8 first:pt-0">
                    <h2 className="text-base font-semibold text-foreground">
                      {node.number} {parseInlineBold(node.text)}
                    </h2>
                  </div>
                );
              }
              if (node.type === "sub-paragraph") {
                return (
                  <div key={idx} className="flex gap-3 py-1.5 pl-2">
                    <span className="mt-0.5 shrink-0 text-xs font-medium text-muted">
                      {node.number}
                    </span>
                    <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">
                      {parseInlineBold(node.text)}
                    </p>
                  </div>
                );
              }
              return (
                <p
                  key={idx}
                  className="py-1 text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap"
                >
                  {parseInlineBold(node.text)}
                </p>
              );
            })}
          </div>
          )}
        </>
      )}
    </div>
  );
}
