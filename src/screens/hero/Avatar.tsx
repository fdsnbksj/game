import type { CSSProperties, ReactNode } from 'react';
import { EXTRAS, FACES, HAIRS, HATS, PANTS, SHIRTS, type Appearance, type Look } from '../../games/hero/look';
import { Costume } from './Costumes';
import { Googly } from './Googly';

// Your hero as drawn everywhere: a round little gardener with big eyes, short rubbery limbs,
// green gardening gloves and, with no hat on, a sprout growing from the head, built from the parts in
// src/games/hero/look.ts, from the front or (in a fight, where you stand with your back to
// us) from behind. A costume, if worn, is drawn instead (Costumes.tsx). Our own art;
// colours are the --av-* tokens in src/index.css.

const skin = (n: number): CSSProperties => ({ fill: `var(--av-skin-${n + 1})` });
const cloth = (n: number): CSSProperties => ({ fill: `var(--av-c-${n + 1})` });

export function HeroFigure({ appearance, back = false, className = '' }: { appearance: Appearance; back?: boolean; className?: string }) {
  return (
    <svg className={`sprite hero-sprite ${className}`} viewBox="0 0 120 120" aria-hidden="true">
      {appearance.costume ? <Costume id={appearance.costume} back={back} /> : <Gardener look={appearance.look} back={back} />}
    </svg>
  );
}

