import { GameHome } from '../../components/RoomSetup';
import { createRoom, joinRoom } from '../../services/pass';

export function PassHome() {
  return (
    <GameHome
      title="Pass or Pay"
      tagline="Nobody wants the card. Pay a coin, or take it. Two to six."
      rooms="passes"
      base="/pass"
      onHost={createRoom}
      onJoin={joinRoom}
      howTo={
        <>
          <p>The deck holds the numbers 3 to 35. Nine are set aside unseen, so you never know which will come.</p>
          <p>One card lies face up. On your turn, pay a coin onto it to pass it on, or take it with every coin on it. Whoever takes it turns up the next card and goes again. No coins left? You must take.</p>
          <p>When the deck is gone, add up the numbers you took, but a run in a row (21, 22, 23) counts only its lowest. Every coin you kept takes one off. Lowest score wins.</p>
        </>
      }
    />
  );
}
