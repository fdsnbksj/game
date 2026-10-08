import { PICKUPS, WEAPONS } from '../../games/brawl/weapons';
import { WeaponGlyph } from './Weapons';

/** The controls and the aim, in a few lines: shown on the front door and when paused. */
export function HowToBrawl() {
  return (
    <>
      <p>
        Everyone has <strong>100 HP</strong>. Every stage is walled in with a floor, so it's a fight, not a fall; the top is open, and anyone launched up there
        drops back in. Each stage has its own twist: lifts, lava, spikes, crumbling blocks, wind, conveyors, ice, saw blades, trampolines, the Moon, mines,
        lasers, falling anvils.
      </p>
      <p>
        Two ways to play, set under Rules. <strong>Score:</strong> rounds; the last one standing gets a point, first to the target wins.{' '}
        <strong>Timed:</strong> 3 to 5 minutes; a kill is +2, a death −3, you're back in after 2 seconds, the stage changes each minute, and a tie at the end
        goes to sudden death.
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
      <p>Dodge rolls out of a hit on the ground; in the air it's a quick untouchable dash the way the stick points, once per jump.</p>
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
