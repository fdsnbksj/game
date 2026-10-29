# Daily game

Current game: Pass or Pay (/pass), started 2026-10-28

Nobody wants the card. The numbers 3 to 35 come up one at a time (nine never show up); on your turn pay a coin to pass the card on, or take it with every coin piled on it. Low cards are good, runs in a row count only their lowest, and coins are points off, so the fun is in squeezing friends: pass a card that fits your run until the pot is fat, then take it. 2–6 friends, each on their own phone, in an online room. The morning routine adds one feature a day; the evening routine playtests and polishes it.

## Done

- 2026-10-28: Day one. Host, join by code or from Open rooms, host's seating order, play to the end with scores (runs, coins, ties share), Rematch in the same room; room version check with reload; heartbeat and abandoned-room cleanup; rules and rules tests.
- 2026-10-28 polish: at six phones on a 360×640 screen the Pay and Take buttons sat below the fold; they now sit in a dock stuck to the bottom of the screen. Taps within 0.45 s of the table changing are ignored (a thumb still down on Take could take the next card unseen, as when you take and move again). Runs of cards are spaced further apart. Checked: 3 and 6 phones to the end with scores and Rematch, join by code and from Open rooms, one phone reloaded mid-game (same table), one phone's listen/write channels blocked (stayed in step), 390×844, 360×640, no sideways scroll.

## Next

1. Your turn nudge: the table card pulses and the phone vibrates (`navigator.vibrate`, if allowed) when it becomes your move after someone else's.
2. Bots for empty seats (`bot:N`, played by the host's phone, like Bluff Table): a simple bot that takes when the cost is low or the pot is big enough, else pays.
3. A running tally across rematches: wins per player in this room, shown on the end screen.
4. Show each player's score so far in the players list (from their cards; coins stay hidden), folded behind a tap.
5. A "last moves" log in a SummaryRow: who paid, who took what and for how many coins, this game.
6. Lobby option: hidden or open coins (open shows everyone's coins in the players list).
7. Lobby option: a shorter game (set aside more cards, e.g. 15) for quick rounds between stops.
8. End screen: a reveal of the nine cards set aside.
9. Hint line for newcomers: "26 would join your 24–25: it costs you nothing" when a card fits your run.
10. Name chips with a colour per seat, used in the players list and the last-move line.
11. Lobby option: starting coins (7, 9, 11).
12. End screen: a Rematch tapped the instant a game ends can be refused if no phone has marked the room done yet; retry once after a beat.

## From the user
