# Pay-to-read (`zend.unlock`)

Sell articles, chapters, guides or files. People pay once and get a receipt in the same payment;
your server checks the receipt and serves the content. Receipts live on Sui, so whoever holds one
can read, including a friend it was given to. Zend never holds or sees your content.

Needs the `unlock` permission in your manifest.

## How it works

1. **Your server lists the item.** Zend puts a listing on Sui with the price and who gets paid
   (up to 4 people, for example the writer and your app).
2. **A person buys it in your page** with `zend.unlock.buy`. Zend shows the price and every
   payee; one payment pays each of them and gives the person a receipt, in the same transaction.
   Either both happen or neither does.
3. **Your server serves the content.** The page asks your server for it with the person's
   `appSession`; your server calls `requireAccess` and only sends it to receipt holders.

## 1. List an item (server)

```ts
import { ZendServer } from "@zendfi/appkit/server";
const zend = new ZendServer(process.env.ZEND_APP_KEY!);

const listing = await zend.createListing({
  item: "issue-42",                  // your id: 1-64 of a-z A-Z 0-9 - _ . :
  title: "The Lagos Dispatch, issue 42",
  price: { ngn: 500 },               // or amount_usd
  to: "@ada",                        // the writer gets what the splits leave
  splits: [{ to: "app", percent: 10 }], // your payout account
});
```

A `202` with `status: "pending"` means Sui is still confirming it: send the same request again.
Change it later with `updateListing(item, { active: false })` (pause), or a new price and payees
(`to`, price and `splits` together). People who already bought keep their receipts.

## 2. Serve the content (server)

Keep the content anywhere private (your database, a private bucket) and serve it after checking:

```ts
app.get("/content/:item", async (req, res) => {
  try {
    await zend.requireAccess(req.header("x-zend-session")!, req.params.item);
    res.send(await loadArticle(req.params.item));
  } catch (e: any) {
    res.status(e.status ?? 500).json({ error: e.code });
  }
});
```

`requireAccess(appSession, item)` verifies who's asking and checks they hold a receipt now; it
throws `NO_ACCESS` (status 403) otherwise. `appSession` lasts 10 minutes, so if you already sign
people in on your server, use `zend.hasAccess(item, appUserId)` per item instead. A purchase made
through Zend in the last few minutes counts straight away.

## 3. Sell it (page)

```ts
const zend = init();
const item = await zend.unlock.get("issue-42");   // { unlocked, price: { ngn, usd }, ... }
if (!item.unlocked) await zend.unlock.buy({ item: "issue-42" });

const { appSession } = await zend.identity.get();  // fresh each time
const r = await fetch("/content/issue-42", { headers: { "x-zend-session": appSession } });
article.innerHTML = sanitize(await r.text());
```

Gifts:

```ts
const [friend] = await zend.people.pick({ max: 1, title: "Give it to" });
await zend.unlock.buy({ item: "issue-42", for: friend.pick });  // buy one for them
await zend.unlock.gift({ item: "issue-42", to: friend.pick });  // or give yours away
```

## Errors

| Code | Meaning |
|---|---|
| `NOT_FOR_SALE` | The listing is paused |
| `ALREADY_UNLOCKED` | They (or the friend) already have it |
| `OWN_ITEM` | The buyer is one of the payees |
| `NOT_UNLOCKED` / `NO_ACCESS` | No receipt for this item |
| `APP_LIMIT_AMOUNT`, `APP_LIMIT_DAILY` | Your tier's payment limits |
| `SAFETY_STOP` | Zend refused to sign what was prepared; nothing moved |

## Webhooks

`unlock.listed`, `unlock.bought` (`by`, `for`, `amount_usd`, `receipt_id`), `unlock.gifted`
(`from`, `to`). A purchase also sends `payment.completed` with each part.

## Costs

The buyer pays the price and nothing else. Network costs come out of your app's monthly network budget
(`zend apps info`): listing an item about 0.004 SUI, each purchase or gift about 0.002 SUI.
Checking access costs nothing.

## Checking it yourself

Everything is on Sui: the listing (`verify.listing`) shows the price and payees, the package
(`verify.package`) is public, and each receipt is an object owned by whoever holds it.

## Encrypted content (coming later)

Zend will also be able to open [Seal](https://seal-docs.wal.app)-encrypted content on the
person's device, so content can be stored encrypted anywhere. `zend.unlock.read`, `UNLOCK_SEAL`
and `unlockIdentity` are for that; until it's on, `unlock.read` fails with `UNLOCK_UNAVAILABLE`.
