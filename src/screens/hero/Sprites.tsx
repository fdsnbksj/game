import type { CSSProperties } from 'react';
import type { Appearance } from '../../games/hero/look';
import type { Family } from '../../games/hero/monsters';
import { HeroFigure } from './Avatar';

// The fighters as drawn on the battlefield: your hero from behind, an opponent hero from
// the front (both Avatar.tsx), and the bot ladder's creatures in five families (clocks, coins, cards, dice
// and wheels): gross sci-fi critters with bulgy eyes, drool and goo, each level its own colour,
// bosses wearing a brain under a glass dome. Our own art; colours are tokens.

export type SpriteSpec = { kind: 'hero'; appearance: Appearance } | { kind: 'creature'; family: Family; level: number; boss: boolean };

const MON_COLOURS = 8;

export function Sprite({ spec, back = false, className = '' }: { spec: SpriteSpec; back?: boolean; className?: string }) {
  if (spec.kind === 'hero') return <HeroFigure appearance={spec.appearance} back={back} className={className} />;
  return <CreatureSprite family={spec.family} level={spec.level} boss={spec.boss} className={className} />;
}

/** Bulgy eyes that don't match: the left one bigger, tiny pupils looking two ways at once. */
function Eyes({ y, gap = 12, cx = 60, size = 7, angry }: { y: number; gap?: number; cx?: number; size?: number; angry: boolean }) {
  return (
    <g>
      {[-1, 1].map((side) => {
        const r = side < 0 ? size * 1.2 : size * 0.9;
        const x = cx + side * gap;
        return (
          <g key={side}>
            <circle className="s-eye s-ink" cx={x} cy={y} r={r} strokeWidth="2" />
            <circle className="s-pupil" cx={x + side * r * 0.35} cy={y + (side < 0 ? r * 0.2 : -r * 0.25)} r={Math.max(1.4, size * 0.22)} />
            {angry && <path className="s-brow" d={`M${x + side * (r + 3)} ${y - r - 6} L${x - side * (r - 2)} ${y - r + 1}`} strokeWidth="3" strokeLinecap="round" />}
          </g>
        );
      })}
    </g>
  );
}

/** One big eye, for the cyclops families. */
function BigEye({ cx = 60, cy, r }: { cx?: number; cy: number; r: number }) {
  return (
    <g>
      <circle className="s-eye s-ink" cx={cx} cy={cy} r={r} strokeWidth="2.5" />
      <path className="s-vein" d={`M${cx - r * 0.9} ${cy + 2} q${r * 0.3} -2 ${r * 0.45} 1 M${cx + r * 0.9} ${cy - 3} q${-r * 0.3} 1 ${-r * 0.4} 3`} fill="none" strokeWidth="1" />
      <circle className="s-pupil" cx={cx + r * 0.2} cy={cy + r * 0.1} r={r * 0.22} />
    </g>
  );
}

/** A string of drool from a mouth corner. */
const Drool = ({ x, y }: { x: number; y: number }) => <path className="s-drool" d={`M${x} ${y} q2 7 0.5 11 q-2 2 -3.5 0 q-0.5 -4 3 -11z`} />;

/** Goo dripping off a body's bottom edge, in the body's colour. */
const Drips = ({ y, xs }: { y: number; xs: number[] }) => (
  <>
    {xs.map((x, i) => (
      <path key={x} className="s-body s-ink" d={`M${x - 4} ${y} q0 ${8 + (i % 2) * 6} 4 ${8 + (i % 2) * 6} q4 0 4 ${-8 - (i % 2) * 6}`} strokeWidth="2" />
    ))}
  </>
);

