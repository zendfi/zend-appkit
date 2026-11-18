/**
 * Bot helpers (Node 18+). Run a Zend bot account from code: read and send messages, post to the
 * feed, get paid, and pay within the limits its owner set.
 *
 * A bot has two secrets and keeps both on your machine or server:
 *  - the API key (`zbot_live_...`), which signs the bot in;
 *  - the signing key, which signs its payments. Zend never sees it.
 * `zend bot create` makes both and saves them in `~/.zend/bots/<handle>.json`.
 */
import { createPrivateKey, createPublicKey, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { blake2b } from "@noble/hashes/blake2b";

export class ZendBotError extends Error {
  constructor(message: string, public code: string, public status: number) {
    super(message);
    this.name = "ZendBotError";
  }
}

export interface BotProfile {
  id: string;
  name: string;
  handle: string;
  avatar_url: string | null;
  scopes: string[];
  limits: { per_payment: number; per_day: number; recipient_allowlist: string[] | null; dm_first_contact: boolean };
}

/** A text message someone sent to the bot. */
export interface BotMessage {
  id: string;
  roomId: string;
  /** The sender's user id and @handle (no `@`). */
  from: { userId: string; handle: string };
  text: string;
  createdAt: string;
}

export interface BotContext {
  /** Sends a reply in the same chat. */
  reply(text: string): Promise<void>;
  /** Pays the person who wrote, or anyone else. */
  pay(p: { to?: string; amount: number; note?: string }): Promise<PayResult>;
}

export interface PayResult {
  transaction_id?: string;
  [k: string]: unknown;
}

export interface ZendBotOptions {
  /** The bot's `zbot_live_...` key. */
  apiKey: string;
  /** The bot's signing key, PKCS#8 DER as base64. Needed only to pay. */
  privateKey?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export type MessageHandler = (message: BotMessage, ctx: BotContext) => void | Promise<void>;

const SEEN_LIMIT = 500;

export class ZendBot {
  private apiKey: string;
  private privateKey?: string;
  private baseUrl: string;
  private fetchFn: typeof fetch;
  private handlers: MessageHandler[] = [];
  private errorHandlers: ((e: unknown) => void)[] = [];
  private seen = new Set<string>();
  private meCache?: BotProfile;
  private running = false;
  private wake?: () => void;

  constructor(opts: ZendBotOptions) {
    this.apiKey = opts.apiKey;
    this.privateKey = opts.privateKey;
    this.baseUrl = (opts.baseUrl ?? "https://api.usezend.app").replace(/\/$/, "");
    this.fetchFn = opts.fetch ?? fetch;
  }

  /** Loads a bot made with `zend bot create` from `~/.zend/bots/<handle>.json` (or `dir`). */
  static async fromFile(handle: string, dir = join(homedir(), ".zend", "bots"), baseUrl?: string) {
    const raw = await readFile(join(dir, `${handle.replace(/^@/, "").toLowerCase()}.json`), "utf8");
    const f = JSON.parse(raw) as { apiKey?: string; privateKey?: string };
    if (!f.apiKey) throw new ZendBotError("This bot has no key yet. It may not have been approved.", "NO_API_KEY", 0);
    return new ZendBot({ apiKey: f.apiKey, privateKey: f.privateKey, baseUrl });
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    // A read that never reached Zend is safe to repeat; a write isn't (it may have gone through).
    const attempts = method === "GET" ? 3 : 1;
    let r!: Response;
    for (let i = 1; i <= attempts; i++) {
      try {
        r = await this.fetchFn(`${this.baseUrl}/api/v1/bot${path}`, {
          method,
          headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        break;
      } catch (e) {
        if (i === attempts) throw new ZendBotError("Couldn't reach Zend. Check the connection and try again.", "NETWORK", 0);
        await new Promise((res) => setTimeout(res, 500 * i));
      }
    }
    const json: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new ZendBotError(json.message ?? `HTTP ${r.status}`, json.error ?? "HTTP_ERROR", r.status);
    return json as T;
  }

  // ── Profile and balance ────────────────────────────────────────────────────────────────

  async me(): Promise<BotProfile> {
    this.meCache = await this.req<BotProfile>("GET", "/me");
    return this.meCache;
  }

  rename(displayName: string) {
    return this.req<{ ok: true }>("PATCH", "/me", { display_name: displayName });
  }

  /** `spendable` is what the bot can send now. Run `deposit()` if money arrived but isn't spendable. */
  balance() {
    return this.req<{ spendable: { amount: string }; awaiting_deposit: { amount: string }; wallet: { address: string } }>("GET", "/balance");
  }

  // ── Messages ───────────────────────────────────────────────────────────────────────────

  chats() {
    return this.req<{ threads: any[] }>("GET", "/dm");
  }

  messages(roomId: string, opts: { limit?: number; cursor?: string } = {}) {
    const q = new URLSearchParams();
    if (opts.limit) q.set("limit", String(opts.limit));
    if (opts.cursor) q.set("cursor", opts.cursor);
    const qs = q.toString();
    return this.req<{ messages: any[]; next_cursor: string | null }>("GET", `/dm/${encodeURIComponent(roomId)}/messages${qs ? `?${qs}` : ""}`);
  }

  /** Opens (or finds) the chat with `@handle`. The person must have written first unless the owner turned on first contact. */
  async openChat(handle: string): Promise<string> {
    const r = await this.req<{ room_id: string }>("POST", `/dm/with/${encodeURIComponent(handle.replace(/^@/, ""))}`);
    return r.room_id;
  }

  /** `clientId` makes a retry safe: the same id never sends twice. */
  async send(roomId: string, text: string, clientId?: string) {
    return this.req<{ id: string }>("POST", `/dm/${encodeURIComponent(roomId)}/messages`, { content: text, client_id: clientId });
  }

  async say(handle: string, text: string, clientId?: string) {
    return this.send(await this.openChat(handle), text, clientId);
  }

  markRead(roomId: string, lastMessageId: string) {
    return this.req("POST", `/dm/${encodeURIComponent(roomId)}/read`, { last_message_id: lastMessageId });
  }

  // ── Feed ───────────────────────────────────────────────────────────────────────────────

  /** Only the owner and people who have chatted with or paid the bot see it. */
  post(text: string, clientId?: string) {
    return this.req<{ id: string }>("POST", "/posts", { text, client_id: clientId });
  }

  deletePost(id: string) {
    return this.req("DELETE", `/posts/${encodeURIComponent(id)}`);
  }

  // ── Money ──────────────────────────────────────────────────────────────────────────────

  /**
   * Pays `@to` from the bot. Zend builds the payment and checks the owner's limits, the bot signs
   * it here, and Zend sends it. Rejects with `OVER_PAYMENT_LIMIT`, `OVER_DAILY_LIMIT` or
   * `RECIPIENT_NOT_ALLOWED` when a limit says no.
   */
  async pay(p: { to: string; amount: number; note?: string }): Promise<PayResult> {
    const prep = await this.req<{ transaction_data_bcs: string }>("POST", "/pay/prepare", { to: p.to.replace(/^@/, ""), amount: p.amount });
    return this.req<PayResult>("POST", "/pay/submit", {
      transaction_data_bcs: prep.transaction_data_bcs,
      signature: this.signTransaction(prep.transaction_data_bcs),
      note: p.note,
    });
  }

  /** Makes money the bot received spendable. Moves nothing to anyone else. */
  async deposit(): Promise<PayResult> {
    const prep = await this.req<{ transaction_data_bcs: string }>("POST", "/pay/deposit/prepare");
    return this.req<PayResult>("POST", "/pay/deposit/submit", {
      transaction_data_bcs: prep.transaction_data_bcs,
      signature: this.signTransaction(prep.transaction_data_bcs),
    });
  }

  /**
   * ed25519 over blake2b-256 of the intent prefix `[0, 0, 0]` and the transaction bytes, returned as
   * base64 of: flag byte `0x00`, the 64-byte signature, the 32-byte public key.
   */
  private signTransaction(txBase64: string): string {
    if (!this.privateKey) throw new ZendBotError("This bot has no signing key, so it can't pay.", "NO_SIGNING_KEY", 0);
    const tx = Buffer.from(txBase64, "base64");
    const message = new Uint8Array(3 + tx.length);
    message.set(tx, 3);
    const digest = blake2b(message, { dkLen: 32 });
    const key = createPrivateKey({ key: Buffer.from(this.privateKey, "base64"), format: "der", type: "pkcs8" });
    const signature = sign(null, Buffer.from(digest), key);
    const publicKey = createPublicKey(key).export({ format: "der", type: "spki" }).subarray(-32);
    return Buffer.concat([Buffer.from([0x00]), signature, publicKey]).toString("base64");
  }

  // ── Listening ──────────────────────────────────────────────────────────────────────────

  /** Calls `handler` for each new text message from someone else. Add as many as you like. */
  onMessage(handler: MessageHandler) {
    this.handlers.push(handler);
    return this;
  }

  /** Called when polling or a handler fails. Without one, errors are printed to stderr. */
  onError(handler: (e: unknown) => void) {
    this.errorHandlers.push(handler);
    return this;
  }

  /**
   * Polls for new messages until `stop()` is called. There are no push events for bots yet.
   * Each message is handled once: it's marked read after your handler runs, even if the handler
   * throws, so one bad message can't loop forever. Keep `pollMs` at 3000 or more; a bot may make
   * 60 requests a minute by default.
   */
  async start(opts: { pollMs?: number } = {}) {
    const base = Math.max(1000, opts.pollMs ?? 4000);
    if (this.running) return;
    this.running = true;
    const me = this.meCache ?? (await this.me());
    let delay = base;
    while (this.running) {
      try {
        await this.tick(me);
        delay = base;
      } catch (e) {
        this.fail(e);
        const code = e instanceof ZendBotError ? e.code : "";
        if (code === "INVALID_API_KEY" || code === "BOT_SUSPENDED") {
          this.running = false;
          break;
        }
        delay = Math.min(delay * 2, 30_000);
      }
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, delay);
        this.wake = () => {
          clearTimeout(t);
          resolve();
        };
      });
    }
  }

  stop() {
    this.running = false;
    this.wake?.();
  }

  private fail(e: unknown) {
    if (this.errorHandlers.length === 0) console.error("[zend bot]", e instanceof Error ? e.message : e);
    for (const h of this.errorHandlers) h(e);
  }

  private async tick(me: BotProfile) {
    const { threads } = await this.chats();
    for (const t of threads) {
      const unread = Number(t.unread_count ?? 0);
      if (unread <= 0 || !this.running) continue;
      const roomId = t.room_id as string;
      const { messages } = await this.messages(roomId, { limit: Math.min(50, unread + 5) });
      // Newest first from the server. Take the unread ones from other people, oldest first.
      const mine = messages.filter((m) => m.sender_user_id !== me.id);
      const fresh = mine.slice(0, unread).reverse().filter((m) => !this.seen.has(m.id));
      for (const m of fresh) {
        this.remember(m.id);
        if (m.message_type !== "text" || m.deleted_at || typeof m.content !== "string") continue;
        const msg: BotMessage = {
          id: m.id,
          roomId,
          from: { userId: m.sender_user_id, handle: m.sender_zendtag },
          text: m.content,
          createdAt: m.created_at,
        };
        const ctx: BotContext = {
          reply: async (text) => {
            await this.send(roomId, text, `reply:${m.id}`);
          },
          pay: (p) => this.pay({ to: p.to ?? msg.from.handle, amount: p.amount, note: p.note }),
        };
        for (const h of this.handlers) {
          try {
            await h(msg, ctx);
          } catch (e) {
            this.fail(e);
          }
        }
      }
      const newest = messages[0];
      if (newest) await this.markRead(roomId, newest.id).catch((e) => this.fail(e));
    }
  }

  private remember(id: string) {
    this.seen.add(id);
    if (this.seen.size > SEEN_LIMIT) this.seen.delete(this.seen.values().next().value as string);
  }
}