function Gardener({ look, back }: { look: Look; back: boolean }) {
  const hat = HATS[look.hat].id;
  const hair = HAIRS[look.hair].id;
  const extra = EXTRAS[look.extra].id;
  const shirt = SHIRTS[look.shirt].id;
  const shorts = PANTS[look.pants].id === 'shorts';
  const s = skin(look.skin);
  const shirtFill = shirt === 'armour' ? { fill: 'var(--mon-metal)' } : cloth(look.shirtColour);
  const hairFill = cloth(look.hairColour);
  const shirtLine = { stroke: shirtFill.fill };
  const skinLine = { stroke: s.fill };
  const pantsLine = { stroke: shorts ? s.fill : cloth(look.pantsColour).fill };

  return (
    <g className="s-ink-lines">
      {/* Behind the body: wings and a cape (in front of it from behind). */}
      {extra === 'wings' && <Wings />}
      {extra === 'cape' && !back && <path style={{ fill: 'var(--av-cape)' }} d="M40 56 L80 56 L92 108 L28 108 Z" />}
      {extra === 'sword' && !back && <path className="s-blade" d="M88 22 L74 50" strokeWidth="4" strokeLinecap="round" />}
      {hair === 'long' && <path style={hairFill} d="M40 30 q0 -14 20 -14 q20 0 20 14 v28 q-20 6 -40 0z" />}
      {hair === 'ponytail' && <path style={hairFill} d={back ? 'M56 30 h8 q6 14 0 30 h-8 q-6 -16 0 -30z' : 'M76 28 q10 10 4 30 q-6 -4 -8 -12z'} />}
      {shirt === 'hoodie' && <path style={shirtFill} d="M36 40 q0 -26 24 -26 q24 0 24 26 v8 q-4 8 -12 8 h-24 q-8 0 -12 -8z" />}

      {/* Legs: two short rubbery noodles, then big round shoes. */}
      <Noodle d="M53 86 q-4 8 -3 17" line={pantsLine} />
      <Noodle d="M67 86 q4 8 3 17" line={pantsLine} />
      {shorts && (
        <>
          <Noodle d="M53 86 q-1 3 -1.5 5" line={{ stroke: cloth(look.pantsColour).fill }} wide />
          <Noodle d="M67 86 q1 3 1.5 5" line={{ stroke: cloth(look.pantsColour).fill }} wide />
        </>
      )}
      <ellipse className="s-ink-fill" cx="47" cy="106" rx="9.5" ry="5" />
      <ellipse className="s-ink-fill" cx="73" cy="106" rx="9.5" ry="5" />

      {/* Arms: short rubbery noodles flung out, sleeves, then mitten hands. */}
      <Noodle d="M45 60 q-10 4 -13 18" line={shirt === 'tee' ? skinLine : shirtLine} />
      <Noodle d="M75 60 q10 4 13 18" line={shirt === 'tee' ? skinLine : shirtLine} />
      {shirt === 'tee' && (
        <>
          <Noodle d="M45 60 q-5 2 -7 6" line={shirtLine} wide />
          <Noodle d="M75 60 q5 2 7 6" line={shirtLine} wide />
        </>
      )}
      {/* Gardening gloves. */}
      <circle className="s-glove s-ink" cx="31" cy="80" r="6" strokeWidth="2.5" />
      <circle className="s-glove s-ink" cx="89" cy="80" r="6" strokeWidth="2.5" />

      {/* A round bean of a body, no neck to speak of. */}
      <path style={shirtFill} d="M45 52 q15 -6 30 0 q9 4 9 20 q0 19 -24 19 q-24 0 -24 -19 q0 -16 9 -20z" />
      {shirt === 'jacket' && !back && <path style={{ fill: 'var(--av-inner)' }} d="M57 51 L63 51 L62 90 L58 90 Z" />}
      {shirt === 'hoodie' && !back && <rect className="s-shade" x="50" y="74" width="20" height="9" rx="4" />}
      {shirt === 'armour' && <path className="s-shade" d="M40 66 h40 M38 77 h44 M60 52 v38" fill="none" strokeWidth="2" style={{ stroke: 'var(--mon-ink)' }} />}
      {extra === 'scarf' && <rect style={{ fill: 'var(--av-scarf)' }} x="42" y="48" width="36" height="9" rx="4" />}
      {extra === 'cape' && back && <path style={{ fill: 'var(--av-cape)' }} d="M40 52 L80 52 L92 110 L28 110 Z" />}
      {extra === 'sword' && back && (
        <>
          <path className="s-blade" d="M84 26 L40 92" strokeWidth="5" strokeLinecap="round" />
          <path className="s-gold" d="M79 30 l10 6 -3 4 -10 -6z" />
        </>
      )}

      {/* A sprout on top when there's no hat, its stem tucked behind the head and hair. */}
      {hat === 'none' && <Sprout />}
      {/* The head: a big round one, little ears, big round eyes. */}
      <circle style={s} cx="38.5" cy="36" r="4" />
      <circle style={s} cx="81.5" cy="36" r="4" />
      <ellipse style={s} cx="60" cy="33" rx="22" ry="20" />
      {back ? hair !== 'none' && <path style={hairFill} d="M40 34 a20 19 0 0 1 40 0 v8 q-20 7 -40 0z" /> : <Face face={FACES[look.face].id} />}
      {!back && <Hair id={hair} fill={hairFill} />}
      {back && hair === 'bun' && <circle style={hairFill} cx="60" cy="12" r="8" />}
      {back && hair === 'mohawk' && <rect style={hairFill} x="56" y="4" width="8" height="40" rx="3" />}
      {back && hair === 'spiky' && <path style={hairFill} d="M42 22 l6 -12 6 10 6 -12 6 12 6 -10 6 12z" />}
      {extra === 'headphones' && (
        <>
          <path d="M40 30 Q60 4 80 30" fill="none" strokeWidth="4" style={{ stroke: 'var(--av-phones)' }} />
          <rect style={{ fill: 'var(--av-phones)' }} x="35" y="27" width="9" height="15" rx="3" />
          <rect style={{ fill: 'var(--av-phones)' }} x="76" y="27" width="9" height="15" rx="3" />
        </>
      )}
      {extra === 'sunglasses' && !back && <path className="s-ink-fill" d="M43 26 h15 v7 q-7 6 -15 0z M62 26 h15 v7 q-8 6 -15 0z M58 28 h4 v2 h-4z" />}
      <Hat id={hat} />
    </g>
  );
}

/** A rubbery limb: a round-capped stroke in its colour over a wider one in ink, so it's outlined. */
function Noodle({ d, line, wide = false }: { d: string; line: CSSProperties; wide?: boolean }) {
  return (
    <>
      <path className="s-limb-ink" d={d} strokeWidth={wide ? 15 : 12} />
      <path className="s-limb" d={d} style={line} strokeWidth={wide ? 10 : 7} />
    </>
  );
}

