import type { CSSProperties, ReactNode } from 'react';
import type { CostumeId } from '../../games/hero/costumes';
import { Googly } from './Googly';

// The meme costumes, each our own drawing of an Italian brainrot character (memes nobody
// owns; never copy anyone's picture). Front and back: from behind the same shape with no
// face. Colours are the --meme-* tokens in src/index.css; outlines come from .costume.

const c = (token: string): CSSProperties => ({ fill: `var(--meme-${token})` });

// Googly eyes, the same as the creatures': the left one bigger, each rolling on its own beat.
const Eyes = ({ x1, x2, y, r = 5, back }: { x1: number; x2: number; y: number; r?: number; back: boolean }) =>
  back ? null : (
    <>
      <Googly x={x1} y={y} r={r * 1.3} beat={0} ring={1.8} />
      <Googly x={x2} y={y} r={r * 1.1} beat={1} ring={1.8} />
    </>
  );

const Legs = ({ x1 = 48, x2 = 66, y = 92, len = 14, shoe = 'shoe' }: { x1?: number; x2?: number; y?: number; len?: number; shoe?: string }) => (
  <>
    <rect style={c('limb')} x={x1} y={y} width="6" height={len} />
    <rect style={c('limb')} x={x2} y={y} width="6" height={len} />
    <rect style={c(shoe)} x={x1 - 3} y={y + len - 2} width="12" height="6" rx="3" />
    <rect style={c(shoe)} x={x2 - 3} y={y + len - 2} width="12" height="6" rx="3" />
  </>
);

