import "server-only";

import sanitizeHtml from "sanitize-html";

import { looksLikeBlogHtml, plainBlogTextToHtml } from "./blog-content-plain";

export { looksLikeBlogHtml, plainBlogTextToHtml } from "./blog-content-plain";

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
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
  allowedAttributes: {
    a: ["href", "target", "rel", "title"],
    img: ["src", "alt", "width", "height", "title"],
    "*": ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    img: ["http", "https", "data"],
  },
  allowProtocolRelative: false,
};

export function sanitizeBlogHtml(dirty: string): string {
  return sanitizeHtml(dirty, SANITIZE_OPTIONS);
}

export function blogContentToSafeHtml(content: string): string {
  const raw = content.trim();
  if (!raw) return "";
  const asHtml = looksLikeBlogHtml(raw) ? raw : plainBlogTextToHtml(raw);
  return sanitizeBlogHtml(asHtml);
}
