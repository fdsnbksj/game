import { GameHome } from '../../components/RoomSetup';
import { createRoom, joinRoom } from '../../services/bluff';

export function BluffHome() {
  return (
    <GameHome
      title="Bluff Table"
      tagline="Lie with a straight face. Two to four, bots welcome."
      rooms="bluffs"
      base="/bluff"
      onHost={createRoom}
      onJoin={joinRoom}
      howTo={
        <>
          <p>The deck has six kings, six queens, six aces and two jokers. Each round names a table card and deals everyone five cards.</p>
          <p>On your turn, put one to three cards face down and claim they're all the table card. Jokers count as it. You may lie.</p>
          <p>Or call the last player a liar. Their cards turn over: if any isn't the table card or a joker, they pull the trigger. If it was all true, you do.</p>
          <p>Each player's revolver holds one bullet in six chambers, so every pull is riskier than the last. After a call, a new round is dealt. Last one standing wins.</p>
        </>
      }
    />
  );
}
