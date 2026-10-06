import { GameHome } from '../../components/RoomSetup';
import { createBrawl, joinBrawl } from '../../services/brawl';
import { HowToBrawl } from './HowTo';

/** Sky Brawl against a friend's phone: open a room, or join one with its code. */
export function BrawlOnline() {
  return (
    <GameHome
      title="Sky Brawl online"
      tagline="One on one against a friend, each on your own phone. Works best on the same Wi-Fi."
      base="/brawl"
      onHost={createBrawl}
      onJoin={joinBrawl}
      howTo={<HowToBrawl />}
    />
  );
}