const DRAW: Record<CostumeId, (back: boolean) => ReactNode> = {
  // A tall wooden log with a bat, wide-eyed.
  tungtung: (back) => (
    <>
      <Legs x1={48} x2={66} y={94} len={12} />
      <path style={c('limb')} d="M38 58 L22 74 M82 58 L92 50" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path style={c('bat')} d="M88 54 L104 14 q4 -4 7 0 L94 56z" />
      <rect style={c('wood')} x="38" y="10" width="44" height="88" rx="18" />
      <path style={c('wood-dark')} d="M46 30 q4 10 0 20 M74 60 q-4 10 0 22 M52 80 q6 4 12 0" fill="none" strokeWidth="2.5" />
      <Eyes x1={51} x2={69} y={34} r={7} back={back} />
      {!back && <path className="s-mouth" d="M48 52 q12 6 24 0" fill="none" strokeWidth="3" strokeLinecap="round" />}
    </>
  ),
  // A shark on three sneakered legs.
  tralalero: (back) => (
    <>
      <Legs x1={40} x2={58} y={88} len={14} shoe="sneaker" />
      <rect style={c('limb')} x="76" y="88" width="6" height="14" />
      <rect style={c('sneaker')} x="73" y="100" width="12" height="6" rx="3" />
      <path style={c('shark')} d="M8 62 L22 52 L18 70z" />
      <path style={c('shark')} d="M18 64 Q30 34 70 36 Q104 38 112 64 Q100 88 62 90 Q30 90 18 64z" />
      <path style={c('shark')} d="M56 38 L66 14 L78 40z" />
      {!back && <path style={c('belly')} d="M40 74 Q64 92 104 70 Q96 86 62 88 Q44 88 40 74z" />}
      <Eyes x1={86} x2={98} y={54} r={4} back={back} />
      {!back && <path className="s-teeth" d="M84 70 l4 5 4 -5 4 5 4 -5 4 4" strokeWidth="2" style={{ stroke: 'var(--mon-ink)' }} fill="none" />}
    </>
  ),
  // A crocodile head on a grey bomber.
  bombardiro: (back) => (
    <>
      <path style={c('plane')} d="M4 64 L116 58 L116 70 L4 72z" />
      <path style={c('plane')} d="M26 60 Q60 40 98 54 Q104 70 98 84 Q60 94 26 80z" />
      <circle style={c('plane-dark')} cx="40" cy="70" r="5" />
      <circle style={c('plane-dark')} cx="56" cy="72" r="5" />
      <path style={c('croc')} d="M84 46 Q96 30 108 40 L118 52 Q110 62 92 60z" />
      {!back && <path className="s-teeth" d="M100 54 l3 4 3 -4 3 4 3 -4" strokeWidth="1.5" style={{ stroke: 'var(--mon-ink)' }} fill="none" />}
      <Eyes x1={92} x2={100} y={40} r={4} back={back} />
      <path style={c('plane-dark')} d="M14 50 L26 62 L20 64z" />
    </>
  ),
  // A ballerina whose head is a cappuccino.
  cappuccina: (back) => (
    <>
      <path style={c('limb-pink')} d="M54 84 L50 110 M66 84 L72 110" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path style={c('tutu')} d="M30 80 l10 -8 10 8 10 -8 10 8 10 -8 10 8 -20 -14 h-20z" />
      <rect style={c('tutu')} x="48" y="56" width="24" height="22" rx="6" />
      <path style={c('limb-pink')} d="M48 60 Q30 40 40 24 M72 60 Q90 40 80 24" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path style={c('cup')} d="M40 18 h40 l-4 34 q-16 6 -32 0z" />
      <path style={c('cup')} d="M80 26 q12 0 10 12 q-2 8 -12 8" fill="none" strokeWidth="5" />
      <ellipse style={c('foam')} cx="60" cy="18" rx="20" ry="6" />
      <Eyes x1={52} x2={68} y={34} r={4} back={back} />
    </>
  ),
  // A tree-trunk creature with a big nose.
  patapim: (back) => (
    <>
      <path style={c('wood')} d="M46 84 L38 110 h12 l6 -20 M74 84 L82 110 h-12 l-6 -20" />
      <rect style={c('wood')} x="38" y="40" width="44" height="50" rx="10" />
      <path style={c('leaf')} d="M30 40 q0 -26 30 -30 q30 4 30 30 q-30 -8 -60 0z" />
      <Eyes x1={50} x2={70} y={52} r={6} back={back} />
      {!back && <ellipse style={c('nose')} cx="60" cy="66" rx="9" ry="7" />}
      {!back && <path className="s-mouth" d="M52 78 h16" strokeWidth="2.5" strokeLinecap="round" />}
    </>
  ),
  // A chimp peeking out of a banana.
  bananini: (back) => (
    <>
      <Legs x1={50} x2={64} y={96} len={10} />
      <path style={c('banana')} d="M36 30 Q30 70 48 100 h24 Q90 70 84 30 Q60 8 36 30z" />
      <ellipse style={c('chimp')} cx="60" cy="48" rx="18" ry="16" />
      {!back && <ellipse style={c('chimp-face')} cx="60" cy="54" rx="12" ry="9" />}
      <path style={c('banana')} d="M36 66 L22 40 L40 52z M84 66 L98 40 L80 52z" />
      <Eyes x1={54} x2={66} y={44} r={3.5} back={back} />
      {!back && <path className="s-mouth" d="M54 58 q6 4 12 0" fill="none" strokeWidth="2" />}
    </>
  ),
  // A cactus elephant in sandals.
  larila: (back) => (
    <>
      <Legs x1={46} x2={68} y={94} len={10} shoe="sandal" />
      <rect style={c('cactus')} x="40" y="44" width="40" height="54" rx="18" />
      <path style={c('cactus')} d="M40 66 h-12 v-18 q0 -6 6 -6 v14 h6 M80 62 h12 v-16 q0 -6 -6 -6 v12 h-6" />
      <ellipse style={c('elephant')} cx="60" cy="32" rx="22" ry="18" />
      <ellipse style={c('elephant')} cx="36" cy="32" rx="9" ry="12" />
      <ellipse style={c('elephant')} cx="84" cy="32" rx="9" ry="12" />
      {!back && <path style={c('elephant')} d="M56 40 q-2 20 6 26 q4 2 4 -2 q-6 -6 -2 -24z" />}
      <Eyes x1={52} x2={68} y={28} r={3.5} back={back} />
      <path className="s-pupil" d="M48 60 l2 2 M70 74 l2 2 M56 84 l2 2" strokeWidth="2" style={{ stroke: 'var(--mon-ink)' }} />
    </>
  ),
  // A coffee cup in a ninja's mask, two blades.
  assassino: (back) => (
    <>
      <Legs x1={48} x2={66} y={92} len={12} shoe="shoe" />
      <path style={c('cloak')} d="M38 56 h44 l6 40 h-56z" />
      <path className="s-blade" d="M30 84 L14 56 M90 84 L106 56" strokeWidth="4" strokeLinecap="round" />
      <path style={c('cup')} d="M38 14 h44 l-4 40 q-18 6 -36 0z" />
      <ellipse style={c('coffee')} cx="60" cy="14" rx="22" ry="6" />
      <rect style={c('cloak')} x="38" y="26" width="44" height="12" />
      {!back && <path className="s-eye" d="M48 30 h8 v4 h-8z M64 30 h8 v4 h-8z" />}
      {back && <path style={c('cloak')} d="M82 30 l14 -4 -4 10z" />}
    </>
  ),
  // A cow whose body is a ringed planet.
  saturnita: (back) => (
    <>
      <Legs x1={46} x2={68} y={92} len={12} shoe="hoof" />
      <circle style={c('planet')} cx="60" cy="66" r="28" />
      <ellipse cx="60" cy="68" rx="46" ry="10" fill="none" strokeWidth="5" style={{ stroke: 'var(--meme-ring)' }} />
      <ellipse style={c('cow')} cx="60" cy="30" rx="18" ry="16" />
      <path style={c('cow-spot')} d="M46 22 q6 -4 10 2 q-4 6 -10 -2z M68 34 q6 -2 6 6 q-6 0 -6 -6z" />
      <path style={c('horn')} d="M44 18 l-6 -10 10 6z M76 18 l6 -10 -10 6z" />
      {!back && <ellipse style={c('nose')} cx="60" cy="40" rx="9" ry="5" />}
      <Eyes x1={53} x2={67} y={28} r={3.5} back={back} />
    </>
  ),
  // A cat's head on a shrimp.
  trippi: (back) => (
    <>
      {[0, 1, 2, 3].map((i) => (
        <ellipse key={i} style={c('shrimp')} cx={44 + i * 10} cy={74 + i * 6} rx="14" ry="10" />
      ))}
      <path style={c('shrimp')} d="M84 98 l16 -4 -4 12z" />
      <path style={c('cat')} d="M34 30 l4 -16 10 10 h24 l10 -10 4 16 q2 28 -26 28 q-28 0 -26 -28z" />
      <Eyes x1={50} x2={70} y={34} r={4} back={back} />
      {!back && <path className="s-mouth" d="M56 46 q4 4 8 0 M44 42 h-10 M76 42 h10" fill="none" strokeWidth="1.5" />}
    </>
  ),
  // A frog on a tyre, on legs.
  ambalabu: (back) => (
    <>
      <Legs x1={46} x2={68} y={92} len={14} />
      <circle style={c('tyre')} cx="60" cy="72" r="26" />
      <circle style={c('tyre-hub')} cx="60" cy="72" r="10" />
      <ellipse style={c('frog')} cx="60" cy="34" rx="24" ry="16" />
      <circle style={c('frog')} cx="46" cy="22" r="8" />
      <circle style={c('frog')} cx="74" cy="22" r="8" />
      <Eyes x1={46} x2={74} y={22} r={5} back={back} />
      {!back && <path className="s-mouth" d="M44 38 q16 8 32 0" fill="none" strokeWidth="2.5" />}
    </>
  ),
  // A camel inside a fridge.
  frigo: (back) => (
    <>
      <Legs x1={46} x2={68} y={96} len={10} shoe="boot" />
      <rect style={c('fridge')} x="34" y="40" width="52" height="60" rx="6" />
      <path className="s-shade" d="M34 62 h52" strokeWidth="2" style={{ stroke: 'var(--mon-ink)' }} />
      {!back && <rect style={c('fridge-handle')} x="76" y="46" width="4" height="12" rx="2" />}
      <path style={c('camel')} d="M52 42 q-2 -18 6 -26 q8 -6 14 0 q4 4 2 8 l-8 2 q-2 8 -2 16z" />
      <path style={c('camel')} d="M40 40 q4 -14 12 -8 q6 -6 10 8z" />
      <Eyes x1={64} x2={72} y={16} r={3} back={back} />
    </>
  ),
  // A crocodile with a watermelon body.
  glorbo: (back) => (
    <>
      <Legs x1={46} x2={68} y={94} len={12} />
      <ellipse style={c('rind')} cx="60" cy="70" rx="30" ry="26" />
      <ellipse style={c('melon')} cx="60" cy="70" rx="24" ry="20" />
      {[0, 1, 2, 3, 4].map((i) => (
        <ellipse key={i} className="s-ink-fill" cx={48 + i * 6} cy={i % 2 ? 66 : 76} rx="1.5" ry="2.5" />
      ))}
      <path style={c('croc')} d="M40 44 Q50 22 70 24 L100 32 Q100 44 70 46 Q54 48 40 44z" />
      {!back && <path className="s-teeth" d="M74 40 l3 4 3 -4 3 4 3 -4 3 4" strokeWidth="1.5" style={{ stroke: 'var(--mon-ink)' }} fill="none" />}
      <Eyes x1={56} x2={66} y={30} r={4} back={back} />
    </>
  ),
  // A capybara in a coconut shell.
  burbaloni: (back) => (
    <>
      <path style={c('coconut')} d="M22 70 Q24 104 60 106 Q96 104 98 70z" />
      <path style={c('coconut-flesh')} d="M28 70 Q30 98 60 100 Q90 98 92 70z" />
      <ellipse style={c('capy')} cx="60" cy="58" rx="26" ry="20" />
      <ellipse style={c('capy')} cx="40" cy="42" rx="5" ry="4" />
      <ellipse style={c('capy')} cx="80" cy="42" rx="5" ry="4" />
      {!back && <ellipse style={c('capy-dark')} cx="60" cy="66" rx="10" ry="6" />}
      <Eyes x1={50} x2={70} y={52} r={3} back={back} />
      <path style={c('coconut')} d="M30 40 Q60 6 90 40 Q60 26 30 40z" />
    </>
  ),
  // A capybara, unbothered, with an orange on its head.
  capybara: (back) => (
    <>
      <Legs x1={44} x2={70} y={94} len={10} shoe="limb" />
      <rect style={c('capy')} x="26" y="50" width="70" height="48" rx="22" />
      <rect style={c('capy')} x="54" y="30" width="40" height="34" rx="14" />
      <ellipse style={c('capy')} cx="62" cy="30" rx="5" ry="4" />
      {!back && <rect style={c('capy-dark')} x="80" y="44" width="14" height="12" rx="5" />}
      {!back && (
        <>
          <path className="s-mouth" d="M68 44 h6 M80 44 h6" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      <circle style={c('orange')} cx="72" cy="22" r="9" />
      <path style={c('leaf')} d="M72 13 q6 -6 10 -2 q-4 4 -10 2z" />
    </>
  ),
};

export function Costume({ id, back }: { id: CostumeId; back: boolean }) {
  return <g className={`costume${back ? ' back' : ''}`}>{DRAW[id](back)}</g>;
}

/** A costume on its own, for Summon and the Wardrobe. */
export function CostumeArt({ id, className = '' }: { id: CostumeId; className?: string }) {
  return (
    <svg className={`sprite costume-art ${className}`} viewBox="0 0 120 120" aria-hidden="true">
      <Costume id={id} back={false} />
    </svg>
  );
}
