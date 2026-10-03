import { GameHome } from '../../components/RoomSetup';
import { createRoom, joinRoom } from '../../services/wonders';

export function WondersHome() {
  return (
    <GameHome
      title="Ancient Wonders"
      tagline="Three to seven cities, three ages. Bots can fill empty seats."
      base="/wonders"
      onHost={createRoom}
      onJoin={joinRoom}
      howTo={
        <>
          <p>Each turn everyone picks one card from their hand at the same time, then passes the rest on.</p>
          <p>Build the card, use it to raise your wonder, or sell it for 3 coins. Missing resources can be bought from your neighbours.</p>
          <p>Shields win battles with your neighbours at the end of each age. Most points after three ages wins.</p>
        </>
      }
    />
  );
}
