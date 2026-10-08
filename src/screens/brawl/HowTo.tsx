import { PICKUPS, WEAPONS } from '../../games/brawl/weapons';
import { WeaponGlyph } from './Weapons';

/** The controls and the aim, in a few lines: shown on the front door and when paused. */
export function HowToBrawl() {
  return (
    <>
      <p>
        Everyone has <strong>100 HP</strong>. At 0, or off the edge of the stage, you're out. The last one standing takes the round, and the first to three rounds
        wins. Every round is on a new stage, and each has its own twist: lifts, lava, spikes, crumbling blocks, wind, conveyors, ice, saw blades, trampolines, the Moon.
      </p>
      <p>
        Turn your phone sideways. Your <strong>left thumb</strong> is the joystick: put it down anywhere on the left to run, hold down to fall fast or drop through a
        ledge.
      </p>
      <p>
        Your <strong>right thumb</strong> has four buttons: <strong>Jump</strong> (again in the air for a second jump), <strong>Attack</strong>,{' '}
        <strong>Heavy</strong> and <strong>Dodge</strong>. Point the stick as you attack to aim; leave it centred and you aim at the nearest fighter.
      </p>
      <p>
        You start bare-handed. Weapons drop in now and then: run over one to pick it up. Each has so many shots or swings, shown on your chip; once it's empty, the next
        Attack throws it.
      </p>
      <p>
        <strong>Hold Heavy</strong> and let go: with the stick centred it's a kick, up to twice as hard for a second's charge; with the stick pushed, you throw what
        you're holding that way. Let go with the stick straight up in the air to leap back to safety.
      </p>
      <p>
        Dodge on the ground to roll out of a hit. Dodge in the air to freeze a floor of ice under your feet to stand and fight on. One per jump; it melts in two
        seconds.
      </p>
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
