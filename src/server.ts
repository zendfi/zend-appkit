/**
 * Server helpers for ZApp backends (Node 18+). Authenticate with your app API key
 * (`zapp_sk_...`). Never ship the key to the browser.
 */
import { createHash, createHmac, createPrivateKey, createPublicKey, sign, timingSafeEqual, verify } from "node:crypto";

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

  /** The prize and every joined player's address and appUserId. */
  getPrize(id: string) {
    return this.req<any>("GET", `/apps/server/prizes/${id}`);
  }

  /**
   * Signs the result with your resolver key and posts it. `winners` are player addresses from
   * `getPrize().players`; `amountsUsd` are converted to base units (6 decimals). Payout happens
   * after the dispute window unless the host cancels.
   */
  async resolvePrize(id: string, winners: string[], amountsUsd: number[], resolverSeedHex: string, correction = false) {
    const amounts = amountsUsd.map((a) => BigInt(Math.round(a * 1_000_000)));
    const msg = prizeResultMessage(id, winners, amounts, correction);
    const signature = sign(null, msg, resolverKeyFromSeed(resolverSeedHex).privateKey).toString("hex");
    return this.req("POST", `/apps/server/prizes/${id}/resolve`, {
      winners, amounts: amounts.map((a) => Number(a)), signature, correction,
    });
  }

  /**
   * Puts an item on sale (pay-to-read). `to` (`"app"` = your payout account, or `"@username"`)
   * gets what `splits` leave. Returns the listing; encrypt the item's content for
   * `listing_id` (see `unlockIdentity`). A `202 pending` answer means send it again shortly.
   */
  createListing(p: { item: string; title?: string; to: string; splits?: { to: string; percent?: number; amount_usd?: number }[] }
    & ({ amount_usd: number } | { price: { ngn: number } })) {
    return this.req<UnlockListing>("POST", "/apps/server/unlock/listings", p);
  }

  getListing(item: string) {
    return this.req<UnlockListing>("GET", `/apps/server/unlock/listings/${encodeURIComponent(item)}`);
  }

  /** Pause (`active: false`), resume, retitle, or reprice (give `to`, the price and `splits` together). */
  updateListing(item: string, p: { active?: boolean; title?: string; to?: string; amount_usd?: number;
    price?: { ngn: number }; splits?: { to: string; percent?: number; amount_usd?: number }[] }) {
    return this.req<UnlockListing>("PATCH", `/apps/server/unlock/listings/${encodeURIComponent(item)}`, p);
  }

  /** Whether `appUserId` holds a receipt for `item` right now (checked on Sui). */
  hasAccess(item: string, appUserId: string) {
    const q = new URLSearchParams({ item, user: appUserId });
    return this.req<{ item: string; unlocked: boolean }>("GET", `/apps/server/unlock/access?${q}`);
  }

  getInteraction(id: string) {
    return this.req("GET", `/apps/server/interactions/${id}`);
  }

  /** e.g. resolve a game: `{ state: "resolved", data: { winner }, idempotency_key: gameId }` */
  updateInteraction(id: string, p: { state: string; data?: object; idempotency_key: string; expected_version?: number }) {
    return this.req("PATCH", `/apps/server/interactions/${id}`, p);
  }
}

export interface UnlockListing {
  item: string; title: string | null; listing_id: string;
  price_usd: number; price_ngn: number | null;
  parts: { to: string | null; label: string; amount_usd: number }[];
  active: boolean; sold: number;
  verify: { package: string; listing: string };
}

/** Seal settings for encrypting pay-to-read content on mainnet. */
export const UNLOCK_SEAL = {
  packageId: "0x7c07a8df79e3f5b92c3b7352c06bce2b28ba1381d5724af6c3db8d19cef8063d",
  /** Seal's decentralised mainnet committee (5 of 8). Use threshold 1 with it. */
  committee: "0x686098f1439237fff9f36b99c7329683c22979d2005c2465cb891acb012a7595",
  aggregatorUrl: "https://seal-aggregator-mainnet.mystenlabs.com",
} as const;

/**
 * The Seal identity (hex, no `0x`) to encrypt one piece of a listing under: the listing id, then
 * an optional suffix so one listing can hold several pieces ("chapter-2").
 */
export function unlockIdentity(listingId: string, suffix = ""): string {
  return listingId.replace(/^0x/, "").padStart(64, "0").toLowerCase() + Buffer.from(suffix, "utf8").toString("hex");
}

function uleb(n: number): number[] {
  const out: number[] = [];
  do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; out.push(b); } while (n);
  return out;
}
const hex32 = (h: string) => Buffer.from(h.replace(/^0x/, "").padStart(64, "0"), "hex");

/** Bytes the resolver key signs; identical to `zend::prize::result_message`. */
export function prizeResultMessage(prizeId: string, winners: string[], amounts: bigint[], correction = false): Buffer {
  const amt = amounts.map((a) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(a); return b; });
  return Buffer.concat([
    Buffer.from("zend-prize-result-v1"), hex32(prizeId),
    Buffer.from(uleb(winners.length)), ...winners.map(hex32),
    Buffer.from(uleb(amounts.length)), ...amt,
    Buffer.from([correction ? 1 : 0]),
  ]);
}

/** Ed25519 key from a 32-byte hex seed (keep it on your server; its public half goes in `resolverKey`). */
export function resolverKeyFromSeed(seedHex: string) {
  const der = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(seedHex, "hex")]);
  const privateKey = createPrivateKey({ key: der, format: "der", type: "pkcs8" });
  const spki = createPublicKey(privateKey).export({ format: "der", type: "spki" }) as Buffer;
  return { privateKey, publicKeyHex: spki.subarray(-32).toString("hex") };
}

/**
 * Verifies a Zend attestation receipt offline against Zend's public key
 * (GET /api/zend/v2/apps/attest/key).
 */
export function verifyAttestation(r: { id: number; app: string; app_user_id: string; interaction_id: string; label: string;
  data_hash: string; prev_hash: string; unix_ms: number; receipt_hash: string; signature: string }, zendPublicKeyHex: string): boolean {
  const be = (n: number) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; };
  const z = Buffer.from([0]);
  const bytes = Buffer.concat([Buffer.from("zend-attest-v1"), be(r.id),
    Buffer.from(r.app), z, Buffer.from(r.app_user_id), z, Buffer.from(r.interaction_id), z, Buffer.from(r.label), z,
    Buffer.from(r.data_hash, "hex"), Buffer.from(r.prev_hash, "hex"), be(r.unix_ms)]);
  const hash = createHash("sha256").update(bytes).digest();
  if (hash.toString("hex") !== r.receipt_hash) return false;
  const pub = createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(zendPublicKeyHex, "hex")]), format: "der", type: "spki" });
  return verify(null, hash, pub, Buffer.from(r.signature, "hex"));
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
