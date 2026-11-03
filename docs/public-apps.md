# Public apps

Private apps are shared by link and aren't reviewed. Public apps are listed by Zend, reach
strangers, get the `public` tier, and lose the "Not checked by Zend" label.

## 1. Prove you own your origins

Serve this at every origin in your manifest:

```
https://your-app.example.com/.well-known/zend-app.json
{ "app": "<your slug>" }
```

## 2. Manifest additions

```json
{
  "visibility": "public",
  "custody": "contract",
  "developer": {
    "name": "mhetLabs",
    "support": "help@example.com",
    "privacy": "https://your-app.example.com/privacy"
  },
  "results": "checked"
}
```

| `results` | Shown to users | Use when |
|---|---|---|
| `none` | nothing | No winners or rankings |
| `app` | "Results decided by {app}" | Your server decides |
| `checked` | "Checked afterwards so nobody can cheat" | You publish commit/reveal with `zend.attest` |

Apps with the `prize` permission must set `results` to `app` or `checked` and a `resolverKey`.

## 3. Review

`zend apps deploy` with `visibility: public` puts the app `in_review`.

1. **Automated (about a minute):** origin ownership file, entry page loads over HTTPS and uses the
   SDK, Google Safe Browsing. Failures set `rejected` with findings.
2. **Zend approval:** a Zend admin approves passing apps. v1 approves every listing by hand.

Check progress: `zend apps review <slug>` or Settings → Developer.

After listing:
- Changes to name, icon or copy keep the listing.
- Changes to `origins`, `permissions`, `resolverKey`, `custody`, `results` or `visibility` send the
  app back to review. Until approved, the new version is live but unlisted.
- Users can report your app. Many reports in 24 hours suspend it until Zend reviews it.

## Fairness with `zend.attest`

Commit before play, reveal after, and let anyone check:

```ts
const commitment = await sha256Hex(`${secret}|${saltHex}|${interactionId}|${me.appUserId}`);
const receipt = await zend.attest({ label: "commit", dataHash: commitment, interactionId });
// ...play...
await zend.attest({ label: "reveal", dataHash: await sha256Hex(`${secret}|${saltHex}`), interactionId });
```

- Receipts are signed by Zend and chained, so a deleted or edited record is detectable.
- Anyone can fetch them: `GET /api/zend/v2/apps/attest/interactions/<id>`.
- Verify offline with `verifyAttestation(receipt, zendKey)` from `@zend/appkit/server`, with
  `zendKey` from `GET /api/zend/v2/apps/attest/key`.
- Needs the `attest` permission.

This catches lies after the game. It doesn't stop players using solvers; detect those separately.
