import { env } from "./env";

export async function postJson<TResponse>(
  path: string,
  payload: unknown,
): Promise<TResponse> {
  const url = `${env.webBaseUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as TResponse & { error?: string };
  if (!res.ok) {
    const message = (data as { error?: string }).error ?? `Request failed with ${res.status}`;
    throw new Error(message);
  }
  return data;
}