/** A boss's mark: a big brain under a glass dome, floating above it. */
const Dome = ({ y = 6 }: { y?: number }) => (
  <g>
    <path className="s-brain s-ink" d={`M44 ${y + 16} q-4 -10 6 -13 q2 -6 10 -4 q8 -4 12 3 q10 1 6 14z`} strokeWidth="2" />
    <path className="s-mouth" d={`M50 ${y + 9} q3 3 6 0 M60 ${y + 5} q2 4 6 2 M66 ${y + 12} q3 -2 5 1`} fill="none" strokeWidth="1.5" strokeLinecap="round" />
    <path className="s-dome s-ink" d={`M38 ${y + 17} a22 20 0 0 1 44 0z`} strokeWidth="2" />
    <path className="s-shine" d={`M46 ${y + 4} q4 -5 10 -6`} fill="none" strokeWidth="2.5" strokeLinecap="round" />
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
      <rect className="s-ink-fill" x="42" y="96" width="9" height="14" rx="3" />
      <rect className="s-ink-fill" x="69" y="96" width="9" height="14" rx="3" />
      {!boss && (
        <>
          <circle className="s-metal s-ink" cx="34" cy="26" r="10" />
          <circle className="s-metal s-ink" cx="86" cy="26" r="10" />
        </>
      )}
      <Drips y={96} xs={[42, 58, 76]} />
      <circle className="s-body s-ink" cx="60" cy="62" r="40" />
      <circle className="s-face s-ink" cx="60" cy="62" r="30" />
      {Array.from({ length: 12 }, (_, i) => {
        const [x1, y1] = polar(60, 62, 26, i * 30);
        const [x2, y2] = polar(60, 62, 30, i * 30);
        return <line key={i} className="s-tick" x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={i % 3 ? 1.5 : 3} />;
      })}
      <Eyes y={55} gap={11} size={6} angry={boss} />
      <path className="s-hand" d="M60 68 L60 62 M60 68 L67 72" strokeWidth="3" strokeLinecap="round" />
      <circle className="s-ink-fill" cx="60" cy="68" r="2.5" />
      {/* A slack mouth, tongue out. */}
      <path className="s-ink-fill" d="M48 78 q12 8 24 0 q-12 4 -24 0z" />
      <path className="s-tongue s-ink" d="M60 81 q0 9 5 9 q5 0 4 -10z" strokeWidth="2" />
      <path className="s-shine" d="M32 44 q8 -14 22 -18" fill="none" strokeWidth="4" strokeLinecap="round" />
      {boss && <Dome y={-6} />}
    </>
  );
}

