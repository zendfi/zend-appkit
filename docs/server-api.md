# Server API

Two kinds of auth:
- **User token** (`Authorization: Bearer <zend session>`): app setup endpoints, called as you.
- **App API key** (`Authorization: Bearer zapp_sk_...`): your backend. Never send it to browsers.

Errors are `{ "error": CODE, "message": "..." }` (see [errors.md](errors.md)).

## App setup (user token)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/apps` | `{ slug, name }` | Returns `api_key` and `webhook_secret` **once**. Max 10 apps per account. `icon_url` is refused (`ICON_URL_NOT_ACCEPTED`) |
| PUT | `/apps/:id/icon` | the image | See the App icon section in [manifest.md](manifest.md) |
| GET | `/apps` | | Your apps |
| PUT | `/apps/:id/manifest` | manifest JSON | New version; `public` → `in_review` |
| POST | `/apps/:id/testers` | `{ zendtag }` | Owner is always a tester |

Slug: 2–31 chars, `a-z 0-9 -`. Lose your API key? Create a new app for now; key rotation is coming.

## Your backend (API key)

### POST `/apps/token/verify`
`{ "app_session": "..." }` →
```json
{ "app_user_id": "zu_...", "username": "tunde", "name": "Tunde", "avatar": null,
  "human_verified": true, "scopes": ["profile", "email"], "email": "t@example.com", "address": "0x..." }
```
`email` / `address` only when granted. Fails with `INVALID_APP_SESSION` (expired, or issued to
another app) or `GRANT_REVOKED`.

### POST `/apps/server/interactions`
`{ type, created_by, participants?, data?, visibility?, expires_in_secs? }`. `created_by` is
`@username` or `zu_...` and must have connected your app.

### GET / PATCH `/apps/server/interactions/:id`
PATCH body: `{ state, data?, idempotency_key, expected_version? }`.

### GET `/apps/server/events`
Last 100 webhook events with `delivered_at`, for catching up after downtime.

### POST `/apps/server/people/blocked`
Body: `{ app_user_ids }` (2–50). Returns `{ pairs: [[a, b], …] }`: the pairs among them where one
person blocked the other in Zend. Use it in matchmaking so those two never share a room.
- Each pair is sorted, so you can't tell who blocked whom.
- People who haven't connected your app are ignored.

## Node helper

```ts
import { ZendServer, verifyWebhook } from "@zend/appkit/server";
const zend = new ZendServer(process.env.ZEND_APP_KEY!, "https://api.usezend.app");
await zend.verifySession(token);
await zend.createInteraction({ type: "challenge", created_by: "@tunde", participants: ["@danny"] });
await zend.updateInteraction(id, { state: "resolved", idempotency_key: "g1:end" });
const { pairs } = await zend.blockedPairs(["zu_…", "zu_…", "zu_…"]);
```

## Endpoints the Zend client uses (for reference)

`GET /apps/by-slug/:slug`, `GET …/session`, `POST …/connect`, `DELETE …/grant`, `POST …/mute`,
`POST …/pay-check`, `POST …/pay-report`, `POST /apps/interactions`, `GET|PATCH /apps/interactions/:id`,
`POST /apps/cards`, `GET /apps/cards/:id`, `GET /apps/feed`, `GET /me/connected-apps`.
You don't call these directly; the SDK reaches them through Zend.
