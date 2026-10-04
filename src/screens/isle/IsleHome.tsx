import { GameHome } from '../../components/RoomSetup';
import { createRoom, joinRoom } from '../../services/isle';

export function IsleHome() {
  return (
    <GameHome
      title="Island Settlers"
      tagline="Three or four settlers, one island. Bots can fill empty seats."
      base="/isle"
      onHost={createRoom}
      onJoin={joinRoom}
      howTo={
        <>
          <p>Each turn, roll the dice: every land showing that number pays its resource to the settlements and cities on its corners.</p>
          <p>Spend resources on roads, settlements, cities and development cards. Trade with the bank, the harbours, or the other players.</p>
          <p>A 7 brings the robber. First to 10 points wins.</p>
        </>
      }
    />
  );
}
