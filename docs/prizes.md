# Prizes

Hosts put up a prize; players join for free; your server decides the winners; Zend's prize rules
hold the money until then. Entry fees and stakes aren't available.

## Setup

1. `zend apps resolver-key` → put `resolverKey` in your manifest, keep `ZEND_RESOLVER_SEED` on your server.
2. Add the `prize` permission and `results: "app"` or `"checked"`.

## Lifecycle

```
create (host funds) → join (players, free) → resolve (your server signs)
   → wait (dispute window, ≥ 10 min) → paid
              ↳ correct once (your server)   ↳ host cancels → all back to host
no result by resolveBy → all back to host
```

## In your page

```ts
const prize = await zend.prize.create({
  amount: 20, joinInSecs: 3600, resolveInSecs: 86400, maxPlayers: 32,
  disputeSecs: 3600, reference: "tournament_9", interactionId,
});
await zend.prize.join(prize.id);    // players
await zend.prize.cancel(prize.id);  // host, only during the wait after results
```

## On your server

```ts
const zend = new ZendServer(process.env.ZEND_APP_KEY!);
const p = await zend.getPrize(prizeId);          // p.players: [{ address, app_user_id }]
const first = p.players.find((x) => x.app_user_id === winnerId).address;
await zend.resolvePrize(prizeId, [first], [20], process.env.ZEND_RESOLVER_SEED!);
// Made a mistake? Once, during the wait:
await zend.resolvePrize(prizeId, [other], [20], process.env.ZEND_RESOLVER_SEED!, true);
```

Rules (checked by Zend and by the prize contract): winners must have joined, no repeats, at most
50 winners, total ≤ the prize. Anything left over returns to the host.

## Webhooks

`prize.created`, `prize.joined`, `prize.resolved`, `prize.paid`, `prize.refunded`
(`reason`: `vetoed` or `no_result`).

## Limits

| Tier | Max prize |
|---|---|
| private | $20 |
| public | $100 |
| growth | $500 |

Zend-wide cap while the contract is new: $100.
