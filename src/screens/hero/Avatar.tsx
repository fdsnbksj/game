import type { CSSProperties, ReactNode } from 'react';
import { EXTRAS, FACES, HAIRS, HATS, PANTS, SHIRTS, type Appearance, type Look } from '../../games/hero/look';
import { Costume } from './Costumes';

// Your hero as drawn everywhere: a blocky figure built from the parts in
// src/games/hero/look.ts, from the front or (in a fight, where you stand with your back to
// us) from behind. A costume, if worn, is drawn instead (Costumes.tsx). Our own art;
// colours are the --av-* tokens in src/index.css.

const skin = (n: number): CSSProperties => ({ fill: `var(--av-skin-${n + 1})` });
const cloth = (n: number): CSSProperties => ({ fill: `var(--av-c-${n + 1})` });

export function HeroFigure({ appearance, back = false, className = '' }: { appearance: Appearance; back?: boolean; className?: string }) {
  return (
    <svg className={`sprite hero-sprite ${className}`} viewBox="0 0 120 120" aria-hidden="true">
      {appearance.costume ? <Costume id={appearance.costume} back={back} /> : <Blocky look={appearance.look} back={back} />}
    </svg>
  );
}

function Blocky({ look, back }: { look: Look; back: boolean }) {
  const hat = HATS[look.hat].id;
  const hair = HAIRS[look.hair].id;
  const extra = EXTRAS[look.extra].id;
  const shirt = SHIRTS[look.shirt].id;
  const shorts = PANTS[look.pants].id === 'shorts';
  const s = skin(look.skin);
  const shirtFill = shirt === 'armour' ? { fill: 'var(--mon-metal)' } : cloth(look.shirtColour);
  const hairFill = cloth(look.hairColour);

  return (
    <g className="s-ink-lines">
      {/* Behind the body: wings and a cape (in front of it from behind). */}
      {extra === 'wings' && <Wings />}
      {extra === 'cape' && !back && <path style={{ fill: 'var(--av-cape)' }} d="M36 54 L84 54 L94 108 L26 108 Z" />}
      {extra === 'sword' && !back && <path className="s-blade" d="M88 22 L74 50" strokeWidth="4" strokeLinecap="round" />}
      {hair === 'long' && <rect style={hairFill} x="38" y="26" width="44" height="34" rx="6" />}
      {hair === 'ponytail' && <rect style={hairFill} x={back ? 54 : 74} y="30" width="12" height="28" rx="6" />}
      {shirt === 'hoodie' && <rect style={shirtFill} x="38" y="22" width="44" height="34" rx="12" />}

      {/* Legs and shoes. */}
      <rect style={shorts ? s : cloth(look.pantsColour)} x="44" y="84" width="14" height="22" />
      <rect style={shorts ? s : cloth(look.pantsColour)} x="62" y="84" width="14" height="22" />
      {shorts && (
        <>
          <rect style={cloth(look.pantsColour)} x="43" y="82" width="16" height="10" />
          <rect style={cloth(look.pantsColour)} x="61" y="82" width="16" height="10" />
        </>
      )}
      <rect className="s-ink-fill" x="42" y="104" width="17" height="7" rx="2" />
      <rect className="s-ink-fill" x="61" y="104" width="17" height="7" rx="2" />

      {/* Arms: sleeves, then hands. */}
      <rect style={shirt === 'tee' ? s : shirtFill} x="26" y="54" width="12" height="30" rx="2" />
      <rect style={shirt === 'tee' ? s : shirtFill} x="82" y="54" width="12" height="30" rx="2" />
      {shirt === 'tee' && (
        <>
          <rect style={shirtFill} x="26" y="54" width="12" height="12" rx="2" />
          <rect style={shirtFill} x="82" y="54" width="12" height="12" rx="2" />
        </>
      )}
      <rect style={s} x="27" y="80" width="10" height="8" rx="2" />
      <rect style={s} x="83" y="80" width="10" height="8" rx="2" />

      {/* The torso. */}
      <rect style={shirtFill} x="38" y="52" width="44" height="34" rx="3" />
      {shirt === 'jacket' && !back && <path style={{ fill: 'var(--av-inner)' }} d="M54 52 L66 52 L64 86 L56 86 Z" />}
      {shirt === 'hoodie' && !back && <rect className="s-shade" x="48" y="72" width="24" height="9" rx="3" />}
      {shirt === 'armour' && <path className="s-shade" d="M38 66 h44 M38 76 h44 M60 52 v34" fill="none" strokeWidth="2" style={{ stroke: 'var(--mon-ink)' }} />}
      {extra === 'scarf' && <rect style={{ fill: 'var(--av-scarf)' }} x="36" y="48" width="48" height="9" rx="4" />}
      {extra === 'cape' && back && <path style={{ fill: 'var(--av-cape)' }} d="M36 52 L84 52 L94 110 L26 110 Z" />}
      {extra === 'sword' && back && (
        <>
          <path className="s-blade" d="M84 26 L40 92" strokeWidth="5" strokeLinecap="round" />
          <path className="s-gold" d="M79 30 l10 6 -3 4 -10 -6z" />
        </>
      )}

      {/* The head. */}
      <rect style={s} x="42" y="16" width="36" height="36" rx="7" />
      {back ? <rect style={hairFill} x="42" y="16" width="36" height={hair === 'none' ? 0 : 30} rx="7" /> : <Face face={FACES[look.face].id} />}
      {!back && <Hair id={hair} fill={hairFill} />}
      {back && hair === 'bun' && <circle style={hairFill} cx="60" cy="12" r="8" />}
      {back && hair === 'mohawk' && <rect style={hairFill} x="56" y="4" width="8" height="40" rx="3" />}
      {back && hair === 'spiky' && <path style={hairFill} d="M42 22 l6 -12 6 10 6 -12 6 12 6 -10 6 12z" />}
      {extra === 'headphones' && (
        <>
          <path d="M40 30 Q60 4 80 30" fill="none" strokeWidth="4" style={{ stroke: 'var(--av-phones)' }} />
          <rect style={{ fill: 'var(--av-phones)' }} x="36" y="26" width="9" height="14" rx="3" />
          <rect style={{ fill: 'var(--av-phones)' }} x="75" y="26" width="9" height="14" rx="3" />
        </>
      )}
      {extra === 'sunglasses' && !back && <path className="s-ink-fill" d="M45 28 h13 v7 q-6 4 -13 0z M62 28 h13 v7 q-7 4 -13 0z M58 30 h4 v2 h-4z" />}
      <Hat id={hat} />
    </g>
  );
}

