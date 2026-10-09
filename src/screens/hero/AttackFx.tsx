import type { CSSProperties } from 'react';
import type { AttackId, Family } from '../../games/hero/monsters';

// A creature's attacks, drawn over the battlefield: slashes, shockwaves, flames, smoke, a
// shield, a charge-up, a drain, and each boss family's own finisher. Creatures are always
// the foe, so everything flies from the top right to your hero at the bottom left. Normal
// creatures play a smaller version (`small`); bosses the full one, and only bosses shake
// the field. The hit lands at `attackImpactMs` (Fight.tsx waits for it).

/** When a creature's attack lands, in ms from the start of its turn. */
export const attackImpactMs = (id: AttackId, boss: boolean) => (id === 'finisher' ? 1800 : boss ? 950 : 850);

/** Heavy hits that shake the whole field: a boss's. */
export const quakes = (id: AttackId, boss: boolean) => boss && (id === 'slam' || id === 'finisher');

const n = (count: number) => Array.from({ length: count }, (_, i) => i);
const at = (i: number, style: CSSProperties = {}) => ({ '--i': i, ...style }) as CSSProperties;

export function AttackFx({ id, family, boss }: { id: AttackId; family: Family; boss: boolean }) {
  return (
    <div className={`fx-layer fx-${id}${boss ? '' : ' small'}`} aria-hidden="true">
      {id === 'strike' && (
        <svg className="fx-slash at-hero" viewBox="0 0 100 100">
          {n(3).map((i) => (
            <line key={i} x1={18 + i * 18} y1="12" x2={6 + i * 18} y2="88" pathLength={1} style={at(i)} />
          ))}
        </svg>
      )}
      {id === 'jab' && (
        <svg className="fx-burst at-hero" viewBox="-50 -50 100 100">
          <path d="M0 -46 L10 -12 L44 -16 L16 6 L30 40 L0 18 L-30 40 L-16 6 L-44 -16 L-10 -12 Z" />
        </svg>
      )}
      {id === 'slam' && (
        <>
          <span className="fx-drop at-hero" />
          {n(3).map((i) => (
            <span key={i} className="fx-ring at-hero" style={at(i)} />
          ))}
        </>
      )}
      {id === 'drain' &&
        n(7).map((i) => (
          <span key={i} className="fx-orb" style={at(i)} />
        ))}
      {id === 'scorch' &&
        n(6).map((i) => (
          <span key={i} className="fx-flame" style={at(i, { left: `${14 + i * 5}%` })} />
        ))}
      {id === 'rattle' &&
        n(3).map((i) => (
          <span key={i} className="fx-wave at-boss" style={at(i)} />
        ))}
      {id === 'smoke' &&
        n(7).map((i) => (
          <span key={i} className="fx-puff" style={at(i, { left: `${6 + ((i * 37) % 40)}%`, top: `${50 + ((i * 23) % 30)}%` })} />
        ))}
      {id === 'brace' && <span className="fx-shield at-boss" />}
      {id === 'windup' && (
        <>
          <span className="fx-aura at-boss" />
          {n(8).map((i) => (
            <span key={i} className="fx-spark" style={at(i, { left: `${62 + ((i * 29) % 26)}%` })} />
          ))}
        </>
      )}
      {id === 'finisher' && <Finisher family={family} />}
    </div>
  );
}

function Finisher({ family }: { family: Family }) {
  return (
    <>
      {family === 'clock' && (
        <svg className="fx-bigclock" viewBox="-60 -60 120 120">
          <circle r="54" className="fx-clock-face" />
          {n(12).map((i) => (
            <line key={i} y1="-46" y2={i % 3 ? -41 : -36} transform={`rotate(${i * 30})`} className="fx-clock-tick" />
          ))}
          {/* Each hand turns about the centre: the unseen circle makes its box the face's. */}
          <g className="fx-clock-hour">
            <circle r="54" fill="none" />
            <line y2="-26" />
          </g>
          <g className="fx-clock-minute">
            <circle r="54" fill="none" />
            <line y2="-42" />
          </g>
          <circle r="4" className="fx-clock-pin" />
        </svg>
      )}
      {family === 'card' &&
        n(5).map((i) => (
          <span key={i} className="fx-card" style={at(i)}>
            {['A', 'K', 'Q', 'J', '10'][i]}
          </span>
        ))}
      {family === 'wheel' && (
        <svg className="fx-blade" viewBox="-50 -50 100 100">
          <circle r="46" className="fx-blade-rim" />
          {n(8).map((i) => (
            <path key={i} d="M0 0 L0 -44 A44 44 0 0 1 31.1 -31.1 Z" transform={`rotate(${i * 45})`} className={i % 2 ? 'fx-blade-dark' : 'fx-blade-red'} />
          ))}
          <circle r="10" className="fx-blade-hub" />
        </svg>
      )}
      {family === 'coin' &&
        n(10).map((i) => (
          <span key={i} className="fx-coin" style={at(i, { left: `${8 + ((i * 41) % 40)}%` })} />
        ))}
      {family === 'dice' && <span className="fx-die" />}
      <span className="fx-flash" />
    </>
  );
}
