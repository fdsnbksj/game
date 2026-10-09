import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { Page } from '../../components/Page';
import { costumeItem, COSTUMES, costumeOf } from '../../games/hero/costumes';
import { canWear, LOOK_SIZES, PARTS_OF, type Look, type LookField } from '../../games/hero/look';
import { useWardrobeStore } from '../../wardrobeStore';
import { HeroFigure } from './Avatar';
import { CostumeArt } from './Costumes';

// Your hero's look: a big preview (turn it round), then one category at a time, its choices
// in a grid under the thumb. Each choice shows your hero wearing it. Parts and costumes
// from Summon are greyed until you have them. Every tap is saved.

type Tab = 'costume' | LookField;

const TABS: { id: Tab; label: string }[] = [
  { id: 'costume', label: 'Costume' },
  { id: 'skin', label: 'Skin' },
  { id: 'face', label: 'Face' },
  { id: 'hair', label: 'Hair' },
  { id: 'hairColour', label: 'Hair colour' },
  { id: 'hat', label: 'Hat' },
  { id: 'shirt', label: 'Shirt' },
  { id: 'shirtColour', label: 'Shirt colour' },
  { id: 'pants', label: 'Pants' },
  { id: 'pantsColour', label: 'Pants colour' },
  { id: 'extra', label: 'Extra' },
];

const COLOUR_FIELDS: LookField[] = ['skin', 'hairColour', 'shirtColour', 'pantsColour'];

export function Wardrobe() {
  const look = useWardrobeStore((s) => s.look);
  const costume = useWardrobeStore((s) => s.costume);
  const owned = useWardrobeStore((s) => s.owned);
  const setLook = useWardrobeStore((s) => s.setLook);
  const wear = useWardrobeStore((s) => s.wear);
  const [tab, setTab] = useState<Tab>('costume');
  const [back, setBack] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const worn = costumeOf(costume);

  return (
    <Page title="Wardrobe" back={null}>
      <section className="wardrobe-stage">
        <span className="battle-platform home-platform" />
        <HeroFigure appearance={{ look, costume }} back={back} className="wardrobe-figure" />
        <button className="wardrobe-turn" onClick={() => setBack(!back)} aria-label="Turn around">
          ⟲
        </button>
        {worn && <span className={`wardrobe-worn rarity-${worn.rarity}`}>{worn.name}</span>}
      </section>

      <div className="wardrobe-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'wardrobe-tab on' : 'wardrobe-tab'} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab !== 'costume' && costume && <p className="note center-note">Your costume covers your look. Take it off under Costume to see these.</p>}
      {hint && <p className="note center-note">{hint}</p>}

      <div className={`wardrobe-grid${COLOUR_FIELDS.includes(tab as LookField) ? ' colours' : ''}`}>
        {tab === 'costume' ? (
          <>
            <button className={`wardrobe-cell${costume === null ? ' on' : ''}`} onClick={() => wear(null)}>
              <HeroFigure appearance={{ look, costume: null }} className="thumb-figure" />
              <small>No costume</small>
            </button>
            {COSTUMES.map((c) => {
              const have = owned.includes(costumeItem(c.id));
              return (
                <button
                  key={c.id}
                  className={`wardrobe-cell rarity-${c.rarity}${costume === c.id ? ' on' : ''}${have ? '' : ' locked'}`}
                  onClick={() => (have ? wear(c.id) : setHint(`${c.name} comes from Summon.`))}
                >
                  <CostumeArt id={c.id} className="thumb-figure" />
                  <small>{c.name}</small>
                </button>
              );
            })}
          </>
        ) : (
          Array.from({ length: LOOK_SIZES[tab] }, (_, i) => {
            const have = canWear(tab, i, owned);
            const part = PARTS_OF[tab]?.[i];
            const on = look[tab] === i;
            const pick = () => {
              if (!have) return setHint(`${part?.name ?? 'That'} comes from Summon.`);
              setHint(null);
              setLook(tab, i);
            };
            if (COLOUR_FIELDS.includes(tab)) {
              const style = { background: tab === 'skin' ? `var(--av-skin-${i + 1})` : `var(--av-c-${i + 1})` } as CSSProperties;
              return <button key={i} className={`wardrobe-swatch${on ? ' on' : ''}`} style={style} onClick={pick} aria-label={`Colour ${i + 1}`} />;
            }
            const tried: Look = { ...look, [tab]: i };
            return (
              <button key={i} className={`wardrobe-cell${on ? ' on' : ''}${have ? '' : ' locked rarity-common'}`} onClick={pick}>
                <HeroFigure appearance={{ look: tried, costume: null }} back={tab === 'extra' && part?.id === 'cape'} className="thumb-figure" />
                <small>{part?.name}</small>
              </button>
            );
          })
        )}
      </div>
      <Link className="button" to="/hero/summon">
        Summon for more
      </Link>
    </Page>
  );
}
