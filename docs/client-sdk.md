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

Returns `{ appUserId, username, name, avatar, scopes, appSession }`. Older Zend apps leave
out `avatar`.
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

## people.connect({ appUserId, interactionId, note? })
Adds someone the user was in an interaction with. Needs the `connect` permission.
- Their first add starts a Zend chat between the two people, beginning with "Ada added Ben on
  {App}." and your `note`. Zend also notifies Ben.
- When Ben adds Ada back, the call returns `status: "friends"` and the chat says so. Otherwise it
  returns `"added"`. Calling it again for the same pair changes nothing.
- There's no confirm sheet, so call it only from the user's own tap. Zend shows "Added {name}."
  with a **Chat** button after each add.
- Rules:
  - The interaction must be yours, created in the last 7 days, with both people in it.
  - A user can add 30 people per hour.
  - `note` is optional: up to 80 characters, plain words, no links.
- Errors: `NOT_A_PARTICIPANT`, `PERSON_NOT_FOUND`, `CANNOT_ADD_YOURSELF`, `BLOCKED`,
  `INVALID_NOTE`, `CONNECT_LIMIT`.
- Your server gets a `people.connected` webhook.

```js
const { status } = await zend.people.connect({
  appUserId: ada.appUserId, interactionId: round.id, note: "Met in Room KQ7M2D",
});
```

## people.chat({ appUserId })
Opens Zend's chat with this person on top of your app. It resolves `{ opened: true }` when they
close it. Needs `connect` and an existing chat (`NO_CHAT`), for example after `people.connect`.
Your page never sees chat or user ids.

## share({ text, url? })
Opens the phone's share sheet. `text` is 1–280 characters. `url` must be on your origins, or your
`https://app.usezend.app/apps/<slug>` link, or an `/i/<id>` link.
- Use the first for room links: `https://app.usezend.app/apps/<slug>?room=KQ7M2D`. Zend passes
  params like `room` to your entry page after sign-in. The rules for those params:
  - up to 8 of them;
  - keys must match `[a-z][a-z0-9_]{0,31}`;
  - values are at most 256 characters;
  - `interaction`, `start` and `from` are dropped.
- Resolves `{ status }`: `"shared"`, `"dismissed"`, or `"copied"` when the device has no share sheet
  and Zend copied the link instead.

## close(result?)

Closes the sheet. `result` is returned to whatever opened it inside Zend.
