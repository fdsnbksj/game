# Daily game

Current game: Pass or Pay (/pass), started 2026-10-28

Nobody wants the card. The numbers 3 to 35 come up one at a time (nine never show up); on your turn pay a coin to pass the card on, or take it with every coin piled on it. Low cards are good, runs in a row count only their lowest, and coins are points off, so the fun is in squeezing friends: pass a card that fits your run until the pot is fat, then take it. 2–6 friends, each on their own phone, in an online room. The morning routine adds one feature a day; the evening routine playtests and polishes it.

## Done

- 2026-10-28: Day one. Host, join by code or from Open rooms, host's seating order, play to the end with scores (runs, coins, ties share), Rematch in the same room; room version check with reload; heartbeat and abandoned-room cleanup; rules and rules tests.
- 2026-10-28 polish: at six phones on a 360×640 screen the Pay and Take buttons sat below the fold; they now sit in a dock stuck to the bottom of the screen. Taps within 0.45 s of the table changing are ignored (a thumb still down on Take could take the next card unseen, as when you take and move again). Runs of cards are spaced further apart. Checked: 3 and 6 phones to the end with scores and Rematch, join by code and from Open rooms, one phone reloaded mid-game (same table), one phone's listen/write channels blocked (stayed in step), 390×844, 360×640, no sideways scroll.
- 2026-10-29 polish: Rematch tapped when a game had just ended (or while the server was busy) could fail or stay on "Starting…" forever, because refused writes were swallowed; it now retries up to 5 times over a few seconds and shows the error if it still can't. Added the your-turn nudge (a short vibration when the move passes to you from someone else, off with reduced motion). Checked: 3, 6 and 2 phones to the end at 390×844, 360×640 and 430×932 with touch taps, the new flying coins and cards (no leftover ghosts or hidden elements, no sideways scroll), Rematch, join by code. Removed the New chip.
- 2026-10-30: Bots for empty seats. The host taps Add a bot in the lobby (✕ removes one; bots can be seated anywhere); the host's phone plays them a beat after each move. A bot takes a card that costs it little or a fat pot, pays on the rest, gets less choosy as its coins run low, and sometimes lets a card that joins its own run go round again for the coins. It beats random play 94% of the time. Rules let only the host write a seated bot's move.

## Next

1. Your turn nudge, visual half: the table card pulses when it becomes your move (the vibration is done).
2. A running tally across rematches: wins per player in this room, shown on the end screen.
3. Show each player's score so far in the players list (from their cards; coins stay hidden), folded behind a tap.
4. A "last moves" log in a SummaryRow: who paid, who took what and for how many coins, this game.
5. Lobby option: hidden or open coins (open shows everyone's coins in the players list).
6. Lobby option: a shorter game (set aside more cards, e.g. 15) for quick rounds between stops.
7. End screen: a reveal of the nine cards set aside.
8. Hint line for newcomers: "26 would join your 24–25: it costs you nothing" when a card fits your run.
9. Name chips with a colour per seat, used in the players list and the last-move line.
10. Lobby option: starting coins (7, 9, 11).
11. A host who leaves mid-game stalls the bots: let another player's phone take over playing them.
12. Bots with a little character (a careful one, a greedy one) chosen in the lobby.

## From the user
