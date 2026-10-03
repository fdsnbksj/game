import { GameHome } from '../../components/RoomSetup';
import { createDuel, joinDuel } from '../../services/duel';

export function DuelHome() {
  return (
    <GameHome
      title="Rival Wonders"
      tagline="Two rival cities, three ages. One phone each."
      base="/duel"
      onHost={createDuel}
      onJoin={joinDuel}
      howTo={
        <>
          <p>First you each draft four wonders. Then, on your turn, take any uncovered card from the table.</p>
          <p>Build it (the price is shown), use it to build one of your wonders, or sell it for coins.</p>
          <p>Win three ways: most points after three ages, push the war pawn into your rival's capital, or collect six different science symbols.</p>
        </>
      }
    />
  );
}
