// Worker entry. Serves the static site from the ASSETS binding and owns /api/* for later phases.

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    const response = url.pathname.startsWith("/api/")
      ? Response.json({ error: "not_found", message: "The results API arrives in a later phase." }, { status: 404 })
      : await env.ASSETS.fetch(request);

    return withHeaders(response, env.ENVIRONMENT);
  },
} satisfies ExportedHandler<Env>;

export function withHeaders(response: Response, environment: string): Response {
  const headers = new Headers(response.headers);
  // Vite's dev server injects inline styles and scripts, so the CSP only applies to built output.
  if (!import.meta.env.DEV) {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  }
  if (environment !== "production") headers.set("X-Robots-Tag", "noindex");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
