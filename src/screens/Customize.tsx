import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { BirdPreview } from '../components/BirdPreview';
import { saveLoadout } from '../services/inventory';
import { COSMETIC_SLOTS, ITEMS, sameLoadout } from '../shared/items';
import type { LoadoutColors, Slot } from '../shared/types';
import { useGameStore } from '../store';

const SLOT_LABELS: Record<Slot, string> = { body: 'Body', wing: 'Wings', hat: 'Hat', trail: 'Trail' };
const COLOR_LABELS: Record<keyof LoadoutColors, string> = { body: 'Body', wing: 'Wings', trail: 'Trail' };
const COLOR_KEYS = Object.keys(COLOR_LABELS) as (keyof LoadoutColors)[];

const toHex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
const fromHex = (hex: string) => Number.parseInt(hex.slice(1), 16);

export function Customize() {
  const saved = useGameStore((s) => s.loadout);
  const inventory = useGameStore((s) => s.inventory);
  const owned = useMemo(() => new Set(inventory), [inventory]);
  const [draft, setDraft] = useState(saved);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const dirty = !sameLoadout(draft, saved);

  async function save() {
    setStatus('saving');
    try {
      await saveLoadout(draft);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  return (
    <main className="screen">
      <header className="topbar">
        <Link className="button small" to="/">
          ← Home
        </Link>
        <h2>Customize</h2>
      </header>

      <BirdPreview loadout={draft} />

      {COSMETIC_SLOTS.map((slot) => (
        <section key={slot} className="slot">
          <h3>{SLOT_LABELS[slot]}</h3>
          <div className="item-row">
            {ITEMS.filter((item) => item.slot === slot).map((item) => {
              const locked = !owned.has(item.id);
              return (
                <button
                  key={item.id}
                  className={`item ${item.rarity}`}
                  aria-pressed={draft[slot] === item.id}
                  disabled={locked}
                  onClick={() => setDraft({ ...draft, [slot]: item.id })}
                >
                  {item.name}
                  {locked && <small>Best {item.unlockScore}</small>}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <section className="slot">
        <h3>Colors</h3>
        <div className="item-row">
          {COLOR_KEYS.map((key) => (
            <label key={key} className="color">
              <input
                type="color"
                value={toHex(draft.colors[key])}
                onChange={(e) => setDraft({ ...draft, colors: { ...draft.colors, [key]: fromHex(e.target.value) } })}
              />
              {COLOR_LABELS[key]}
            </label>
          ))}
        </div>
      </section>

      <div className="save-bar">
        <button className="button primary" disabled={!dirty || status === 'saving'} onClick={save}>
          {status === 'saving' ? 'Saving…' : dirty ? 'Save' : 'Saved'}
        </button>
        {status === 'error' && <span className="error">Couldn't save</span>}
      </div>
    </main>
  );
}
