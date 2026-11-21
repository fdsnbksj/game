import { GameHome } from '../../components/RoomSetup';
import { createPigRoom, joinPigRoom } from '../../services/pigs';

export function PigsHome() {
  return (
    <GameHome
      title="Pig Lasso"
      tagline="Lasso more pigs than your friend in one minute."
      rooms="pigs"
      base="/pigs"
      onHost={createPigRoom}
      onJoin={joinPigRoom}
      howTo={
        <>
          <p>You and a friend stand at either end of a pen of pigs, each on your own phone. Your lasso swings back and forth at the bottom of your screen.</p>
          <p>Tap anywhere to throw it the way it's pointing. It brings back the first pig it touches: a pink pig is 100, a big sow 200 (slow to pull in), a black pig 250, but black pigs are quick and dodge about.</p>
          <p>A lasso that comes back empty costs you 50. You both go after the same pigs. Most points after one minute wins.</p>
        </>
      }
    />
  );
}
