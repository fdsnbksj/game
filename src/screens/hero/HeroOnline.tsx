import { GameHome } from '../../components/RoomSetup';
import { heroReady, useHeroStore } from '../../heroStore';
import { createHeroRoom, joinHeroRoom } from '../../services/hero';
import { useWardrobeStore } from '../../wardrobeStore';

const tree = () => useHeroStore.getState().tree;
const appearance = () => useWardrobeStore.getState().appearance();

export function HeroOnline() {
  return (
    <GameHome
      title="Hero Gambit"
      tagline="Your hero against a friend's. One phone each."
      base="/hero"
      back="/"
      onHost={() => createHeroRoom(tree, appearance, heroReady)}
      onJoin={(code) => joinHeroRoom(code, tree, appearance, heroReady)}
      howTo={
        <>
          <p>Each of you brings your own hero, with the skills and stats from your skill tree.</p>
          <p>Take turns using one skill each: Stopwatch, Roulette or Poker. Bring the other hero's HP to 0 to win.</p>
          <p>Friendly fights give no skill points; those come from the bot ladder.</p>
        </>
      }
    />
  );
}
