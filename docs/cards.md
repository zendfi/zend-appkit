# Cards

Cards are how your app shows up in chats and the Activity feed. You pick a template and fill
slots; Zend draws the card, adds your app name, and shows the interaction's live state.

## Templates

| Template | Use | Shows state? |
|---|---|---|
| `result` | Something finished: "Tunde beat Danny 😂" | No |
| `invite` | Asking someone to act. Buttons disable once the interaction is finished | Yes |
| `status` | Ongoing progress: "4 of 12 rounds done" | Yes |

Old Zend versions that don't know a template show a plain "Open" card.

## Slots

| Slot | Rules |
|---|---|
| `title` | Required, ≤ 80 chars |
| `subtitle` | ≤ 140 chars |
| `emoji` | One emoji |
| `media` | `https` image URL |
| `buttons` | Up to 2 |

You can't set amounts or participants. Zend fills those from the interaction. Text must pass the
[copy guide](copy-guide.md).

## Buttons

| `action` | Fields | What happens |
|---|---|---|
| `open_sheet` | `path` | Opens your app at `path?interaction=<id>` |
| `start_interaction` | `type` | Opens your app at `/?start=<type>` |
| `open_url` | `url` | URL must be on your origins; opens in your sheet |
| | `label` | 1–20 chars, required for all |

## Placement

- `chat`: a bubble in the DM between the poster and the other participant. Only for
  interactions with exactly two people for now.
- `feed`: appears in "From your apps" at the top of Activity for everyone who can see the
  interaction (see visibility in [interactions.md](interactions.md)). A `participants`
  interaction needs at least two people.

## Posting rules

- The posting user must be a participant and must have allowed posting on the consent sheet.
- Users who muted your app don't see or post your cards.
- Daily cap per user: the lower of your tier's `cards_per_user_day` and your manifest's
  `cardsPerUserPerDay`. Over it: `CARD_LIMIT`.
- `idempotencyKey` is per user; repeating it returns the existing card.