function Face({ face }: { face: string }) {
  // Googly eyes that never quite agree, the left one a little bigger.
  const left = (r = 7.5) => <Googly x={51} y={29} r={r} beat={0} ring={2} />;
  const right = (r = 6.4) => <Googly x={69} y={29.5} r={r} beat={1} ring={2} />;
  const spiral = (cx: number) => (
    <>
      <circle className="s-eye s-ink" cx={cx} cy="29.5" r="6.8" strokeWidth="2" />
      <path className="s-mouth" d={`M${cx} 29.5 a1.5 1.5 0 1 1 2 1.5 a3.5 3.5 0 1 1 -5 -4 a5 5 0 1 1 7.5 6`} fill="none" strokeWidth="1.4" strokeLinecap="round" />
    </>
  );
  const eyes: ReactNode =
    face === 'cool' ? (
      <path className="s-ink-fill" d="M42 25 h16 v7 q-8 6 -16 0z M62 25 h16 v7 q-8 6 -16 0z M58 27 h4 v2 h-4z" />
    ) : face === 'wink' ? (
      <>
        {left()}
        <path className="s-mouth" d="M63 31 q6 -5 12 0" fill="none" strokeWidth="2.5" strokeLinecap="round" />
      </>
    ) : face === 'sleepy' ? (
      <>
        {spiral(51)}
        {spiral(69)}
      </>
    ) : face === 'angry' ? (
      <>
        {left()}
        {right()}
        {/* Zigzag brows, pointing down to the middle. */}
        <path className="s-mouth" d="M42 18 l4 3 l4 -2 l6 5 M78 18 l-4 3 l-4 -2 l-6 5" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ) : face === 'surprised' ? (
      <>
        {left(9)}
        {right(8)}
      </>
    ) : (
      <>
        {left()}
        {right()}
      </>
    );
  const mouth =
    face === 'grin' ? (
      <>
        <path className="s-ink-fill" d="M46 40 h28 q-2 12 -14 12 q-12 0 -14 -12z" />
        <path className="s-teeth s-ink" d="M47 40 h26 v4 h-26z" strokeWidth="1.5" />
        <path className="s-mouth" d="M53.5 40 v4 M60 40 v4 M66.5 40 v4" strokeWidth="1.2" />
        <path className="s-blush" d="M54 49 q6 -4 12 0 q-6 2 -12 0z" />
      </>
    ) : face === 'surprised' ? (
      <ellipse className="s-ink-fill" cx="60" cy="46" rx="5" ry="6" />
    ) : face === 'smirk' ? (
      <path className="s-mouth" d="M52 45 q9 3 15 -5" fill="none" strokeWidth="2.6" strokeLinecap="round" />
    ) : face === 'angry' ? (
      <path className="s-mouth" d="M50 47 l4 -3 l4 3 l4 -3 l4 3 l4 -3" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    ) : face === 'sleepy' ? (
      <path className="s-mouth" d="M53 45 q3.5 -3 7 0 t7 0" fill="none" strokeWidth="2.4" strokeLinecap="round" />
    ) : (
      <>
        {/* A big open "D" of a smile with a tongue in it. */}
        <path className="s-ink-fill" d="M49 40 q11 14 22 0z" />
        <path className="s-blush" d="M54.5 45.5 q5.5 -4 11 0 q-5.5 3 -11 0z" />
      </>
    );
  return (
    <>
      {eyes}
      {mouth}
    </>
  );
}

function Hair({ id, fill }: { id: string; fill: CSSProperties }) {
  switch (id) {
    case 'short':
      return <path style={fill} d="M42 26 v-4 q0 -8 8 -8 h20 q8 0 8 8 v4 q-4 -6 -18 -6 q-14 0 -18 6z" />;
    case 'spiky':
      return <path style={fill} d="M41 26 l4 -16 7 8 8 -12 8 12 7 -8 4 16 q-18 -8 -38 0z" />;
    case 'bob':
      return <path style={fill} d="M40 44 v-22 q0 -9 9 -9 h22 q9 0 9 9 v22 h-6 v-18 q-14 -4 -28 0 v18z" />;
    case 'long':
      return <path style={fill} d="M40 54 v-32 q0 -9 9 -9 h22 q9 0 9 9 v32 h-6 v-28 q-14 -4 -28 0 v28z" />;
    case 'curly':
      return (
        <g style={fill}>
          {[44, 52, 60, 68, 76].map((x) => (
            <circle key={x} cx={x} cy={x % 8 ? 16 : 14} r="7" />
          ))}
          <circle cx="41" cy="24" r="5" />
          <circle cx="79" cy="24" r="5" />
        </g>
      );
    case 'bun':
      return (
        <>
          <circle style={fill} cx="60" cy="11" r="8" />
          <path style={fill} d="M42 26 v-4 q0 -8 8 -8 h20 q8 0 8 8 v4 q-18 -6 -36 0z" />
        </>
      );
    case 'mohawk':
      return <rect style={fill} x="55" y="4" width="10" height="16" rx="3" />;
    case 'ponytail':
      return <path style={fill} d="M42 26 v-4 q0 -8 8 -8 h20 q8 0 8 8 v4 q-18 -6 -36 0z" />;
    default:
      return null;
  }
}

