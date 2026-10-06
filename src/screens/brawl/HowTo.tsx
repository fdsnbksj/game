import { PICKUPS, WEAPONS } from '../../games/brawl/weapons';
import { WeaponGlyph } from './Weapons';

/** The controls and the aim, in a few lines: shown on the front door and when paused. */
export function HowToBrawl() {
  return (
    <>
      <p>Knock the others off the island. Every hit adds damage, and the more damage someone has, the further they fly. Three lives each; the last one standing wins.</p>
      <p>
        Put your thumb anywhere below the arena. <strong>Drag</strong> to run, or down to fall fast and drop through a ledge. <strong>Tap</strong> to jump, and tap
        again in the air to jump once more.
      </p>
      <p>
        <strong>Double tap</strong> for a quick skill, <strong>hold</strong> until the ring fills and let go for a strong one. Swipe as you do it to aim; don't, and it
        aims at the nearest fighter. A strong skill aimed straight up leaps you back to safety.
      </p>
      <p>You start with bare hands. Weapons drop onto the island now and then: walk over one to pick it up. It lasts ten seconds.</p>
      <ul className="brawl-weapons">
        {PICKUPS.map((id) => (
          <li key={id}>
            <WeaponGlyph weapon={id} size={20} />
            {WEAPONS[id].name}
          </li>
        ))}
      </ul>
    </>
  );
}
