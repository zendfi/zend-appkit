# Pay-to-read (`zend.unlock`)

Sell articles, chapters, guides or files. People pay once and Zend opens the content on their
device. The content is encrypted with [Seal](https://seal-docs.wal.app): only someone holding a
receipt for the item can open it. Your server can't open it for them, and neither can Zend.

Needs the `unlock` permission in your manifest.

## How it works

1. **Your server lists the item.** Zend puts a listing on Sui with the price and who gets paid
   (up to 4 people, for example the writer and your app). Zend's keeper holds the listing's
   change key and only uses it when your server asks.
2. **Your server encrypts the content** for that listing and stores it anywhere: Walrus, your
   CDN, your database. The encrypted bytes are safe to make public.
3. **A person buys it in your page** with `zend.unlock.buy`. Zend shows the price and every
   payee; one payment pays each of them and gives the person a receipt, in the same transaction.
   Either both happen or neither does.
4. **Your page fetches the encrypted bytes** and calls `zend.unlock.read`. Zend checks the
   receipt and opens the content on the device. Your page gets the plaintext; it never sees
   keys or receipts.

Receipts can be given away (`zend.unlock.gift`) or bought for a friend (`for`). Whoever holds
the receipt can read; the giver loses access.

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
// listing.listing_id: encrypt for this
```

A `202` with `status: "pending"` means Sui is still confirming it: send the same request again.
Change it later with `updateListing(item, { active: false })` (pause), or a new price and payees
(`to`, price and `splits` together). People who already bought keep their receipts.

## 2. Encrypt the content (server)

Use the Seal SDK (`npm i @mysten/seal @mysten/sui`) with Zend's settings:

```ts
import { SealClient } from "@mysten/seal";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { UNLOCK_SEAL, unlockIdentity } from "@zendfi/appkit/server";

const seal = new SealClient({
  suiClient: new SuiGrpcClient({ network: "mainnet", baseUrl: "https://fullnode.mainnet.sui.io:443" }),
  serverConfigs: [{ objectId: UNLOCK_SEAL.committee, weight: 1, aggregatorUrl: UNLOCK_SEAL.aggregatorUrl }],
});
const { encryptedObject } = await seal.encrypt({
  threshold: 1,
  packageId: UNLOCK_SEAL.packageId,
  id: unlockIdentity(listing.listing_id, "full-text"), // suffix: several pieces per listing
  data: new TextEncoder().encode(articleHtml),
});
await storage.put(`issue-42/full-text.bin`, encryptedObject); // public is fine
```

Encrypting needs no API key. Keep a plaintext copy yourself: neither Seal nor Zend can recover it.

## 3. Sell and read (page)

```ts
const zend = init();
const item = await zend.unlock.get("issue-42");   // { unlocked, price: { ngn, usd }, ... }

if (!item.unlocked) await zend.unlock.buy({ item: "issue-42" });

const data = await (await fetch("https://cdn.example.com/issue-42/full-text.bin")).arrayBuffer();
const { text } = await zend.unlock.read({ item: "issue-42", data });
article.innerHTML = sanitize(text!);
```

Gifts:

```ts
const [friend] = await zend.people.pick({ max: 1, title: "Give it to" });
await zend.unlock.buy({ item: "issue-42", for: friend.pick });  // buy one for them
await zend.unlock.gift({ item: "issue-42", to: friend.pick });  // or give yours away
```

Ask your server whether someone has it: `zend.hasAccess("issue-42", appUserId)`.

## Errors

| Code | Meaning |
|---|---|
| `NOT_FOR_SALE` | The listing is paused |
| `ALREADY_UNLOCKED` | They (or the friend) already have it |
| `OWN_ITEM` | The buyer is one of the payees |
| `NOT_UNLOCKED` / `NO_ACCESS` | No receipt for this item |
| `WRONG_ITEM` | The bytes were encrypted for a different listing |
| `UNLOCK_UNAVAILABLE` | Opening content isn't available right now; try later |
| `APP_LIMIT_AMOUNT`, `APP_LIMIT_DAILY` | Your tier's payment limits |
| `SAFETY_STOP` | Zend refused to sign what was prepared; nothing moved |

## Webhooks

`unlock.listed`, `unlock.bought` (`by`, `for`, `amount_usd`, `receipt_id`), `unlock.gifted`
(`from`, `to`). A purchase also sends `payment.completed` with each part.

## Costs

The buyer pays the price and nothing else. Network costs come out of your app's monthly network budget
(`zend apps info`): listing an item about 0.004 SUI, each purchase or gift about 0.002 SUI.
Opening content costs nothing on the network.

## Checking it yourself

Everything is on Sui: the listing (`verify.listing`) shows the price and payees, and the package
(`verify.package`) is public. `seal_approve` only releases a key to the holder of a receipt whose
listing id starts the content's identity.
