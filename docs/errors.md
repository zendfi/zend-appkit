# Error codes

`message` is for your logs. Show your own copy to users.

| Code | Where | Meaning / what to do |
|---|---|---|
| `NOT_IN_ZEND` | SDK | Page opened outside Zend. Link to `app.usezend.app/apps/<slug>` |
| `TIMEOUT` | SDK | No reply in 10 min |
| `USER_CANCELLED` | money | User tapped Cancel. Not an error to report |
| `BUSY` | money | Another money sheet is open. Wait for it |
| `PERMISSION_DENIED` | SDK | Manifest lacks the permission |
| `INVALID_PARAMS` / `INVALID_AMOUNT` | SDK | Fix your call |
| `UNKNOWN_METHOD` | SDK | Zend version too old for this call |
| `NOT_CONNECTED` | any | User hasn't continued to your app (or disconnected) |
| `APP_NOT_FOUND` / `NO_MANIFEST` | any | Wrong slug, or no manifest uploaded |
| `APP_SUSPENDED` | any | Zend suspended your app |
| `APP_LIMIT_AMOUNT` / `APP_LIMIT_DAILY` / `APP_LIMIT_USES` | money | Over your tier |
| `BELOW_MINIMUM` / `ABOVE_LINK_MAXIMUM` / `LINKS_AT_CAPACITY` | links | Zend-wide link limits |
| `UNKNOWN_INTERACTION_TYPE` | interactions | Type not in manifest |
| `INVALID_TRANSITION` | interactions | Not allowed by your state machine |
| `INTERACTION_FINISHED` / `INTERACTION_EXPIRED` | interactions | Start a new one |
| `VERSION_CONFLICT` | interactions | Re-read and retry |
| `IDEMPOTENCY_KEY_REQUIRED` | interactions, cards | Add one |
| `DATA_TOO_LARGE` | interactions | Keep `data` ≤ 4 KB |
| `NOT_A_PARTICIPANT` / `WRONG_APP` | interactions, cards | Caller can't touch this |
| `VISIBILITY_NOT_ALLOWED` | interactions | `public` needs a public app |
| `TEMPLATE_NOT_DECLARED` / `INVALID_SLOTS` | cards | Fix manifest or slots (see `errors[]`) |
| `POSTING_NOT_ALLOWED` / `APP_MUTED` | cards | User didn't allow posting, or muted you |
| `CARD_LIMIT` | cards | Daily cap reached |
| `CHAT_NEEDS_TWO` / `NOTHING_TO_SHOW` | cards | Placement doesn't fit the interaction |
| `INVALID_MANIFEST` | setup | See `errors[]` |
| `SLUG_TAKEN` / `INVALID_APP` / `APP_LIMIT` | setup | Pick another slug / fix fields / 10-app max |
| `INVALID_API_KEY` | server | Wrong or missing `zapp_sk_` key |
| `INVALID_APP_SESSION` / `GRANT_REVOKED` | server | Ask the page for a fresh `appSession` |
| `APPKIT_UNAVAILABLE` | any | Zend-side outage; retry later |
