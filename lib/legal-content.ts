/** Plain-text ↔ HTML helpers for legal document content (ÁSZF / Adatvédelem). */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineBoldToHtml(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

export function looksLikeLegalHtml(content: string): boolean {
  const t = content.trim();
  if (!t) return false;
  if (!t.startsWith("<")) return false;
  return /<\/?[a-z][\s/>]/i.test(t);
}

/**
 * Converts old plain-text legal format to Tiptap-compatible HTML.
 *
 * Mapping:
 *   ## Section title   → <h2>
 *   1. Chapter title   → <h3>1. Chapter title</h3>
 *   1.1. Sub-text      → <p><strong>1.1.</strong> Sub-text</p>
 *   Regular paragraph  → <p>
 *   **bold**           → <strong>
 */
export function plainLegalTextToHtml(text: string): string {
  if (!text.trim()) return "<p></p>";

  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const lines = block.split("\n");
      const first = lines[0].trim();

      if (first.startsWith("## ")) {
        const heading = escapeHtml(first.slice(3).trim());
        return `<h2>${heading}</h2>`;
      }

      const numberedHeading = first.match(/^(\d+)\.\s+(.+)/);
      if (numberedHeading && !first.match(/^\d+\.\d+/)) {
        const rest = lines.slice(1).join(" ").trim();
        const inner = escapeHtml(
          numberedHeading[1] + ". " + numberedHeading[2] + (rest ? " " + rest : ""),
        );
        return `<h3>${inner}</h3>`;
      }

      const subMatch = first.match(/^(\d+\.\d+\.?)\s+([\s\S]+)/);
      if (subMatch) {
        const rest = lines.slice(1).join(" ").trim();
        const number = escapeHtml(subMatch[1]);
        const body = inlineBoldToHtml(
          escapeHtml(subMatch[2] + (rest ? " " + rest : "")),
        );
        return `<p><strong>${number}</strong> ${body}</p>`;
      }

      const inner = inlineBoldToHtml(
        escapeHtml(block).replace(/\n/g, "<br>"),
      );
      return `<p>${inner}</p>`;
    })
    .join("");
}
