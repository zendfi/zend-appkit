# Interactions

An interaction is Zend's record of a shared activity. Shape:

```json
{
  "id": "int_ab12cd34ef56", "app": "accident", "type": "challenge",
  "participants": [{ "app_user_id": "zu_...", "username": "tunde", "name": "Tunde", "avatar": null }],
  "state": "accepted", "data": { "round": 2 }, "visibility": "participants",
  "money_ref": null, "chat_message_id": null, "version": 3,
  "expires_at": "...", "created_at": "...", "updated_at": "...",
  "url": "https://app.usezend.app/i/int_ab12cd34ef56"
}
```

## Updating

```ts
await zend.interaction.update(id, {
  state: "resolved", data: { winner: "tunde" },
  idempotencyKey: `${id}:resolve`, expectedVersion: 3,
});
```
- `state` must be the current state or one allowed by your manifest's `transitions`.
- `data` is shallow-merged; total ≤ 4 KB.
- `idempotencyKey` (required, ≤ 100 chars): repeating a key returns the current interaction and
  changes nothing. Use one key per logical action.
- `expectedVersion` (optional): fails with `VERSION_CONFLICT` if someone else updated first.
- Terminal interactions can't change (`INTERACTION_FINISHED`).

Who can update: participants (from the client) and your server (API key). Your server can only
touch your app's interactions. For games with money, let your **server** set results, not the
browser.

## Expiry

At `expires_at`, Zend moves unfinished interactions to `expired` if your type declares it.
Otherwise the deadline is cleared and nothing happens. After the deadline, the only allowed
update is to `expired`.

## Visibility

| Value | Who can read it and see its cards |
|---|---|
| `participants` | Participants |
| `friends` | Participants and anyone with a mutual connection to a participant |
| `public` | Any signed-in user (public apps only) |

## Real-time

Every change sends an `app_interaction` event to all participants' Zend clients, so cards redraw.
Your server gets `interaction.created` / `interaction.updated` webhooks.

## Links

`https://app.usezend.app/i/<id>` opens your app on `/?interaction=<id>` for anyone allowed to
see it, after sign-in if needed.
