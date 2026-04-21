import { headers } from "next/headers";

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export async function getRequestClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for") ?? "";
  const firstForwarded = forwarded
    .split(",")
    .map((x) => x.trim())
    .find(Boolean);
  const realIp = h.get("x-real-ip")?.trim();
  return firstForwarded || realIp || "unknown";
}

export async function getRequestUserAgent(): Promise<string> {
  const h = await headers();
  return h.get("user-agent")?.trim() || "unknown";
}
