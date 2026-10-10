import type { CSSProperties, ReactNode } from 'react';
import { EXTRAS, FACES, HAIRS, HATS, PANTS, SHIRTS, type Appearance, type Look } from '../../games/hero/look';
import { Costume } from './Costumes';

// Your hero as drawn everywhere: a lanky, bug-eyed cartoon figure built from the parts in
// src/games/hero/look.ts, from the front or (in a fight, where you stand with your back to
// us) from behind. A costume, if worn, is drawn instead (Costumes.tsx). Our own art;
// colours are the --av-* tokens in src/index.css.

const skin = (n: number): CSSProperties => ({ fill: `var(--av-skin-${n + 1})` });
const cloth = (n: number): CSSProperties => ({ fill: `var(--av-c-${n + 1})` });

export function HeroFigure({ appearance, back = false, className = '' }: { appearance: Appearance; back?: boolean; className?: string }) {
  return (
    <svg className={`sprite hero-sprite ${className}`} viewBox="0 0 120 120" aria-hidden="true">
      {appearance.costume ? <Costume id={appearance.costume} back={back} /> : <Lanky look={appearance.look} back={back} />}
    </svg>
  );
}

function Lanky({ look, back }: { look: Look; back: boolean }) {
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

      {/* Legs: two noodles, then floppy shoes. */}
      <Noodle d="M54 82 q-3 11 -2 22" line={pantsLine} />
      <Noodle d="M66 82 q3 11 2 22" line={pantsLine} />
      {shorts && (
        <>
          <Noodle d="M54 82 q-1 5 -1.5 8" line={{ stroke: cloth(look.pantsColour).fill }} wide />
          <Noodle d="M66 82 q1 5 1.5 8" line={{ stroke: cloth(look.pantsColour).fill }} wide />
        </>
      )}
      <ellipse className="s-ink-fill" cx="49" cy="107" rx="8" ry="4.5" />
      <ellipse className="s-ink-fill" cx="71" cy="107" rx="8" ry="4.5" />

      {/* Arms: noodles from the shoulders, sleeves, then little round hands. */}
      <Noodle d="M47 58 q-10 6 -10 26" line={shirt === 'tee' ? skinLine : shirtLine} />
      <Noodle d="M73 58 q10 6 10 26" line={shirt === 'tee' ? skinLine : shirtLine} />
      {shirt === 'tee' && (
        <>
          <Noodle d="M47 58 q-6 3 -8 9" line={shirtLine} wide />
          <Noodle d="M73 58 q6 3 8 9" line={shirtLine} wide />
        </>
      )}
      <circle style={s} cx="37" cy="86" r="4.5" />
      <circle style={s} cx="83" cy="86" r="4.5" />

      {/* A thin neck and a soft, saggy torso. */}
      <rect style={s} x="56" y="46" width="8" height="10" />
      <path style={shirtFill} d="M51 54 h18 q5 0 6 6 l3 21 q0 5 -5 5 h-26 q-5 0 -5 -5 l3 -21 q1 -6 6 -6z" />
      {shirt === 'jacket' && !back && <path style={{ fill: 'var(--av-inner)' }} d="M56 54 L64 54 L62 86 L58 86 Z" />}
      {shirt === 'hoodie' && !back && <rect className="s-shade" x="51" y="72" width="18" height="9" rx="4" />}
      {shirt === 'armour' && <path className="s-shade" d="M44 66 h32 M43 76 h34 M60 54 v32" fill="none" strokeWidth="2" style={{ stroke: 'var(--mon-ink)' }} />}
      {extra === 'scarf' && <rect style={{ fill: 'var(--av-scarf)' }} x="42" y="48" width="36" height="9" rx="4" />}
      {extra === 'cape' && back && <path style={{ fill: 'var(--av-cape)' }} d="M40 52 L80 52 L92 110 L28 110 Z" />}
      {extra === 'sword' && back && (
        <>
          <path className="s-blade" d="M84 26 L40 92" strokeWidth="5" strokeLinecap="round" />
          <path className="s-gold" d="M79 30 l10 6 -3 4 -10 -6z" />
        </>
      )}

      {/* The head: a big round one, ears out, eyes bulging. */}
      <circle style={s} cx="40.5" cy="36" r="4" />
      <circle style={s} cx="79.5" cy="36" r="4" />
      <ellipse style={s} cx="60" cy="33" rx="20" ry="19" />
      {back ? hair !== 'none' && <path style={hairFill} d="M40 34 a20 19 0 0 1 40 0 v8 q-20 7 -40 0z" /> : <Face face={FACES[look.face].id} skin={s} />}
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

/** A limb: a round-capped stroke in its colour over a wider one in ink, so it's outlined. */
function Noodle({ d, line, wide = false }: { d: string; line: CSSProperties; wide?: boolean }) {
  return (
    <>
      <path className="s-limb-ink" d={d} strokeWidth={wide ? 15 : 12} />
      <path className="s-limb" d={d} style={line} strokeWidth={wide ? 10 : 7} />
    </>
  );
}

function Face({ face, skin: lid }: { face: string; skin: CSSProperties }) {
  // Big white eyes with tiny pupils that never quite agree on where to look.
  const eye = (cx: number, px: number, py: number, big = false) => (
    <>
      <ellipse className="s-eye s-ink" cx={cx} cy="30" rx={big ? 7 : 6} ry={big ? 8 : 6.8} strokeWidth="2" />
      <circle className="s-pupil" cx={px} cy={py} r={big ? 1.3 : 1.7} />
    </>
  );
  const eyes: ReactNode =
    face === 'cool' ? (
      <path className="s-ink-fill" d="M44 26 h14 v6 q-7 5 -14 0z M62 26 h14 v6 q-7 5 -14 0z M58 27 h4 v2 h-4z" />
    ) : face === 'wink' ? (
      <>
        {eye(52, 53.5, 31)}
        <path className="s-mouth" d="M63 31 q5 -4 10 0" fill="none" strokeWidth="2.5" strokeLinecap="round" />
      </>
    ) : face === 'sleepy' ? (
      <>
        {eye(52, 53, 33)}
        {eye(68, 67, 33.5)}
        {/* Heavy lids and the bags under them. */}
        <path style={lid} d="M46 30 a6 6.8 0 0 1 12 0z M62 30 a6 6.8 0 0 1 12 0z" />
        <path className="s-mouth" d="M47 40 q5 2 9 0 M64 40 q5 2 9 0" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ) : face === 'angry' ? (
      <>
        {eye(52, 54, 31)}
        {eye(68, 66, 31)}
        <path className="s-mouth" d="M45 21 l12 5 M75 21 l-12 5" strokeWidth="3" strokeLinecap="round" />
      </>
    ) : face === 'surprised' ? (
      <>
        {eye(52, 52, 30, true)}
        {eye(68, 68, 30, true)}
      </>
    ) : (
      <>
        {eye(52, 53.5, 31)}
        {eye(68, 66, 29.5)}
      </>
    );
  const mouth =
    face === 'grin' ? (
      <>
        <path className="s-teeth" d="M48 41 h24 q-2 9 -12 9 q-10 0 -12 -9z" style={{ stroke: 'var(--mon-ink)' }} strokeWidth="2" />
        <path className="s-mouth" d="M54 41 v7 M60 41 v9 M66 41 v7" strokeWidth="1.2" />
      </>
    ) : face === 'surprised' ? (
      <ellipse className="s-ink-fill" cx="60" cy="45" rx="3.5" ry="4.5" />
    ) : face === 'smirk' ? (
      <path className="s-mouth" d="M53 46 q8 2 13 -4" fill="none" strokeWidth="2.5" strokeLinecap="round" />
    ) : face === 'angry' ? (
      <path className="s-mouth" d="M52 47 q8 -6 16 0" fill="none" strokeWidth="2.5" strokeLinecap="round" />
    ) : face === 'sleepy' ? (
      <>
        <ellipse className="s-ink-fill" cx="58" cy="45" rx="4" ry="2.5" />
        {/* A string of drool. */}
        <path className="s-drool" d="M61 46 q1.5 5 0.5 8 q-1.5 1.5 -2.5 0 q0 -3 2 -8z" />
      </>
    ) : (
      <path className="s-mouth" d="M51 43 q9 6 17 -1 M66 40 l3 2.5" fill="none" strokeWidth="2.5" strokeLinecap="round" />
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

const Wings = () => (
  <g style={{ fill: 'var(--av-wings)' }}>
    <path d="M38 58 Q8 40 4 64 Q14 62 12 74 Q24 66 38 72z" />
    <path d="M82 58 Q112 40 116 64 Q106 62 108 74 Q96 66 82 72z" />
  </g>
);
