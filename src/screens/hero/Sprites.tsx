import type { CSSProperties } from 'react';
import type { Appearance } from '../../games/hero/look';
import type { Family } from '../../games/hero/monsters';
import { HeroFigure } from './Avatar';
import { Googly } from './Googly';

// The fighters as drawn on the battlefield: your hero from behind, an opponent hero from
// the front (both Avatar.tsx), and the bot ladder's creatures in five families (clocks, coins, cards, dice
// and wheels) drawn as garden pests: a clock-shelled snail, a coin-shelled beetle, a moth with
// playing-card wings, a dice toad and a roulette ladybug. Big round eyes and grins, each level
// its own colour, bosses in a garden-gnome hat. Our own art; colours are tokens.

export type SpriteSpec = { kind: 'hero'; appearance: Appearance } | { kind: 'creature'; family: Family; level: number; boss: boolean };

const MON_COLOURS = 8;

export function Sprite({ spec, back = false, className = '' }: { spec: SpriteSpec; back?: boolean; className?: string }) {
  if (spec.kind === 'hero') return <HeroFigure appearance={spec.appearance} back={back} className={className} />;
  return <CreatureSprite family={spec.family} level={spec.level} boss={spec.boss} className={className} />;
}

/** A pair of big round eyes, the left one a little bigger, with cross brows when angry. */
function Eyes({ y, gap = 12, cx = 60, size = 7, angry }: { y: number; gap?: number; cx?: number; size?: number; angry: boolean }) {
  return (
    <g>
      {[-1, 1].map((side) => {
        const r = side < 0 ? size * 1.3 : size;
        const x = cx + side * gap;
        return (
          <g key={side}>
            <Googly x={x} y={y} r={r} beat={side + 1} />
            {angry && (
              <path
                className="s-brow"
                d={`M${x + side * (r + 2)} ${y - r - 7} l${-side * 4} 3 l${-side * 4} -2 l${-side * 4} 4`}
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

/** A wide open grin full of square teeth, with a little tongue. */
function Grin({ cx = 60, y, w = 26 }: { cx?: number; y: number; w?: number }) {
  const h = w * 0.5;
  const l = cx - w / 2;
  return (
    <g>
      <path className="s-ink-fill" d={`M${l} ${y} q${w / 2} ${h * 1.6} ${w} 0z`} />
      <path className="s-blush" d={`M${cx - w * 0.2} ${y + h * 0.62} q${w * 0.2} ${-h * 0.4} ${w * 0.4} 0 q${-w * 0.2} ${h * 0.22} ${-w * 0.4} 0z`} />
      <path className="s-tooth s-ink" d={`M${l + 2} ${y} h${w - 4} v${h * 0.32} h${-(w - 4)}z`} strokeWidth="1.5" />
      {[1, 2, 3].map((i) => (
        <line key={i} className="s-ink" x1={l + 2 + ((w - 4) * i) / 4} y1={y} x2={l + 2 + ((w - 4) * i) / 4} y2={y + h * 0.32} strokeWidth="1.2" />
      ))}
    </g>
  );
}

/** Round pink cheeks. */
const Blush = ({ y, xs }: { y: number; xs: number[] }) => (
  <>
    {xs.map((x) => (
      <ellipse key={x} className="s-blush" cx={x} cy={y} rx="5" ry="3" />
    ))}
  </>
);

/** A boss's mark: a tall, floppy garden-gnome hat with a bobble. */
const GnomeHat = ({ x = 60, y }: { x?: number; y: number }) => (
  <g transform={`rotate(-10 ${x} ${y})`}>
    <path className="s-gnome s-ink" d={`M${x - 20} ${y} q2 -22 18 -34 q10 -6 12 2 q-6 4 -4 10 q4 10 -4 22z`} strokeWidth="3" strokeLinejoin="round" />
    <path className="s-gnome-brim s-ink" d={`M${x - 23} ${y + 1} q22 -7 46 0 q-23 8 -46 0z`} strokeWidth="2.5" />
    <circle className="s-gnome-brim s-ink" cx={x + 12} cy={y - 34} r="4.5" strokeWidth="2" />
  </g>
);

/** Thin bug legs, three a side, bent at the knee. */
const BugLegs = ({ cx = 60, y, spread = 30 }: { cx?: number; y: number; spread?: number }) => (
  <>
    {[-1, 1].flatMap((side) =>
      [0, 1, 2].map((i) => (
        <path
          key={`${side}${i}`}
          className="s-ink"
          d={`M${cx + side * (spread - 8)} ${y + i * 12} l${side * 12} ${-4 + i * 2} l${side * 4} ${8 + i * 2}`}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )),
    )}
  </>
);

/** Two feelers ending in little bobbles. */
const Feelers = ({ cx = 60, y, w = 10, h = 18 }: { cx?: number; y: number; w?: number; h?: number }) => (
  <>
    {[-1, 1].map((side) => (
      <g key={side}>
        <path className="s-ink" d={`M${cx + side * 4} ${y} q${side * w * 0.2} ${-h * 0.7} ${side * w} ${-h}`} fill="none" strokeWidth="2.5" strokeLinecap="round" />
        <circle className="s-body s-ink" cx={cx + side * w} cy={y - h} r="3.5" strokeWidth="2" />
      </g>
    ))}
  </>
);

function CreatureSprite({ family, level, boss, className }: { family: Family; level: number; boss: boolean; className: string }) {
  const style = { '--mon-body': `var(--mon-${((level * 3) % MON_COLOURS) + 1})` } as CSSProperties;
  return (
    <svg className={`sprite creature-sprite${boss ? ' boss' : ''} ${className}`} viewBox="0 0 120 120" style={style} aria-hidden="true">
      {family === 'clock' && <Snail boss={boss} />}
      {family === 'coin' && <Beetle boss={boss} />}
      {family === 'card' && <Moth boss={boss} />}
      {family === 'dice' && <Toad boss={boss} />}
      {family === 'wheel' && <Ladybug boss={boss} />}
    </svg>
  );
}

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
};

/** The clocks: a snail whose shell is a clock face. */
function Snail({ boss }: { boss: boolean }) {
  return (
    <>
      <ellipse className="s-shade" cx="62" cy="106" rx="46" ry="5" />
      {/* The foot, rising into a head on the left. */}
      <path className="s-slug s-ink" d="M106 104 q-40 2 -78 0 q-12 -1 -12 -14 v-26 q0 -16 14 -16 q14 0 14 16 v22 q30 0 62 6 q10 4 0 12z" strokeWidth="3.5" strokeLinejoin="round" />
      {/* Eye stalks. */}
      <path className="s-ink" d="M24 52 q-6 -12 -10 -22 M36 52 q4 -12 8 -22" fill="none" strokeWidth="3.5" strokeLinecap="round" />
      <Googly x={14} y={28} r={7.5} beat={0} ring={2.5} />
      <Googly x={44} y={28} r={6.5} beat={1} ring={2.5} />
      {boss && <path className="s-brow" d="M6 17 l14 5 M52 17 l-14 5" strokeWidth="3" strokeLinecap="round" />}
      <Blush y={74} xs={[18, 40]} />
      <Grin cx={29} y={78} w={18} />
      {/* The shell: a clock. */}
      <circle className="s-body s-ink" cx="74" cy="64" r="34" strokeWidth="3.5" />
      <circle className="s-face s-ink" cx="74" cy="64" r="25" strokeWidth="2.5" />
      {Array.from({ length: 12 }, (_, i) => {
        const [x1, y1] = polar(74, 64, 20, i * 30);
        const [x2, y2] = polar(74, 64, 24, i * 30);
        return <line key={i} className="s-tick" x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={i % 3 ? 1.5 : 3} />;
      })}
      <path className="s-hand" d="M74 64 L74 48 M74 64 L84 70" strokeWidth="3" strokeLinecap="round" />
      <circle className="s-ink-fill" cx="74" cy="64" r="2.5" />
      <path className="s-shine" d="M50 50 q6 -14 20 -18" fill="none" strokeWidth="4" strokeLinecap="round" />
      {boss && <GnomeHat x={30} y={40} />}
    </>
  );
}

/** The coins: a round beetle with a gold coin for a shell. */
function Beetle({ boss }: { boss: boolean }) {
  return (
    <>
      <ellipse className="s-shade" cx="60" cy="108" rx="40" ry="5" />
      <BugLegs y={62} spread={36} />
      <Feelers y={22} w={16} h={16} />
      {/* The coin shell, split down the middle. */}
      <ellipse className="s-gold s-ink" cx="60" cy="72" rx="38" ry="34" strokeWidth="3.5" />
      <ellipse className="s-body-line" cx="60" cy="72" rx="30" ry="26" fill="none" strokeWidth="3" strokeDasharray="6 5" />
      <path className="s-ink" d="M60 46 v58" strokeWidth="3" />
      <path className="s-shine" d="M32 60 q4 -12 16 -16" fill="none" strokeWidth="4" strokeLinecap="round" />
      {/* The head, peeking over the shell. */}
      <circle className="s-body s-ink" cx="60" cy="38" r="20" strokeWidth="3.5" />
      <Eyes y={34} gap={9} size={6} angry={boss} />
      <Grin y={44} w={18} />
      {boss && <GnomeHat y={22} />}
    </>
  );
}

/** The cards: a fuzzy moth whose wings are two playing cards. */
function Moth({ boss }: { boss: boolean }) {
  return (
    <>
      <ellipse className="s-shade" cx="60" cy="110" rx="30" ry="4" />
      {/* Card wings, fanned out. */}
      {[-1, 1].map((side) => (
        <g key={side} transform={`rotate(${side * 24} 60 66)`}>
          <rect className="s-face s-ink" x={side < 0 ? 18 : 68} y="30" width="34" height="50" rx="6" strokeWidth="3" />
          <path className="s-body" d={`M${side < 0 ? 35 : 85} 44 q-6 7 0 11 q4 2 6 -1 l-2 5 h4 l-2 -5 q2 3 6 1 q6 -4 0 -11 l-6 -5z`} />
          <text className="s-card-mark" x={side < 0 ? 23 : 73} y="76">
            {side < 0 ? 'A' : 'K'}
          </text>
        </g>
      ))}
      <Feelers y={36} w={12} h={18} />
      {/* The fuzzy body. */}
      <ellipse className="s-body s-ink" cx="60" cy="74" rx="14" ry="30" strokeWidth="3.5" />
      <path className="s-ink" d="M48 80 q12 4 24 0 M48 90 q12 4 24 0" fill="none" strokeWidth="2.5" strokeLinecap="round" />
      <Eyes y={54} gap={7} size={5} angry={boss} />
      <Grin y={64} w={14} />
      {boss && <GnomeHat y={33} />}
    </>
  );
}

/** The dice: a cube toad with pips for warts. */
function Toad({ boss }: { boss: boolean }) {
  return (
    <>
      <ellipse className="s-shade" cx="60" cy="108" rx="44" ry="5" />
      {/* Back legs folded at the sides, front feet out. */}
      <path className="s-body s-ink" d="M18 96 q-8 -20 6 -30 l8 30z M102 96 q8 -20 -6 -30 l-8 30z" strokeWidth="3" strokeLinejoin="round" />
      <path className="s-body s-ink" d="M34 106 q-8 0 -6 -6 l10 -2z M86 106 q8 0 6 -6 l-10 -2z" strokeWidth="2.5" />
      <rect className="s-body s-ink" x="24" y="40" width="72" height="64" rx="16" strokeWidth="3.5" />
      <rect className="s-face" x="32" y="76" width="56" height="22" rx="10" opacity="0.55" />
      {/* Warts in a dice's pips. */}
      {[
        [34, 52],
        [86, 52],
        [34, 92],
        [86, 92],
        [60, 98],
      ].map(([x, y]) => (
        <circle key={x * 100 + y} className="s-pip" cx={x} cy={y} r="3.2" />
      ))}
      {/* Eyes bulging off the top. */}
      <circle className="s-body s-ink" cx="42" cy="40" r="13" strokeWidth="3" />
      <circle className="s-body s-ink" cx="78" cy="40" r="11" strokeWidth="3" />
      <Googly x={42} y={38} r={9} beat={0} ring={2.2} />
      <Googly x={78} y={39} r={7.5} beat={1} ring={2.2} />
      {boss && <path className="s-brow" d="M30 24 l18 6 M90 24 l-18 6" strokeWidth="3.5" strokeLinecap="round" />}
      <Blush y={70} xs={[36, 84]} />
      {/* A wide toad mouth. */}
      <path className="s-ink" d="M34 66 q26 18 52 0" fill="none" strokeWidth="3.5" strokeLinecap="round" />
      {boss && <GnomeHat y={26} />}
    </>
  );
}

/** The wheels: a ladybug whose shell is a roulette wheel. */
function Ladybug({ boss }: { boss: boolean }) {
  const wedges = 10;
  return (
    <>
      <ellipse className="s-shade" cx="60" cy="108" rx="42" ry="5" />
      <BugLegs y={64} spread={38} />
      <circle className="s-ink-fill" cx="60" cy="70" r="40" />
      {Array.from({ length: wedges }, (_, i) => {
        const [x1, y1] = polar(60, 70, 35, (i * 360) / wedges);
        const [x2, y2] = polar(60, 70, 35, ((i + 1) * 360) / wedges);
        return <path key={i} className={i % 2 ? 's-face' : 's-body'} d={`M60 70 L${x1} ${y1} A35 35 0 0 1 ${x2} ${y2} Z`} />;
      })}
      <path className="s-ink" d="M60 34 v72" strokeWidth="3" />
      <circle className="s-gold s-ink" cx="60" cy="70" r="7" strokeWidth="2.5" />
      <path className="s-shine" d="M30 54 q6 -14 20 -18" fill="none" strokeWidth="4" strokeLinecap="round" />
      {/* The head, a dark dome with its face. */}
      <path className="s-ink-fill" d="M36 38 a24 22 0 0 1 48 0z" />
      <Feelers y={18} w={14} h={12} />
      <Eyes y={28} gap={9} size={6} angry={boss} />
      {boss && <GnomeHat y={14} />}
    </>
  );
}

/** A creature's head-and-shoulders for lists (the bot ladder). */
export function CreatureThumb({ family, level, boss }: { family: Family; level: number; boss: boolean }) {
  return <CreatureSprite family={family} level={level} boss={boss} className="thumb" />;
}
