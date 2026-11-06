# @zend/appkit

Build ZApps: web apps that open inside Zend and use Zend sign-in, payments, money links,
interactions, and chat/feed cards. Zend draws every money screen and every card, so your app
never handles keys, balances, or payment UI.

## 1. Register your app

All calls use your Zend session token (`Authorization: Bearer <user token>`).

```bash
# Create (returns api_key and webhook_secret ONCE — store them)
curl -X POST $ZEND/api/zend/v2/apps -H "Authorization: Bearer $TOKEN" \
  -d '{"slug":"accident","name":"Accident"}'

# Upload a manifest (new version each time; private apps go live immediately)
curl -X PUT $ZEND/api/zend/v2/apps/$APP_ID/manifest -H "Authorization: Bearer $TOKEN" \
  -d @manifest.json

# Let friends test it
curl -X POST $ZEND/api/zend/v2/apps/$APP_ID/testers -H "Authorization: Bearer $TOKEN" \
  -d '{"zendtag":"danny"}'
```

Share `https://app.usezend.app/apps/<slug>` to open your app inside Zend.

## 2. Manifest

```json
{
  "app": "accident",
  "name": "Accident",
  "version": "1.0.0",
  "origins": ["https://accident.example.com"],
  "entry": "/",
  "visibility": "private",
  "permissions": ["post_card", "pay", "request_payment", "create_link"],
  "chatActions": [{ "id": "challenge", "label": "Challenge", "sheet": "/play", "interaction": "challenge" }],
  "cardTypes": ["result", "invite"],
  "interactionTypes": {
    "challenge": {
      "states": ["sent", "accepted", "resolved", "expired"],
      "initial": "sent",
      "transitions": { "sent": ["accepted", "expired"], "accepted": ["resolved", "expired"] },
      "terminal": ["resolved", "expired"]
    }
  },
  "custody": "contract",
  "webhook": "https://accident.example.com/zend/webhook"
}
```

Rules Zend enforces:
- `origins` must be HTTPS with no path, and not on `usezend.app`. Pages outside them open in the browser, not in Zend.
- Labels and card text must be plain language. Words like *crypto, token, wallet, USDC, gas, escrow* are rejected: your users shouldn't need to know how money moves.
- Public apps need `custody: "contract"` and go through review. Private apps aren't reviewed and always show **"Made by {you}. Not checked by Zend."**
- Permissions: `post_card`, `update_bubble`, `pay`, `request_payment`, `create_link`, `email`, `wallet_address`, `contacts`. Users approve `email`, `wallet_address` and `contacts` individually.
- A transition can be reserved for your server: write `{ "to": "resolved", "serverOnly": true }` instead of `"resolved"`. Zend then refuses that move from a page (error `TRANSITION_SERVER_ONLY`) and accepts it only through the server API with your app key. Use it for anything a player could fake by editing the page, such as declaring a winner.

## 3. In your page

```ts
import { init } from "@zend/appkit";
const zend = init();

const me = await zend.identity.get();           // { appUserId, username, name, appSession }
await fetch("/api/login", { method: "POST", body: me.appSession }); // verify on your server

// Opened from a chat action or card? Pick up the interaction.
if (zend.launch.interaction) {
  const game = await zend.interaction.get(zend.launch.interaction);
}

// Money: each call opens Zend's own confirm sheet.
await zend.pay({ to: "@danny", amount: 1, note: "Lost the rematch", reference: "game_42" });
await zend.pay({ to: "@ada", price: { ngn: 2000 }, reference: "article_7" }); // priced in Naira
// Your server hears `payment.completed` (with price_ngn and the rate) even if the user closes the
// app right after paying. Look payments up by reference: GET /api/zend/v2/apps/server/payments?reference=article_7
const ask = await zend.request({ amount: 2, note: "Tournament entry", maxPayments: 8 });
await zend.createLink({ amount: 5, uses: 3, note: "Prize", reference: "t_9" }); // Zend shares it

// Split one payment: Ada gets ₦1,800 and your app ₦200, in one go. Set your app's account first:
// zend apps payout <slug> <username>
await zend.pay({ to: "@ada", price: { ngn: 2000 }, splits: [{ to: "app", percent: 10 }], reference: "article_7" });

// `price: { ngn }` works on every money call. An ask link priced in Naira asks for that many
// Naira whenever someone pays it; links and prizes are converted when they're made.
await zend.request({ price: { ngn: 1500 }, note: "Your share of lunch" });
await zend.createLink({ price: { ngn: 500 }, uses: 10 });

// Let the user pick friends with Zend's own picker. You only see who they chose.
const [friend] = await zend.people.pick({ title: "Who do you want to play?" });
const game = await zend.interaction.create({ type: "challenge", participants: [friend.pick] });

// A live room for everyone in the interaction: no realtime server of your own.
const room = await zend.live.join(game.id);
room.on("presence", (members) => showWhoIsHere(members));
room.on("message", ({ from, data }) => applyMove(from, data)); // `from` is set by Zend
await room.send({ move: "A3" }); // up to 8 KB, 20 a second

// Move the interaction along (only along your manifest's transitions).
await zend.interaction.update(id, { state: "resolved", data: { winner: "tunde" }, idempotencyKey: "game_42_end" });

// Drop a card into the chat or feed. Zend draws it and shows live status.
await zend.postCard({
  interactionId: id, template: "result", placement: "chat", idempotencyKey: "game_42_card",
  slots: { title: "Tunde beat Danny at Accident", emoji: "😂",
           buttons: [{ label: "Challenge again", action: "start_interaction", type: "challenge" }] },
});

await zend.close({ done: true });
```

`zend.environment` is `"zend-app"`, `"zend-web"`, or `"external"` (plain browser: Zend calls reject with `NOT_IN_ZEND`).

## 4. On your server

```ts
import { ZendServer, verifyWebhook } from "@zend/appkit/server";
const zend = new ZendServer(process.env.ZEND_APP_KEY!);

const user = await zend.verifySession(appSession);       // trusted identity
await zend.updateInteraction(id, { state: "resolved", data: { winner }, idempotency_key: gameId });

app.post("/zend/webhook", express.text({ type: "*/*" }), (req, res) => {
  if (!verifyWebhook(req.body, req.header("x-zend-signature")!, process.env.ZEND_WEBHOOK_SECRET!)) return res.sendStatus(401);
  const event = JSON.parse(req.body);   // interaction.created | interaction.updated | payment.completed | link.claimed
  res.sendStatus(200);
});
```

**Never treat a resolved `pay()` in the browser as proof of payment.** Use `payment.completed`
webhooks (they carry your `reference`). Missed one? `GET /api/zend/v2/apps/server/events`.

Deliveries retry with backoff for about a day and are idempotent by `x-zend-event-id`.

## Limits

Every app has a tier (`private`, `public`, `growth`) capping cards per user per day, payment size,
daily spend per user, links per day, and link size. Calls over a limit fail with codes like
`APP_LIMIT_AMOUNT` / `APP_LIMIT_DAILY` / `CARD_LIMIT`. Ask Zend for a higher tier.

## Errors

Every call rejects with `ZendError { code, message }`. Common codes: `USER_CANCELLED`,
`PERMISSION_DENIED`, `NOT_CONNECTED`, `INVALID_TRANSITION`, `VERSION_CONFLICT`, `BUSY`,
`APP_SUSPENDED`. Show your own copy; `message` is for logs.
