/**
 * Server helpers for ZApp backends (Node 18+). Authenticate with your app API key
 * (`zapp_sk_...`). Never ship the key to the browser.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export class ZendServer {
  constructor(private apiKey: string, private baseUrl = "https://api.usezend.app") {}

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const r = await fetch(`${this.baseUrl}/api/zend/v2${path}`, {
      method,
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(json.message ?? `HTTP ${r.status}`), { code: json.error, status: r.status });
    return json as T;
  }

  /** Exchange the `appSession` from `zend.identity.get()` for the verified user. */
  verifySession(appSession: string) {
    return this.req<{ app_user_id: string; username: string | null; name: string; avatar: string | null;
      scopes: string[]; email?: string; address?: string }>("POST", "/apps/token/verify", { app_session: appSession });
  }

  createInteraction(p: { type: string; created_by: string; participants?: string[]; data?: object;
    visibility?: string; expires_in_secs?: number }) {
    return this.req("POST", "/apps/server/interactions", p);
  }

  getInteraction(id: string) {
    return this.req("GET", `/apps/server/interactions/${id}`);
  }

  /** e.g. resolve a game: `{ state: "resolved", data: { winner }, idempotency_key: gameId }` */
  updateInteraction(id: string, p: { state: string; data?: object; idempotency_key: string; expected_version?: number }) {
    return this.req("PATCH", `/apps/server/interactions/${id}`, p);
  }
}

/** Verifies a Zend webhook: header `x-zend-signature: t=<unix>,v1=<hex hmac-sha256(secret, "t.body")>`. */
export function verifyWebhook(rawBody: string, header: string, secret: string, toleranceSecs = 300): boolean {
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!parts.v1 || !Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > toleranceSecs) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(parts.v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
