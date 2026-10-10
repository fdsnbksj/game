import type { CSSProperties } from 'react';
import type { Appearance } from '../../games/hero/look';
import type { Family } from '../../games/hero/monsters';
import { HeroFigure } from './Avatar';
import { Googly } from './Googly';

// The fighters as drawn on the battlefield: your hero from behind, an opponent hero from
// the front (both Avatar.tsx), and the bot ladder's creatures in five families (clocks, coins, cards, dice
// and wheels): goofy wacky critters with googly eyes, big toothy grins and rubbery limbs, each
// level its own colour, bosses wearing a crown on a spring. Our own art; colours are tokens.

export type SpriteSpec = { kind: 'hero'; appearance: Appearance } | { kind: 'creature'; family: Family; level: number; boss: boolean };

const MON_COLOURS = 8;

export function Sprite({ spec, back = false, className = '' }: { spec: SpriteSpec; back?: boolean; className?: string }) {
  if (spec.kind === 'hero') return <HeroFigure appearance={spec.appearance} back={back} className={className} />;
  return <CreatureSprite family={spec.family} level={spec.level} boss={spec.boss} className={className} />;
}

/** A pair of googly eyes that don't match (the left one bigger), with zigzag brows when angry. */
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

/** Rubbery legs: a bent noodle with a round foot. */
function Legs({ y, xs, len = 14 }: { y: number; xs: number[]; len?: number }) {
  return (
    <>
      {xs.map((x, i) => {
        const d = `M${x} ${y} q${i ? 6 : -6} ${len * 0.5} 0 ${len}`;
        return (
          <g key={x}>
            <path className="s-limb-ink" d={d} strokeWidth="8" />
            <path className="s-limb s-arm" d={d} strokeWidth="4" />
            <ellipse className="s-ink-fill" cx={x + (i ? 4 : -4)} cy={y + len + 1} rx="7" ry="3.5" />
          </g>
        );
      })}
    </>
  );
}

/** A boss's mark: a lopsided crown bouncing on a spring above its head. */
const SpringCrown = ({ y = 6 }: { y?: number }) => (
  <g className="s-spring-crown">
    <path className="s-spring" d={`M60 ${y + 20} l-6 -3 l12 -3 l-12 -3 l12 -3 l-6 -3`} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    <path className="s-gold s-ink" d={`M42 ${y + 6} l4 -16 l7 9 l7 -13 l7 13 l7 -9 l4 16z`} strokeWidth="2.5" strokeLinejoin="round" transform={`rotate(-8 60 ${y})`} />
    <circle className="s-blush s-ink" cx="60" cy={y - 2} r="2.5" strokeWidth="1.5" transform={`rotate(-8 60 ${y})`} />
  </g>
);

function CreatureSprite({ family, level, boss, className }: { family: Family; level: number; boss: boolean; className: string }) {
  const style = { '--mon-body': `var(--mon-${((level * 3) % MON_COLOURS) + 1})` } as CSSProperties;
  return (
    <svg className={`sprite creature-sprite${boss ? ' boss' : ''} ${className}`} viewBox="0 0 120 120" style={style} aria-hidden="true">
      {family === 'clock' && <Clock boss={boss} />}
      {family === 'coin' && <Coin boss={boss} />}
      {family === 'card' && <Card boss={boss} />}
      {family === 'dice' && <Dice boss={boss} />}
      {family === 'wheel' && <Wheel boss={boss} />}
    </svg>
  );
}

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
};

