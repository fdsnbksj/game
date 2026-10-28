# Daily game

Current game: Pass or Pay (/pass), started 2026-10-28

Nobody wants the card. The numbers 3 to 35 come up one at a time (nine never show up); on your turn pay a coin to pass the card on, or take it with every coin piled on it. Low cards are good, runs in a row count only their lowest, and coins are points off, so the fun is in squeezing friends: pass a card that fits your run until the pot is fat, then take it. 2–6 friends, each on their own phone, in an online room. The morning routine adds one feature a day; the evening routine playtests and polishes it.

## Done

- 2026-10-28: Day one. Host, join by code or from Open rooms, host's seating order, play to the end with scores (runs, coins, ties share), Rematch in the same room; room version check with reload; heartbeat and abandoned-room cleanup; rules and rules tests.

## Next

1. A short animation when a card is taken (it slides to the taker's row, the coins follow) and when a coin is paid onto the pot, so a move made on another phone is easy to notice.
2. Your turn nudge: the table card pulses and the phone vibrates (`navigator.vibrate`, if allowed) when it becomes your move after someone else's.
3. Bots for empty seats (`bot:N`, played by the host's phone, like Bluff Table): a simple bot that takes when the cost is low or the pot is big enough, else pays.
4. A running tally across rematches: wins per player in this room, shown on the end screen.
5. Show each player's score so far in the players list (from their cards; coins stay hidden), folded behind a tap.
6. A "last moves" log in a SummaryRow: who paid, who took what and for how many coins, this game.
7. Lobby option: hidden or open coins (open shows everyone's coins in the players list).
8. Lobby option: a shorter game (set aside more cards, e.g. 15) for quick rounds between stops.
9. End screen: a reveal of the nine cards set aside.
10. Hint line for newcomers: "26 would join your 24–25: it costs you nothing" when a card fits your run.
11. Name chips with a colour per seat, used in the players list and the last-move line.
12. Lobby option: starting coins (7, 9, 11).

## From the user
