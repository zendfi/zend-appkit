# ZendAppKit documentation

ZendAppKit lets you build **ZApps**: web apps that open inside Zend (mobile app and
app.usezend.app) and use Zend sign-in, payments, money links, interactions, and chat/feed cards.

| Doc | What it covers |
|---|---|
| [concepts.md](concepts.md) | How ZApps work, who owns what, trust model |
| [manifest.md](manifest.md) | Every manifest field and validation rule |
| [client-sdk.md](client-sdk.md) | `@zend/appkit` browser API, method by method |
| [interactions.md](interactions.md) | State machines, updates, idempotency, visibility |
| [cards.md](cards.md) | Templates, slots, buttons, chat vs feed, posting rules |
| [money.md](money.md) | pay, request, money links, limits, verifying payments |
| [server-api.md](server-api.md) | REST endpoints for your backend and for app setup |
| [webhooks.md](webhooks.md) | Events, payloads, signatures, retries |
| [errors.md](errors.md) | Every error code and what to do |
| [public-apps.md](public-apps.md) | Listing, review, ownership proof, `zend.attest` |
| [prizes.md](prizes.md) | Host-funded prizes, resolving results, disputes |
| [copy-guide.md](copy-guide.md) | Plain-language rules for anything users see |

Quickstart: [../README.md](../README.md). Example app: [../examples/coinflip](../examples/coinflip).

Base URL in examples: `$ZEND` = `https://api.usezend.app`. All API paths are under `/api/zend/v2`.
