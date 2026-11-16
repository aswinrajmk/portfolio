export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function error(status: number, code: string, message: string): Response {
  return json({ error: code, message }, status);
}

export async function readJson(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > maxBytes)
    return { ok: false, response: error(413, "too_large", `Body is larger than ${maxBytes} bytes`) };
  const text = await request.text();
  if (text.length > maxBytes)
    return { ok: false, response: error(413, "too_large", `Body is larger than ${maxBytes} bytes`) };
  if (text.trim() === "") return { ok: true, body: undefined };
  try {
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, response: error(400, "invalid_json", "Body is not valid JSON") };
  }
}

// Compares the bearer token with the configured secret in constant time (hashing first equalises lengths).
export async function isAuthorized(request: Request, secret: string | undefined): Promise<boolean> {
  if (!secret) return false;
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match?.[1]) return false;
  const encoder = new TextEncoder();
  const [given, expected] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(match[1])),
    crypto.subtle.digest("SHA-256", encoder.encode(secret)),
  ]);
  return crypto.subtle.timingSafeEqual(given, expected);
}
