import { useState } from 'react';
import { Page } from '../../components/Page';
import { SummaryRow } from '../../components/SummaryRow';
import { COSTUMES, costumeOf, type CostumeId, type Rarity } from '../../games/hero/costumes';
import { PITY, PULL_COST, RATES, REFUND, TEN_COST } from '../../games/hero/gacha';
import { PARTS_OF, type LookField } from '../../games/hero/look';
import { useWardrobeStore, type Summoned } from '../../wardrobeStore';
import { HeroFigure } from './Avatar';
import { CostumeArt } from './Costumes';

// Summon: the gacha. Gems from fights buy pulls (one free a day); a capsule machine shakes,
// drops a capsule in the rarity's colour, and it opens on what you got. Repeats turn into
// gems. The odds and the pity count fold into a sheet.

const RARITY_NAME: Record<Rarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };

export function Summon() {
  const gems = useWardrobeStore((s) => s.gems);
  const pity = useWardrobeStore((s) => s.pity);
  const free = useWardrobeStore((s) => s.freeReady());
  const pull = useWardrobeStore((s) => s.pull);
  const pullTen = useWardrobeStore((s) => s.pullTen);
  const [shown, setShown] = useState<Summoned[] | null>(null);
  const legendaries = COSTUMES.filter((c) => c.rarity === 'legendary');

  return (
    <Page title="Summon" back={null}>
      <section className="summon-banner frame">
        <span className="micro">Meme summon</span>
        <div className="summon-stars">
          {legendaries.map((c) => (
            <CostumeArt key={c.id} id={c.id} className="summon-star" />
          ))}
        </div>
        <p className="summon-line">
          {legendaries.map((c) => c.name).join(' · ')}
        </p>
        <span className="summon-pity">A Legendary within {PITY - pity} pulls</span>
      </section>

      <p className="summon-gems">
        <GemIcon /> {gems}
      </p>

      <div className="front-door">
        {free && (
          <button className="button primary" onClick={() => setShown(pull(true))}>
            Free pull today
          </button>
        )}
        <button className={free ? 'button' : 'button primary'} disabled={gems < PULL_COST} onClick={() => setShown(pull(false))}>
          Pull ×1 · {PULL_COST} gems
        </button>
        <button className="button" disabled={gems < TEN_COST} onClick={() => setShown(pullTen())}>
          Pull ×10 · {TEN_COST} gems · a Rare or better
        </button>
        {gems < PULL_COST && !free && <p className="note center-note">Win fights for gems: 50 for a new level, 150 for a boss, 10 for a rematch, 20 in the arena.</p>}
        <SummaryRow label="Rates and pity" title="Rates and pity">
          <div className="how-to">
            {(['legendary', 'epic', 'rare', 'common'] as Rarity[]).map((r) => (
              <p key={r}>
                <strong className={`rarity-text-${r}`}>{RARITY_NAME[r]}</strong> {RATES[r] / 10}%{r === 'common' ? ': rare parts for your look' : ': meme costumes with a small stat bonus'}. A repeat gives {REFUND[r]} gems.
              </p>
            ))}
            <p>Every {PITY}th pull without a Legendary is a Legendary. Ten pulls together always hold a Rare or better.</p>
          </div>
        </SummaryRow>
      </div>

      {shown && <Reveal pulled={shown} onDone={() => setShown(null)} />}
    </Page>
  );
}

/** The capsule machine, then each prize in turn; ten at once end on all ten. */
function Reveal({ pulled, onDone }: { pulled: Summoned[]; onDone: () => void }) {
  // -1: the machine shaking; 0..n-1: a prize; n: all of them.
  const [step, setStep] = useState(-1);
  const best = pulled.reduce((top, p) => (RANK[p.rarity] > RANK[top] ? p.rarity : top), 'common' as Rarity);
  const next = () => {
    if (step + 1 < pulled.length) setStep(step + 1);
    else if (pulled.length > 1) setStep(pulled.length);
    else onDone();
  };
  return (
    <div className="overlay summon-overlay" onClick={step >= 0 && step < pulled.length ? next : undefined}>
      {step === -1 && <Machine rarity={best} onDone={() => setStep(0)} />}
      {step >= 0 && step < pulled.length && <Prize key={step} p={pulled[step]} count={pulled.length > 1 ? `${step + 1} / ${pulled.length}` : null} />}
      {step === pulled.length && (
        <div className="panel summon-all" role="dialog" aria-label="Your pulls">
          <div className="summon-grid">
            {pulled.map((p, i) => (
              <span key={i} className={`summon-mini rarity-${p.rarity}`}>
                <ItemArt item={p.item} />
                {p.refund > 0 && <small>+{p.refund}</small>}
              </span>
            ))}
          </div>
          <button className="button primary" onClick={onDone}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}

const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

function Machine({ rarity, onDone }: { rarity: Rarity; onDone: () => void }) {
  return (
    <div className="summon-machine" onAnimationEnd={(e) => e.animationName === 'summon-drop' && onDone()}>
      <svg viewBox="0 0 120 160" className="summon-machine-art" aria-hidden="true">
        <circle cx="60" cy="54" r="44" className="machine-globe" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle key={i} cx={36 + (i % 3) * 24} cy={42 + Math.floor(i / 3) * 24} r="9" className={`machine-ball b${i}`} />
        ))}
        <rect x="26" y="96" width="68" height="52" rx="10" className="machine-base" />
        <rect x="48" y="122" width="24" height="18" rx="4" className="machine-slot" />
        <circle cx="60" cy="110" r="7" className="machine-knob" />
      </svg>
      <span className={`summon-capsule rarity-${rarity}`} />
    </div>
  );
}

function Prize({ p, count }: { p: Summoned; count: string | null }) {
  const name = itemName(p.item);
  return (
    <div className={`summon-prize rarity-${p.rarity}`}>
      <span className="summon-burst" />
      <ItemArt item={p.item} big />
      <span className={`summon-rarity rarity-text-${p.rarity}`}>{RARITY_NAME[p.rarity]}</span>
      <strong>{name}</strong>
      <span className="summon-new">{p.refund ? `Already yours: +${p.refund} gems` : 'New!'}</span>
      {count && <small className="micro">{count} · tap for the next</small>}
      {!count && <small className="micro">Tap to close</small>}
    </div>
  );
}

function itemName(item: string): string {
  const [kind, id] = item.split(':');
  if (kind === 'costume') return costumeOf(id)?.name ?? id;
  return PARTS_OF[kind as LookField]?.find((p) => p.id === id)?.name ?? id;
}

/** A prize as a picture: a costume itself, or your hero wearing the part. */
function ItemArt({ item, big = false }: { item: string; big?: boolean }) {
  const look = useWardrobeStore((s) => s.look);
  const [kind, id] = item.split(':');
  const cls = big ? 'summon-art' : 'thumb-figure';
  if (kind === 'costume') return <CostumeArt id={id as CostumeId} className={cls} />;
  const field = kind as LookField;
  const index = PARTS_OF[field]?.findIndex((p) => p.id === id) ?? -1;
  return <HeroFigure appearance={{ look: { ...look, [field]: Math.max(0, index) }, costume: null }} back={id === 'cape' || id === 'sword'} className={cls} />;
}

export function GemIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="gem-icon">
      <path d="M6 3h12l4 6-10 12L2 9z" />
      <path d="M2 9h20M9 3l3 6 3-6M12 9v12" fill="none" strokeWidth="1.2" />
    </svg>
  );
}
