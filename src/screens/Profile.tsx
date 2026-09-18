import { Link } from 'react-router';
import { BirdPreview } from '../components/BirdPreview';
import { FlameIcon } from '../components/icons';
import { dayId } from '../shared/constants';
import { ITEMS } from '../shared/items';
import { liveStreak, medalFor, MEDALS, nextMedal } from '../shared/progress';
import type { Rarity } from '../shared/types';
import { useGameStore } from '../store';

const RARITIES: Rarity[] = ['common', 'rare', 'epic'];
const RARITY_LABELS: Record<Rarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic' };
const JOINED_FORMAT = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

export function Profile() {
  const profile = useGameStore((s) => s.profile)!;
  const loadout = useGameStore((s) => s.loadout);
  const inventory = useGameStore((s) => s.inventory);
  const joinedAt = useGameStore((s) => s.joinedAt);

  const today = dayId();
  const owned = new Set(inventory);
  const medal = medalFor(profile.bestScore);
  const next = nextMedal(profile.bestScore);
  const stats: [string, number][] = [
    ['Best', profile.bestScore],
    ['Today', profile.dailyId === today ? profile.dailyScore : 0],
    ['Best streak', profile.bestStreak],
    ['Days played', profile.daysPlayed],
    ['Runs', profile.gamesPlayed],
  ];

  return (
    <main className="screen">
      <header className="topbar">
        <Link className="button small" to="/">
          ← Home
        </Link>
        <h2>Profile</h2>
      </header>

      <BirdPreview loadout={loadout} />
      <div className="profile-name">
        <h3>{profile.displayName}</h3>
        {medal && <span className={`medal-badge ${medal.id}`}>{medal.name}</span>}
      </div>

      <dl className="stat-grid">
        <div className="stat streak lit">
          <dt>Streak</dt>
          <dd>
            <FlameIcon />
            {liveStreak(profile, today)}
          </dd>
        </div>
        {stats.map(([label, value]) => (
          <div key={label} className="stat">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section className="slot">
        <h3>Medals</h3>
        <ul className="medals">
          {MEDALS.map((m) => {
            const earned = profile.bestScore >= m.score;
            return (
              <li key={m.id} className={earned ? `medal ${m.id} earned` : `medal ${m.id}`}>
                <span className="medal-disc" aria-hidden="true" />
                <span>{m.name}</span>
                <small>{earned ? 'Earned' : `Best ${m.score}`}</small>
              </li>
            );
          })}
        </ul>
        {next && (
          <p className="muted small-print">
            {next.score - profile.bestScore} more for {next.name}
          </p>
        )}
      </section>

      <section className="slot">
        <h3>Collection</h3>
        <div className="collection">
          <p className="collection-count">
            {owned.size} <span className="muted">/ {ITEMS.length}</span>
          </p>
          <div className="meter" role="img" aria-label={`${owned.size} of ${ITEMS.length} items`}>
            <span style={{ width: `${(owned.size / ITEMS.length) * 100}%` }} />
          </div>
          <ul className="rarity-counts">
            {RARITIES.map((rarity) => {
              const items = ITEMS.filter((item) => item.rarity === rarity);
              return (
                <li key={rarity} className={rarity}>
                  {RARITY_LABELS[rarity]} {items.filter((item) => owned.has(item.id)).length}/{items.length}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {joinedAt !== null && <p className="muted small-print">Flying since {JOINED_FORMAT.format(joinedAt)}</p>}
    </main>
  );
}