function Face({ face }: { face: string }) {
  const eye = (x: number) => <rect className="s-ink-fill" x={x} y="28" width="5" height="7" rx="1.5" />;
  const eyes: ReactNode =
    face === 'cool' ? (
      <path className="s-ink-fill" d="M46 29 h11 v5 h-11z M63 29 h11 v5 h-11z" />
    ) : face === 'wink' ? (
      <>
        {eye(50)}
        <path className="s-mouth" d="M65 32 h7" strokeWidth="2.5" strokeLinecap="round" />
      </>
    ) : face === 'sleepy' ? (
      <path className="s-mouth" d="M49 32 h7 M64 32 h7" strokeWidth="2.5" strokeLinecap="round" />
    ) : face === 'angry' ? (
      <>
        {eye(50)}
        {eye(65)}
        <path className="s-mouth" d="M47 24 l10 4 M73 24 l-10 4" strokeWidth="2.5" strokeLinecap="round" />
      </>
    ) : (
      <>
        {eye(50)}
        {eye(65)}
      </>
    );
  const mouth =
    face === 'grin' ? (
      <path className="s-teeth" d="M50 40 h20 q-2 8 -10 8 q-8 0 -10 -8z" style={{ stroke: 'var(--mon-ink)' }} strokeWidth="1.5" />
    ) : face === 'surprised' ? (
      <ellipse className="s-ink-fill" cx="60" cy="43" rx="4" ry="5" />
    ) : face === 'smirk' ? (
      <path className="s-mouth" d="M53 43 q8 3 13 -3" fill="none" strokeWidth="2.5" strokeLinecap="round" />
    ) : face === 'angry' ? (
      <path className="s-mouth" d="M53 45 q7 -5 14 0" fill="none" strokeWidth="2.5" strokeLinecap="round" />
    ) : face === 'sleepy' ? (
      <ellipse className="s-ink-fill" cx="60" cy="43" rx="3" ry="2" />
    ) : (
      <path className="s-mouth" d="M52 41 q8 7 16 0" fill="none" strokeWidth="2.5" strokeLinecap="round" />
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
