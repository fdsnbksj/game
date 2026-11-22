import { GameHome } from '../../components/RoomSetup';
import { createKitchenRoom, joinKitchenRoom } from '../../services/kitchen';

export function KitchenHome() {
  return (
    <GameHome
      title="Short Order"
      tagline="Cook soups to order together, three minutes a shift."
      rooms="kitchens"
      base="/kitchen"
      onHost={createKitchenRoom}
      onJoin={joinKitchenRoom}
      howTo={
        <>
          <p>One to four cooks share one kitchen, each on their own phone. Orders come in along the top: each is a soup of three things, with a bar for how long the customer will wait.</p>
          <p>Tap a tile and your chef walks there and uses it. Take a tomato, onion or mushroom from its crate, chop it on a board (your chef stays to chop), and drop it in a pot. Three in a pot and it cooks; a green ring means it's ready.</p>
          <p>Take a plate, tap the cooked pot to fill it, and tap the hatch (the arrow) to serve. Sooner earns a bigger tip. Counters hold one thing each, handy for passing to a friend. The bin empties a wrong soup.</p>
          <p>Talk to each other! Earn up to three stars in three minutes.</p>
        </>
      }
    />
  );
}