function Hat({ id }: { id: string }) {
  switch (id) {
    case 'cap':
      return <path style={{ fill: 'var(--av-hat)' }} d="M40 22 q0 -12 20 -12 q20 0 20 12z M76 20 h16 v4 h-16z" />;
    case 'beanie':
      return (
        <>
          <path style={{ fill: 'var(--av-hat)' }} d="M40 24 q0 -18 20 -18 q20 0 20 18z" />
          <circle style={{ fill: 'var(--av-hat)' }} cx="60" cy="6" r="4" />
        </>
      );
    case 'bandana':
      return <path style={{ fill: 'var(--av-bandana)' }} d="M41 24 q19 -10 38 0 v-4 q-19 -10 -38 0z M78 22 l10 4 -8 4z" />;
    case 'crown':
      return <path className="s-gold" d="M44 18 L46 4 L53 12 L60 2 L67 12 L74 4 L76 18 Z" />;
    case 'tophat':
      return (
        <>
          <rect className="s-ink-fill" x="36" y="14" width="48" height="5" rx="2" />
          <rect className="s-ink-fill" x="46" y="-6" width="28" height="22" rx="2" />
          <rect style={{ fill: 'var(--av-c-1)' }} x="46" y="10" width="28" height="4" />
        </>
      );
    case 'viking':
      return (
        <>
          <path style={{ fill: 'var(--mon-metal)' }} d="M40 24 q0 -16 20 -16 q20 0 20 16z" />
          <path style={{ fill: 'var(--mon-face)' }} d="M40 18 q-8 -4 -8 -16 q6 8 12 10z M80 18 q8 -4 8 -16 q-6 8 -12 10z" />
        </>
      );
    case 'halo':
      return <ellipse cx="60" cy="6" rx="16" ry="4" fill="none" strokeWidth="3" style={{ stroke: 'var(--accent)' }} />;
    case 'catears':
      return <path style={{ fill: 'var(--av-hat)' }} d="M42 18 l2 -14 10 10z M78 18 l-2 -14 -10 10z" />;
    case 'propeller':
      return (
        <>
          <path style={{ fill: 'var(--av-c-5)' }} d="M40 22 q0 -12 20 -12 q20 0 20 12z" />
          <path style={{ fill: 'var(--av-c-1)' }} d="M60 10 v-4 M46 4 h28 v3 h-28z" />
        </>
      );
    case 'wizard':
      return <path style={{ fill: 'var(--av-c-9)' }} d="M36 22 h48 l-4 -4 L62 -10 L44 18z" />;
    case 'chef':
      return (
        <>
          <rect style={{ fill: 'var(--mon-eye)' }} x="44" y="10" width="32" height="10" />
          <circle style={{ fill: 'var(--mon-eye)' }} cx="48" cy="6" r="8" />
          <circle style={{ fill: 'var(--mon-eye)' }} cx="60" cy="2" r="9" />
          <circle style={{ fill: 'var(--mon-eye)' }} cx="72" cy="6" r="8" />
        </>
      );
    default:
      return null;
  }
}

const Sprout = () => (
  <g>
    <path className="s-stem" d="M60 20 q-2 -8 1 -16" fill="none" strokeWidth="3.5" strokeLinecap="round" />
    <path className="s-leaf s-ink" d="M61 6 q-14 -8 -20 2 q10 6 20 -2z" strokeWidth="2.2" strokeLinejoin="round" />
    <path className="s-leaf s-ink" d="M61 5 q12 -12 21 -4 q-8 9 -21 4z" strokeWidth="2.2" strokeLinejoin="round" />
  </g>
);

const Wings = () => (
  <g style={{ fill: 'var(--av-wings)' }}>
    <path d="M38 58 Q8 40 4 64 Q14 62 12 74 Q24 66 38 72z" />
    <path d="M82 58 Q112 40 116 64 Q106 62 108 74 Q96 66 82 72z" />
  </g>
);
