import type { CSSProperties } from 'react';
import type { Family } from '../../games/hero/monsters';

// The fighters as drawn on the battlefield: your hero from behind, an opponent hero from
// the front, and the bot ladder's creatures in five families (clocks, coins, cards, dice
// and wheels), each level its own colour, bosses crowned. Our own art; colours are tokens.

export type SpriteSpec = { kind: 'hero' } | { kind: 'creature'; family: Family; level: number; boss: boolean };

const MON_COLOURS = 8;

export function Sprite({ spec, back = false, className = '' }: { spec: SpriteSpec; back?: boolean; className?: string }) {
  if (spec.kind === 'hero') return <HeroSprite back={back} className={className} />;
  return <CreatureSprite family={spec.family} level={spec.level} boss={spec.boss} className={className} />;
}

function HeroSprite({ back, className }: { back: boolean; className: string }) {
  return (
    <svg className={`sprite hero-sprite ${className}`} viewBox="0 0 120 120" aria-hidden="true">
      {back ? (
        <>
          {/* A sword across the back. */}
          <path className="s-blade" d="M86 14 L46 70" strokeWidth="5" strokeLinecap="round" />
          <path className="s-gold" d="M80 16 l10 7 -3 4 -10 -7z" />
          <path className="s-cape s-ink" d="M38 52 Q60 44 82 52 L94 112 Q60 118 26 112 Z" />
          <path className="s-shade" d="M60 50 L60 115 Q44 116 26 112 L38 52 Q50 47 60 50z" />
          <path className="s-gold" d="M34 54 Q60 46 86 54 L84 60 Q60 52 36 60z" />
          <circle className="s-skin s-ink" cx="44" cy="38" r="4" />
          <circle className="s-skin s-ink" cx="76" cy="38" r="4" />
          <circle className="s-hair s-ink" cx="60" cy="34" r="17" />
          <path className="s-shine" d="M50 24 q8 -6 18 -2" fill="none" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path className="s-cape s-ink" d="M36 50 Q60 42 84 50 L96 108 Q60 112 24 108 Z" />
          <rect className="s-boots s-ink" x="47" y="94" width="10" height="16" rx="3" />
          <rect className="s-boots s-ink" x="63" y="94" width="10" height="16" rx="3" />
          <path className="s-armor s-ink" d="M44 52 Q60 46 76 52 L74 98 Q60 102 46 98 Z" />
          <path className="s-gold" d="M46 72 h28 v5 h-28z" />
          <path className="s-blade" d="M84 60 L98 26" strokeWidth="4" strokeLinecap="round" />
          <path className="s-gold" d="M79 62 l12 4 -1 4 -12 -4z" />
          <circle className="s-skin s-ink" cx="60" cy="34" r="15" />
          <path className="s-hair s-ink" d="M44 33 Q46 16 60 16 Q75 16 76 33 Q70 24 60 25 Q50 24 44 33z" />
          <ellipse className="s-pupil" cx="54" cy="36" rx="2" ry="3" />
          <ellipse className="s-pupil" cx="66" cy="36" rx="2" ry="3" />
          <path className="s-mouth" d="M55 43 q5 3 10 0" fill="none" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function Eyes({ y, gap = 12, cx = 60, size = 7, angry }: { y: number; gap?: number; cx?: number; size?: number; angry: boolean }) {
  return (
    <g>
      {[-1, 1].map((side) => (
        <g key={side}>
          <ellipse className="s-eye s-ink" cx={cx + side * gap} cy={y} rx={size * 0.8} ry={size} />
          <ellipse className="s-pupil" cx={cx + side * gap - side * 1.5} cy={y + 1.5} rx={size * 0.38} ry={size * 0.5} />
          {angry && <path className="s-brow" d={`M${cx + side * (gap + size)} ${y - size - 5} L${cx + side * (gap - size + 2)} ${y - size + 1}`} strokeWidth="3" strokeLinecap="round" />}
        </g>
      ))}
    </g>
  );
}

const Crown = ({ y = 6 }: { y?: number }) => (
  <path className="s-gold s-ink" d={`M42 ${y + 16} L44 ${y} L52 ${y + 9} L60 ${y - 3} L68 ${y + 9} L76 ${y} L78 ${y + 16} Z`} />
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
      <circle className="s-body s-ink" cx="60" cy="62" r="40" />
      <circle className="s-face s-ink" cx="60" cy="62" r="30" />
      {Array.from({ length: 12 }, (_, i) => {
        const [x1, y1] = polar(60, 62, 26, i * 30);
        const [x2, y2] = polar(60, 62, 30, i * 30);
        return <line key={i} className="s-tick" x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={i % 3 ? 1.5 : 3} />;
      })}
      <Eyes y={55} gap={11} size={6} angry={boss} />
      <path className="s-hand" d="M60 74 L60 66 M60 74 L70 80" strokeWidth="3" strokeLinecap="round" />
      <circle className="s-ink-fill" cx="60" cy="74" r="2.5" />
      <path className="s-shine" d="M32 44 q8 -14 22 -18" fill="none" strokeWidth="4" strokeLinecap="round" />
      {boss && <Crown y={4} />}
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
      <ellipse className="s-gold s-ink" cx="60" cy="60" rx="38" ry="42" />
      <ellipse className="s-body-line" cx="60" cy="60" rx="30" ry="34" fill="none" strokeWidth="3" />
      <Star cx={60} cy={86} r={8} />
      <Eyes y={52} gap={12} size={7} angry={boss} />
      <path className="s-mouth" d="M50 68 q10 7 20 0" fill="none" strokeWidth="3" strokeLinecap="round" />
      <path className="s-shine" d="M34 40 q6 -14 18 -20" fill="none" strokeWidth="4" strokeLinecap="round" />
      {boss && <Crown y={2} />}
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
      <Eyes y={54} gap={12} size={7} angry={boss} />
      <path className="s-teeth s-ink" d="M42 72 h36 l-4 8 -4 -6 -4 6 -4 -6 -4 6 -4 -6 -4 6 -4 -6z" strokeWidth="2" />
      {boss && <Crown y={0} />}
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
        <circle key={x * 100 + y} className="s-pip" cx={x} cy={y} r="3" />
      ))}
      <Eyes cx={43} y={62} gap={9} size={6} angry={boss} />
      <path className="s-mouth" d="M34 80 q9 7 18 4" fill="none" strokeWidth="3" strokeLinecap="round" />
      {boss && <Crown y={0} />}
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
      <circle className="s-metal s-ink" cx="60" cy="60" r="42" />
      {Array.from({ length: wedges }, (_, i) => {
        const [x1, y1] = polar(60, 60, 35, (i * 360) / wedges);
        const [x2, y2] = polar(60, 60, 35, ((i + 1) * 360) / wedges);
        return <path key={i} className={i % 2 ? 's-ink-fill' : 's-body'} d={`M60 60 L${x1} ${y1} A35 35 0 0 1 ${x2} ${y2} Z`} />;
      })}
      <circle className="s-face s-ink" cx="60" cy="60" r="18" />
      {/* One big eye in the hub. */}
      <ellipse className="s-eye s-ink" cx="60" cy="60" rx="11" ry="12" />
      <ellipse className="s-pupil" cx="60" cy="62" rx="5" ry="6" />
      {boss && <path className="s-brow" d="M47 44 L73 50" strokeWidth="4" strokeLinecap="round" />}
      <circle className="s-pip" cx="60" cy="22" r="4" />
      <path className="s-shine" d="M30 40 q8 -14 22 -18" fill="none" strokeWidth="4" strokeLinecap="round" />
      {boss && <Crown y={0} />}
    </>
  );
}

/** A creature's head-and-shoulders for lists (the bot ladder). */
export function CreatureThumb({ family, level, boss }: { family: Family; level: number; boss: boolean }) {
  return <CreatureSprite family={family} level={level} boss={boss} className="thumb" />;
}
