/** Csak szöveg/HTML felismerés — kliens (TipTap) és szerver közös, DOMPurify nélkül. */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function looksLikeBlogHtml(content: string): boolean {
  const t = content.trim();
  if (!t) return false;
  if (!t.startsWith("<")) return false;
  return /<\/?[a-z][\s/>]/i.test(t);
}

export function plainBlogTextToHtml(text: string): string {
  if (!text.trim()) return "<p></p>";
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks
    .map((block) => {
      const inner = escapeHtml(block).replace(/\n/g, "<br>");
      return `<p>${inner}</p>`;
    })
    .join("");
}