function Clock({ boss }: { boss: boolean }) {
  return (
    <>
      <Legs y={96} xs={[46, 74]} />
      {!boss && (
        <>
          {/* Two alarm bells and the hammer between them. */}
          <path className="s-metal s-ink" d="M22 32 a14 14 0 0 1 22 -14z" strokeWidth="2.5" />
          <path className="s-metal s-ink" d="M98 32 a14 14 0 0 0 -22 -14z" strokeWidth="2.5" />
          <path className="s-ink" d="M60 22 v-10 M54 12 h12" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      <circle className="s-body s-ink" cx="60" cy="62" r="40" strokeWidth="3.5" />
      <circle className="s-face s-ink" cx="60" cy="62" r="30" strokeWidth="2.5" />
      {Array.from({ length: 12 }, (_, i) => {
        const [x1, y1] = polar(60, 62, 25, i * 30);
        const [x2, y2] = polar(60, 62, 29, i * 30);
        return <line key={i} className="s-tick" x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={i % 3 ? 1.5 : 3} />;
      })}
      <Eyes y={52} gap={11} size={7} angry={boss} />
      <Blush y={68} xs={[40, 80]} />
      <Grin y={70} w={24} />
      <path className="s-shine" d="M30 44 q8 -14 22 -18" fill="none" strokeWidth="4" strokeLinecap="round" />
      {boss && <SpringCrown y={-2} />}
    </>
  );
}

function Coin({ boss }: { boss: boolean }) {
  return (
    <>
      <Legs y={94} xs={[48, 72]} len={15} />
      {/* Arms flung up, mid-cheer. */}
      {[
        'M24 62 q-12 -4 -12 -18',
        'M96 62 q12 -4 12 -18',
      ].map((d) => (
        <g key={d}>
          <path className="s-limb-ink" d={d} strokeWidth="8" />
          <path className="s-limb s-arm" d={d} strokeWidth="4" />
        </g>
      ))}
      <ellipse className="s-shade" cx="65" cy="62" rx="38" ry="42" />
      <ellipse className="s-gold s-ink" cx="60" cy="60" rx="38" ry="42" strokeWidth="3.5" />
      <ellipse className="s-body-line" cx="60" cy="60" rx="30" ry="34" fill="none" strokeWidth="3" strokeDasharray="6 5" />
      <Eyes y={48} gap={13} size={8} angry={boss} />
      <Blush y={66} xs={[36, 84]} />
      <Grin y={66} w={34} />
      <path className="s-shine" d="M34 40 q6 -14 18 -20" fill="none" strokeWidth="4" strokeLinecap="round" />
      {boss && <SpringCrown y={-6} />}
    </>
  );
}

function Card({ boss }: { boss: boolean }) {
  return (
    <>
      <Legs y={100} xs={[46, 74]} len={10} />
      {/* Noodle arms waving about. */}
      {[
        'M30 62 q-16 4 -18 -12 q-1 -8 6 -10',
        'M90 62 q16 6 18 20 q1 8 -6 8',
      ].map((d) => (
        <g key={d}>
          <path className="s-limb-ink" d={d} strokeWidth="8" />
          <path className="s-limb s-arm" d={d} strokeWidth="4" />
        </g>
      ))}
      <rect className="s-shade" x="34" y="18" width="62" height="86" rx="10" transform="rotate(4 60 60)" />
      <g transform="rotate(4 60 60)">
        <rect className="s-face s-ink" x="29" y="14" width="62" height="86" rx="10" strokeWidth="3.5" />
        {/* A dog-eared corner, folded over. */}
        <path className="s-body s-ink" d="M75 14 h6 a10 10 0 0 1 10 10 v6 z" strokeWidth="2.5" />
        <path className="s-body" d="M40 24 q-6 7 0 11 q4 2 6 -1 l-2 5 h4 l-2 -5 q2 3 6 1 q6 -4 0 -11 l-6 -5z" />
        <path className="s-body" d="M80 90 q-6 -7 0 -11 q4 -2 6 1 l-2 -5 h4 l-2 5 q2 -3 6 -1 q6 4 0 11 l-6 5z" />
        {/* One big googly eye. */}
        <Googly x={60} y={46} r={14} />
        {boss && <path className="s-brow" d="M42 28 l6 4 l6 -3 l6 4 l6 -3 l6 4" fill="none" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}
        <Blush y={66} xs={[40, 80]} />
        <Grin y={70} w={30} />
      </g>
      {boss && <SpringCrown y={-8} />}
    </>
  );
}

function Dice({ boss }: { boss: boolean }) {
  return (
    <>
      <Legs y={98} xs={[42, 78]} len={12} />
      {/* An upright cube: the top, the front and its right side. */}
      <path className="s-face s-ink" d="M24 38 L60 22 L98 36 L62 52 Z" strokeWidth="3" strokeLinejoin="round" />
      <path className="s-body s-ink" d="M24 38 L62 52 L62 104 L24 90 Z" strokeWidth="3" strokeLinejoin="round" />
      <path className="s-body s-ink" d="M62 52 L98 36 L98 88 L62 104 Z" strokeWidth="3" strokeLinejoin="round" />
      <path className="s-shade" d="M62 52 L98 36 L98 88 L62 104 Z" />
      {[
        [48, 30],
        [61, 36],
        [74, 42],
      ].map(([x, y]) => (
        <ellipse key={x} className="s-pip" cx={x} cy={y} rx="3.5" ry="2" />
      ))}
      {/* The side's four pips are little googly eyes. */}
      {[
        [74, 60],
        [87, 54],
        [74, 82],
        [87, 76],
      ].map(([x, y], i) => (
        <Googly key={i} x={x} y={y} r={4.6} beat={i + 2} />
      ))}
      <Eyes cx={43} y={60} gap={9} size={6} angry={boss} />
      <Grin cx={43} y={76} w={20} />
      {boss && <SpringCrown y={-10} />}
    </>
  );
}

function Wheel({ boss }: { boss: boolean }) {
  const wedges = 10;
  return (
    <>
      {/* A unicycle wheel on its own little legs, arms out for balance. */}
      <Legs y={98} xs={[46, 74]} len={12} />
      {['M20 62 q-10 -2 -12 -14', 'M100 62 q10 -2 12 -14'].map((d) => (
        <g key={d}>
          <path className="s-limb-ink" d={d} strokeWidth="8" />
          <path className="s-limb s-arm" d={d} strokeWidth="4" />
        </g>
      ))}
      <circle className="s-ink-fill" cx="60" cy="60" r="46" />
      <circle className="s-metal s-ink" cx="60" cy="60" r="40" strokeWidth="2.5" />
      {Array.from({ length: wedges }, (_, i) => {
        const [x1, y1] = polar(60, 60, 35, (i * 360) / wedges);
        const [x2, y2] = polar(60, 60, 35, ((i + 1) * 360) / wedges);
        return <path key={i} className={i % 2 ? 's-face' : 's-body'} d={`M60 60 L${x1} ${y1} A35 35 0 0 1 ${x2} ${y2} Z`} />;
      })}
      <circle className="s-face s-ink" cx="60" cy="60" r="24" strokeWidth="3" />
      <Eyes y={54} gap={9} size={6} angry={boss} />
      <Grin y={64} w={22} />
      <path className="s-shine" d="M28 40 q8 -14 22 -18" fill="none" strokeWidth="4" strokeLinecap="round" />
      {boss && <SpringCrown y={-10} />}
    </>
  );
}

/** A creature's head-and-shoulders for lists (the bot ladder). */
export function CreatureThumb({ family, level, boss }: { family: Family; level: number; boss: boolean }) {
  return <CreatureSprite family={family} level={level} boss={boss} className="thumb" />;
}
