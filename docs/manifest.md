# Manifest

Upload with `PUT /api/zend/v2/apps/:id/manifest`. Each upload creates a new version and makes it
active. Invalid manifests return `422 INVALID_MANIFEST` with every problem in `errors[]`.
Unknown top-level fields are rejected.

## Fields

| Field | Type | Required | Rules |
|---|---|---|---|
| `app` | string | yes | Must equal your app slug |
| `name` | string | yes | 1–24 chars, plain language |
| `version` | string | yes | Your own version label |
| `origins` | string[] | yes | 1–5 `https://host[:port]`, no path/query, not on `usezend.app` |
| `entry` | string | no (`/`) | Path opened by default |
| `visibility` | `private` \| `public` | no (`private`) | `public` sends the app to review |
| `permissions` | string[] | no | See below |
| `chatActions` | object[] | no | Entries in the chat **Apps** tray |
| `cardTypes` | string[] | no | `result`, `invite`, `status`; needs `post_card` |
| `interactionTypes` | object | no | Map of type name → state machine |
| `custody` | `contract` \| `creator` | no (`contract`) | Public apps must use `contract` |
| `adapters` | string[] | no | Must be empty for now |
| `webhook` | string | no | `https` URL |
| `limits` | object | no | Only `cardsPerUserPerDay`, ≤ your tier |

## Permissions

| Permission | Unlocks | User consent |
|---|---|---|
| `post_card` | `postCard` | "Post to your feed and chats" toggle |
| `update_bubble` | reserved | — |
| `pay` | `pay` | per payment |
| `request_payment` | `request` | per request |
| `create_link` | `createLink` | per link |
| `email` | email in `verifySession` | "See your email" toggle |
| `wallet_address` | address in `verifySession` | "Send money straight to you" toggle |
| `contacts` | reserved | "See people you choose to share" toggle |

Consent toggles start off. Users can change them in Settings → Connected apps.

## chatActions

```json
{ "id": "challenge", "label": "Challenge", "sheet": "/play", "interaction": "challenge" }
```
- `id` unique; `label` 1–24 chars, plain language; `sheet` a path on your first origin.
- `interaction` (optional) must be a key of `interactionTypes`. Zend creates that interaction
  with the chat's other person and opens `sheet?interaction=<id>`.

## interactionTypes

```json
"challenge": {
  "states": ["sent", "accepted", "resolved", "expired"],
  "initial": "sent",
  "transitions": { "sent": ["accepted", "expired"], "accepted": ["resolved", "expired"] },
  "terminal": ["resolved", "expired"]
}
```
- 1–12 unique states; `initial` and every `terminal` must be in `states`.
- Transitions may only reference known states. Terminal states can't have transitions.
- If you declare an `expired` state, Zend moves unfinished interactions there at their deadline.

## Plain-language check

`name`, chat action labels, and card text can't contain: sui, blockchain, chain, crypto, token,
coin, usdc, stablecoin, gas, wallet, escrow, contract, zklogin, seed. See [copy-guide.md](copy-guide.md).
