import { GameHome } from '../../components/RoomSetup';
import { createRoom, joinRoom } from '../../services/avalon';

export function AvalonHome() {
  return (
    <GameHome
      title="Avalon"
      tagline="Hidden loyalty for 5 to 10 players at one table, a phone each."
      base="/avalon"
      onHost={createRoom}
      onJoin={joinRoom}
      howTo={
        <>
          <p>Everyone is secretly good or evil. Hold your role button to see who you are, and who you know.</p>
          <p>Each round a leader picks a team, everyone votes on it, and the team plays Success or Fail in secret.</p>
          <p>Three successful quests and good wins, unless the assassin then names Merlin. Three failed quests and evil wins.</p>
          <p>The talking happens out loud; the phones keep the secrets and the score.</p>
        </>
      }
    />
  );
}
