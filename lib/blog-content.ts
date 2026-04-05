import "server-only";

import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

import { looksLikeBlogHtml, plainBlogTextToHtml } from "./blog-content-plain";

export { looksLikeBlogHtml, plainBlogTextToHtml } from "./blog-content-plain";

const domWindow = new JSDOM("").window;
const purify = createDOMPurify(domWindow as unknown as Parameters<typeof createDOMPurify>[0]);

const SANITIZE_CONFIG: Parameters<typeof purify.sanitize>[1] = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "h1",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "a",
    "img",
    "blockquote",
    "code",
    "pre",
    "hr",
  ],
  ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "width", "height", "target", "rel"],
  ALLOW_DATA_ATTR: false,
};

export function sanitizeBlogHtml(dirty: string): string {
  return purify.sanitize(dirty, SANITIZE_CONFIG) as string;
}

export function blogContentToSafeHtml(content: string): string {
  const raw = content.trim();
  if (!raw) return "";
  const asHtml = looksLikeBlogHtml(raw) ? raw : plainBlogTextToHtml(raw);
  return sanitizeBlogHtml(asHtml);
}
