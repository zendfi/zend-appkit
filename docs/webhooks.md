# Webhooks

Set `webhook` in your manifest. Zend POSTs JSON:

```json
{ "id": "6f1c…", "type": "payment.completed", "created_at": "2026-11-02T10:00:00Z", "data": { … } }
```

Headers: `x-zend-signature: t=<unix>,v1=<hex>` and `x-zend-event-id: <id>`.

## Events

| Type | `data` |
|---|---|
| `interaction.created` | The interaction (see [interactions.md](interactions.md)) |
| `interaction.updated` | The interaction after the change |
| `payment.completed` | `{ payment_id \| ask_link_id, from, to, amount_usd, reference }` |
| `link.claimed` | `{ link_id, by, amount_usd, reference }` |

`from`, `to` and `by` are `appUserId`s (`by` may be null if the collector has never connected
your app).

## Verifying

`v1 = hex(HMAC-SHA256(webhook_secret, "<t>.<raw body>"))`. Use the raw body, before JSON parsing.

```ts
import { verifyWebhook } from "@zend/appkit/server";
app.post("/zend/webhook", express.text({ type: "*/*" }), (req, res) => {
  if (!verifyWebhook(req.body, req.header("x-zend-signature") ?? "", SECRET)) return res.sendStatus(401);
  const e = JSON.parse(req.body);
  // dedupe on e.id, then handle
  res.sendStatus(200);
});
```
`verifyWebhook` rejects signatures older than 5 minutes.

## Delivery

- Any 2xx is success. Anything else, or a 10 s timeout, is retried.
- Retries back off from 30 s, doubling, up to 12 attempts (about a day), then stop.
- Events can arrive more than once and out of order. Dedupe on `id`; use interaction `version`
  to ignore stale updates.
- Missed some? `GET /apps/server/events`.
