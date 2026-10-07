import { PICKUPS, WEAPONS } from '../../games/brawl/weapons';
import { WeaponGlyph } from './Weapons';

/** The controls and the aim, in a few lines: shown on the front door and when paused. */
export function HowToBrawl() {
  return (
    <>
      <p>Knock the others off the island. Every hit adds damage, and the more damage someone has, the further they fly. Three lives each; the last one standing wins.</p>
      <p>
        Turn your phone sideways. Your <strong>left thumb</strong> is the joystick: put it down anywhere on the left to run, hold down to fall fast or drop through a
        ledge.
      </p>
      <p>
        Your <strong>right thumb</strong> has four buttons: <strong>Jump</strong> (again in the air for a second jump), <strong>Attack</strong>,{' '}
        <strong>Heavy</strong> and <strong>Dodge</strong>. Point the stick as you attack to aim; leave it centred and you aim at the nearest fighter.
      </p>
      <p>
        <strong>Hold Heavy</strong> to charge it and let go to strike: the longer you hold (up to a second), the harder it hits, up to twice the damage. You
        shuffle slowly while charging, and a hit knocks the charge out. A heavy let go with the stick straight up leaps you back to safety.
      </p>
      <p>
        Dodge on the ground to roll out of a hit. Dodge in the air to freeze a floor of ice under your feet: stand on it, fight from it, jump off it. One per jump, and
        it melts in two seconds.
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
