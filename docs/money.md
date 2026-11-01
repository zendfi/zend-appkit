# Money

Your app never touches balances, keys or payment screens. It asks; Zend shows its own confirm
sheet with your app name, the amount, the recipient, and where the money goes; the user decides.

## Three actions

| | `pay` | `request` | `createLink` |
|---|---|---|---|
| Direction | User → a Zend user | Anyone → the user | User → whoever opens the link |
| Recipient needs Zend? | Yes | Payers sign in | No, they sign in to collect |
| You receive | `paymentId` | `id`, `url` | `id` only (Zend shares it) |
| Webhook | `payment.completed` | `payment.completed` per payer | `link.claimed` per collector |
| Minimum | $0.01 | $0.01 | $1 per person |

Amounts are USD today; Zend shows users Naira once a rate source is live.

## reference

Pass `reference` (≤ 64 chars), for example your order or game ID. It comes back on every webhook
for that money action. For money links it's also stored with the link on-chain.

## Limits by tier

| Limit | private | public | growth |
|---|---|---|---|
| Payment size | $5 | $50 | $100 |
| Sent through your app per user per day | $20 | $200 | $500 |
| Money links per day (whole app) | 20 | 500 | 5,000 |
| Money per link (all uses) | $5 | $50 | $100 |
| People per link | 5 | 50 | 100 |
| Cards per user per day | 20 | 50 | 100 |

Zend-wide limits also apply (for example a $100 cap per money link while the contract is
unaudited). Limit errors: `APP_LIMIT_AMOUNT`, `APP_LIMIT_DAILY`, `APP_LIMIT_USES`.

## Money links behave like cash

Anyone holding the link can collect it. The sender can take back whatever isn't collected from
My Links, and unclaimed money returns to them automatically at expiry (7 days by default).
For "one per person" prizes, make one single-use link per person.

## Verifying payments

1. Your page calls `pay`, `request` or `createLink`.
2. Zend records the payment from its own records (for `pay`, it checks payer, recipient and
   amount against what your app asked for).
3. Zend sends a signed webhook to your server.
4. Your server credits the order or game **on the webhook**, not on the browser promise.

## Prizes and stakes

Player-paid entry fees and stakes are off by platform policy until legal review. Host-funded
prizes work today: the host uses `createLink` with `uses` = number of winners, or `pay` to each
winner from your server's result.
