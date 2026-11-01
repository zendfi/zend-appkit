# Client SDK (`@zend/appkit`)

```ts
import { init, ZendError } from "@zend/appkit";
const zend = init();
```

Every method returns a promise and rejects with `ZendError { code, message }`. Calls time out
after 10 minutes (money sheets can stay open while the user decides).

## zend.environment

`"zend-app"` (mobile WebView), `"zend-web"` (iframe in app.usezend.app), or `"external"` (plain
browser). In `external`, every call rejects with `NOT_IN_ZEND`; show a "Open in Zend" link to
`https://app.usezend.app/apps/<slug>`.

## zend.launch

`{ interaction: string | null, start: string | null }`, read from the URL once.
- `interaction`: opened from a chat action, a card button, or an `/i/<id>` link.
- `start`: a card's `start_interaction` button asked you to start this type.

## identity.get()

Returns `{ appUserId, username, name, scopes, appSession }`.
- `appUserId` (`zu_...`) is stable across apps and username changes. Use it as your user key.
- `username` is `null` until the user picks one.
- Send `appSession` to your server and call `verifySession` (see [server-api.md](server-api.md)).

## pay({ to, amount, note?, reference? })

Sends money to a Zend user. `to` must be `@username`. `amount` in USD, 0.01–10,000.
Needs `pay`. Zend checks your limits, shows its confirm sheet, sends, and records the payment.
Returns `{ paymentId, status }`. Confirm on your server with the `payment.completed` webhook.

## request({ amount?, note?, maxPayments?, reference? })

Creates an ask link others can pay. Omit `amount` to let payers choose. Needs `request_payment`.
Returns `{ id, url }`; you may share `url` yourself.

## createLink({ amount, uses?, note?, reference? })

Creates a money link anyone holding it can collect. `amount` is per person, minimum 1; `uses`
1–100. Needs `create_link`. Zend opens the share sheet itself; you only get `{ id, status }`.
You'll get `link.claimed` each time someone collects.

## interaction.create({ type, participants?, data?, visibility?, expiresInSecs? })

- `participants`: `@username` or `zu_...`; the current user is always added. Max 50.
- `data`: your JSON, ≤ 4 KB. `visibility`: `participants` (default), `friends`, `public`.
- `expiresInSecs`: 60 s – 90 days, default 7 days.

## interaction.get(id) / interaction.update(id, { state, data?, idempotencyKey, expectedVersion? })

See [interactions.md](interactions.md).

## postCard({ interactionId, template, placement, idempotencyKey, slots })

See [cards.md](cards.md). Needs `post_card` and the user's posting consent.

## close(result?)

Closes the sheet. `result` is returned to whatever opened it inside Zend.