function Star({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const points = Array.from({ length: 10 }, (_, i) => polar(cx, cy, i % 2 ? r * 0.45 : r, i * 36).join(' ')).join(' L');
  return <path className="s-body" d={`M${points}Z`} />;
}

function Coin({ boss }: { boss: boolean }) {
  return (
    <>
      <path className="s-ink" d="M22 66 l-10 -8 M98 66 l10 -8" strokeWidth="4" strokeLinecap="round" />
      <rect className="s-ink-fill" x="46" y="98" width="8" height="12" rx="3" />
      <rect className="s-ink-fill" x="66" y="98" width="8" height="12" rx="3" />
      <ellipse className="s-shade" cx="64" cy="62" rx="38" ry="42" />
      <Drips y={92} xs={[40, 80]} />
      <ellipse className="s-gold s-ink" cx="60" cy="60" rx="38" ry="42" />
      <ellipse className="s-body-line" cx="60" cy="60" rx="30" ry="34" fill="none" strokeWidth="3" />
      <Star cx={60} cy={86} r={8} />
      <Eyes y={52} gap={12} size={7} angry={boss} />
      <path className="s-mouth" d="M48 68 q5 6 10 1 t12 1" fill="none" strokeWidth="3" strokeLinecap="round" />
      <Drool x={68} y={70} />
      <path className="s-shine" d="M34 40 q6 -14 18 -20" fill="none" strokeWidth="4" strokeLinecap="round" />
      {boss && <Dome y={-8} />}
    </>
  );
}

function Card({ boss }: { boss: boolean }) {
  return (
    <>
      <path className="s-body s-ink" d="M60 6 Q76 14 80 24 L44 24 Q50 12 60 6z" />
      <rect className="s-shade" x="32" y="22" width="64" height="86" rx="9" />
      <rect className="s-face s-ink" x="28" y="18" width="64" height="86" rx="9" />
      <path className="s-body" d="M40 28 q-6 7 0 11 q4 2 6 -1 l-2 5 h4 l-2 -5 q2 3 6 1 q6 -4 0 -11 l-6 -5z" />
      <path className="s-body" d="M80 94 q-6 -7 0 -11 q4 -2 6 1 l-2 -5 h4 l-2 5 q2 -3 6 -1 q6 4 0 11 l-6 5z" />
      <path className="s-ink" d="M92 60 q16 -2 18 12 q2 12 -8 12 q-6 0 -6 -6 q0 -4 4 -4 q3 0 3 3" fill="none" strokeWidth="8" strokeLinecap="round" />
      <path className="s-tentacle" d="M92 60 q16 -2 18 12 q2 12 -8 12 q-6 0 -6 -6 q0 -4 4 -4 q3 0 3 3" fill="none" strokeWidth="4" strokeLinecap="round" />
      <BigEye cy={52} r={13} />
      {boss && <path className="s-brow" d="M44 34 L76 40" strokeWidth="4" strokeLinecap="round" />}
      <path className="s-teeth s-ink" d="M42 72 h36 l-4 8 -4 -6 -4 6 -4 -6 -4 6 -4 -6 -4 6 -4 -6z" strokeWidth="2" />
      <Drool x={72} y={77} />
      {boss && <Dome y={-10} />}
    </>
  );
}

function Dice({ boss }: { boss: boolean }) {
  return (
    <>
      <rect className="s-ink-fill" x="38" y="100" width="9" height="11" rx="3" />
      <rect className="s-ink-fill" x="72" y="100" width="9" height="11" rx="3" />
      {/* An upright cube: the top, the front and its right side. */}
      <path className="s-face s-ink" d="M24 38 L60 22 L98 36 L62 52 Z" />
      <path className="s-body s-ink" d="M24 38 L62 52 L62 104 L24 90 Z" />
      <path className="s-body s-ink" d="M62 52 L98 36 L98 88 L62 104 Z" />
      <path className="s-shade" d="M62 52 L98 36 L98 88 L62 104 Z" />
      {[
        [48, 30],
        [61, 36],
        [74, 42],
      ].map(([x, y]) => (
        <ellipse key={x} className="s-pip" cx={x} cy={y} rx="3.5" ry="2" />
      ))}
      {[
        [74, 60],
        [86, 54],
        [74, 80],
        [86, 74],
      ].map(([x, y]) => (
        <g key={x * 100 + y}>
          <circle className="s-eye s-ink" cx={x} cy={y} r="4.2" strokeWidth="1.5" />
          <circle className="s-pupil" cx={x + ((x + y) % 3) - 1} cy={y + 1} r="1.4" />
        </g>
      ))}
      <Eyes cx={43} y={62} gap={9} size={6} angry={boss} />
      <path className="s-mouth" d="M33 79 q9 8 19 3" fill="none" strokeWidth="3" strokeLinecap="round" />
      <Drool x={48} y={82} />
      {boss && <Dome y={-10} />}
    </>
  );
}

function Wheel({ boss }: { boss: boolean }) {
  const wedges = 10;
  return (
    <>
      <path className="s-ink" d="M22 64 l-12 10 M98 64 l12 10" strokeWidth="4" strokeLinecap="round" />
      <rect className="s-ink-fill" x="44" y="98" width="9" height="12" rx="3" />
      <rect className="s-ink-fill" x="67" y="98" width="9" height="12" rx="3" />
      {Array.from({ length: 16 }, (_, i) => {
        const [x1, y1] = polar(60, 60, 41, i * 22.5 - 6);
        const [x2, y2] = polar(60, 60, 50, i * 22.5);
        const [x3, y3] = polar(60, 60, 41, i * 22.5 + 6);
        return <path key={i} className="s-teeth s-ink" d={`M${x1} ${y1} L${x2} ${y2} L${x3} ${y3}Z`} strokeWidth="1.5" />;
      })}
      <circle className="s-metal s-ink" cx="60" cy="60" r="42" />
      {Array.from({ length: wedges }, (_, i) => {
        const [x1, y1] = polar(60, 60, 35, (i * 360) / wedges);
        const [x2, y2] = polar(60, 60, 35, ((i + 1) * 360) / wedges);
        return <path key={i} className={i % 2 ? 's-ink-fill' : 's-body'} d={`M60 60 L${x1} ${y1} A35 35 0 0 1 ${x2} ${y2} Z`} />;
      })}
      <circle className="s-face s-ink" cx="60" cy="60" r="18" />
      {/* One big eye in the hub. */}
      <BigEye cy={60} r={12} />
      {boss && <path className="s-brow" d="M47 44 L73 50" strokeWidth="4" strokeLinecap="round" />}
      <circle className="s-pip" cx="60" cy="22" r="4" />
      <path className="s-shine" d="M30 40 q8 -14 22 -18" fill="none" strokeWidth="4" strokeLinecap="round" />
      {boss && <Dome y={-10} />}
    </>
  );
}

/** A creature's head-and-shoulders for lists (the bot ladder). */
export function CreatureThumb({ family, level, boss }: { family: Family; level: number; boss: boolean }) {
  return <CreatureSprite family={family} level={level} boss={boss} className="thumb" />;
}
