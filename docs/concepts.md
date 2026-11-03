# Concepts

## Pieces

- **Zend identity.** One account per person across Zend and every ZApp. Every app gets the
  user's `appUserId`, username, name and avatar. Email, wallet address and contacts need consent.
- **ZApp.** Your web app, hosted on your own HTTPS origin and registered with a manifest.
- **Screen.** Zend opens your app full screen.
  - Mobile: a WebView with no URL bar or browser chrome. Zend shows your icon and name while you
    load, matches the status bar to your page's `body` background colour, turns off zoom and link
    callouts, and adds one small floating pill (top right, collapses to a dot, draggable) for
    Close and Report. Android back goes back within your pages first.
  - Web: the address bar shows `app.usezend.app/apps/<slug>`, your app fills the window under a
    slim Zend bar, and the browser's back button returns to Zend.
  - Unreviewed apps show "Made by {you}. Not checked by Zend." on the loading screen and menu.
- **Bridge.** `@zend/appkit` talks to Zend through the sheet. Calls are JSON messages; Zend checks
  that each one comes from your registered origins.
- **Interaction.** A stateful object (a challenge, a round, a booking) with an ID. Cards and chat
  bubbles are views of an interaction and update when its state changes.
- **Card.** A feed or chat item drawn by Zend from a template you fill in.

## Who owns what

| Zend core | Your ZApp |
|---|---|
| Sign-in, consent, profile | Your logic and data |
| Every money screen, limits, payment records | Text, emoji, image and buttons on cards |
| Interaction storage and allowed state changes | The state machine itself (in your manifest) |
| Drawing cards and bubbles, posting rules | When to post |
| Webhook delivery | Handling webhooks |

Rule of thumb: anything involving money, identity, or what other people see is enforced by Zend.

## Lifecycle of a typical ZApp

1. User taps **+ → Apps → Challenge** in a chat with Danny.
2. Zend creates a `challenge` interaction with both people and opens your `sheet` path with
   `?interaction=int_...`.
3. First time only: a consent sheet ("Continue to Accident as Tunde?").
4. Your page reads `zend.launch.interaction`, plays the game, calls
   `zend.interaction.update(...)` and `zend.postCard(...)`.
5. Danny sees a card in the chat. Tapping its button opens your app on the same interaction.
6. Your server gets `interaction.updated` webhooks.

## Private vs public

| | Private (default) | Public |
|---|---|---|
| Review | None | Automated, human on flags |
| Label | "Made by {you}. Not checked by Zend." | None |
| Limits | `private` tier (low) | `public` tier |
| Custody | `contract` or `creator` | `contract` only |
| `public` interactions | Not allowed | Allowed |

Anyone with your app link (`app.usezend.app/apps/<slug>`) can open a private app.

## Custody

- `contract`: money is held by Zend's on-chain rules until they say who gets it.
  Users see "held safely until the rules say who gets it".
- `creator`: money goes straight to the person who made the group or event.
  Users see "Goes straight to {name}. Zend can't get it back."

## Trust boundaries

- Your page is untrusted from Zend's point of view. It can propose money actions; only the user
  approves them in Zend's sheet.
- A resolved promise in the browser is not proof of payment. Use webhooks or the server API.
- `appSession` tokens last 10 minutes. Exchange them on your server; don't use them as your own
  session.

## Designing for the screen

- Build for full screen, mobile first. Set a solid `body` background colour.
- Keep the top-right 120×44 px clear of important controls (the Zend pill sits there until it folds).
- Don't add your own "back to Zend" button; use `zend.close()` when you're done.
- Links to other sites open outside Zend after the user confirms. Keep everything you need on your origins.
- Users find you on Discover by name, so put your real app name in `name` and a one-line `description`.
