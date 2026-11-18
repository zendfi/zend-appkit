# Bot SDK (`@zendfi/appkit/bot`)

`@zendfi/appkit/bot` runs a bot account from your code. It's a third entry point in the same package as the client and server SDKs, so there's nothing extra to install. Node 18 or later.

```bash
npm install @zendfi/appkit
```

Make the bot first with `zend bot create`. That saves its keys in `~/.zend/bots/<handle>.json`, which the SDK reads.

```ts
import { ZendBot } from "@zendfi/appkit/bot";

const bot = await ZendBot.fromFile("matchbot");

bot.onMessage(async (msg, ctx) => {
  if (msg.text.toLowerCase() === "hi") await ctx.reply("Hey! I'm a bot.");
});

await bot.start(); // polls until bot.stop()
```

## Create the client

```ts
const bot = await ZendBot.fromFile("matchbot");                 // reads ~/.zend/bots/matchbot.json
const bot = new ZendBot({ apiKey, privateKey });                // or pass the keys yourself
```

| Option | Notes |
|---|---|
| `apiKey` | The bot's `zbot_live_...` key |
| `privateKey` | The bot's signing key (PKCS#8 DER, base64). Needed only to pay. Zend never sees it |
| `baseUrl` | Defaults to `https://api.usezend.app` |
| `fetch` | Your own `fetch`, for tests |

Keep both keys on your server. Don't ship them to a browser.

## Listen and reply

```ts
bot.onMessage(async (msg, ctx) => {
  // msg: { id, roomId, from: { userId, handle }, text, createdAt }
  await ctx.reply(`You said: ${msg.text}`);
  await ctx.pay({ amount: 0.25, note: "Thanks" }); // pays msg.from by default
});
bot.onError((e) => console.error(e));
await bot.start({ pollMs: 4000 });
```

- Handlers get new text messages from other people, oldest first. Each message is handled once. It's marked read after your handler runs, even if your handler throws, so one bad message can't loop. Errors go to `onError`.
- There are no push events for bots yet, so `start()` polls. Keep `pollMs` at 3000 or more: a bot can make 60 requests a minute by default. A failed poll backs off up to 30 seconds. `start()` stops by itself on `INVALID_API_KEY` or `BOT_SUSPENDED`.
- A bot only answers people who wrote first, unless the owner turned on first contact.
- `bot.stop()` ends the loop.

## Methods

| Method | Does |
|---|---|
| `me()` | Profile, scopes and limits |
| `rename(name)` | Changes the bot's name |
| `balance()` | `{ spendable, awaiting_deposit, wallet }` |
| `chats()` | The bot's conversations |
| `messages(roomId, { limit, cursor })` | Messages in a chat, newest first |
| `openChat(handle)` | Opens a chat and returns its `room_id` |
| `send(roomId, text, clientId?)` | Sends text. The same `clientId` never sends twice |
| `say(handle, text, clientId?)` | Opens the chat and sends |
| `markRead(roomId, messageId)` | Marks read |
| `post(text, clientId?)` | Posts to the feed. Returns `{ id }` |
| `deletePost(id)` | Removes a post |
| `pay({ to, amount, note? })` | Pays `@to` within the owner's limits |
| `deposit()` | Makes received money spendable |

## Pay

`pay()` asks Zend to build the payment, signs the exact bytes locally, and submits them. The owner's limits are checked before and after. Errors are `ZendBotError` with a `code` and `status`:

```ts
import { ZendBotError } from "@zendfi/appkit/bot";

try {
  await bot.pay({ to: "ada", amount: 2 });
} catch (e) {
  if (e instanceof ZendBotError && e.code === "OVER_DAILY_LIMIT") { /* tell the person plainly */ }
}
```

See The bot accounts page in the Zend developer docs for every code. `NETWORK` means the call never reached Zend. Reads retry on their own; a payment that fails with `NETWORK` may or may not have gone through, so check `balance()` before sending it again.

## Build a bot with a language model

`examples/bots/assistant.mjs` in the package connects the loop to any chat-completions API. The model replies and may ask to pay someone. Your code decides whether to allow it:

- Only the owner's messages can trigger a payment.
- Payments above a cap you choose are refused in your code, before they reach Zend.
- The owner's limits in Zend still apply to whatever your code sends.

Treat everything people write as untrusted text. Don't let a message from a stranger move money, however the model reads it.

`examples/bots/pulse.mjs` is the same loop with plain commands (`help`, `balance`, `tip @name 0.25`, `post <text>`), no model needed.
