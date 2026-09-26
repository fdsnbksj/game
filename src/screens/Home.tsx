import { Link } from 'react-router';
import { MiniGrid } from '../components/Board';
import { SettingsButton } from '../components/SettingsSheet';
import { Wordmark } from '../components/Wordmark';
import { dayNumber } from '../learn/schedule';
import { useLibraryStore } from '../libraryStore';
import { levelPuzzle, useNonogramStore } from '../nonogramStore';
import { dayId } from '../shared/constants';

export function Home() {
  const level = useNonogramStore((s) => s.level);
  const ladder = useNonogramStore((s) => s.ladder);
  const solved = useNonogramStore((s) => s.solved);
  const dailySolved = useNonogramStore((s) => s.dailySolved);
  const size = levelPuzzle(level).size;
  const started = ladder !== null && ladder.history.length > 0;

  return (
    <main className="screen home with-tabs">
      <header className="home-top">
        <span className="micro">Small puzzles for between chapters</span>
        <SettingsButton />
      </header>

      <div className="home-brand">
        <Wordmark />
      </div>

      <section className="glass hero">
        <div className="hero-puzzle">
          <MiniGrid size={size} marks={ladder?.marks ?? new Array(size * size).fill(0)} />
          <div className="hero-text">
            <span className="micro">Puzzles</span>
            <strong>Level {level}</strong>
            <span className="micro">
              {size}×{size}
              {started ? ' · in progress' : ''}
            </span>
          </div>
        </div>
        <Link className="button primary big" to="/play">
          {started ? 'Continue' : 'Play'}
        </Link>
      </section>

      <DailyCard />
      <BookCard />

      <section className="glass tray" aria-label="Your stats">
        {solved === 0 ? (
          <p className="tray-empty">Each puzzle takes a minute or two. Stop whenever you like: every tap is saved.</p>
        ) : (
          <dl className="tray-stats">
            <div>
              <dd>{solved}</dd>
              <dt>Solved</dt>
            </div>
            <div>
              <dd>{level - 1}</dd>
              <dt>Levels</dt>
            </div>
            <div>
              <dd>{streak(dailySolved)}</dd>
              <dt>Daily streak</dt>
            </div>
          </dl>
        )}
      </section>
    </main>
  );
}

/** Days in a row with the daily puzzle solved, up to today (or yesterday, if today's is still to do). */
function streak(days: readonly string[]): number {
  const solved = new Set(days);
  const date = new Date(`${dayId()}T00:00:00Z`);
  if (!solved.has(dayId(date))) date.setUTCDate(date.getUTCDate() - 1);
  let count = 0;
  while (solved.has(dayId(date))) {
    count++;
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return count;
}

/** Today's puzzle: the same one for everyone. */
function DailyCard() {
  const day = dayId();
  const done = useNonogramStore((s) => s.dailySolved.includes(day));
  const playing = useNonogramStore((s) => s.daily?.day === day && s.daily.play.history.length > 0);

  return (
    <Link className={done ? 'glass daily-card done' : 'glass daily-card'} to="/daily" aria-disabled={done}>
      <span className="daily-mark" aria-hidden="true" />
      <span className="daily-text">
        <span className="micro">Daily puzzle</span>
        <strong>{done ? 'Solved today' : playing ? 'In progress' : 'The same 10×10 for everyone'}</strong>
      </span>
      <span className="daily-go">{done ? '✓' : playing ? 'Resume' : 'Play'}</span>
    </Link>
  );
}

/** Your highlights: where the lines to recall between levels come from. */
function BookCard() {
  const cards = useLibraryStore((s) => s.cards);
  const today = dayNumber(dayId());
  const due = cards.filter((c) => c.review.due <= today).length;
  const books = new Set(cards.map((c) => c.book)).size;

  return (
    <Link className="glass daily-card book-card" to="/books">
      <span className="daily-mark" aria-hidden="true" />
      <span className="daily-text">
        <span className="micro">Your book</span>
        <strong>
          {cards.length === 0
            ? 'Add highlights to recall between levels'
            : `${cards.length} ${cards.length === 1 ? 'line' : 'lines'}${books > 1 ? ` from ${books} books` : ''} · ${due} due`}
        </strong>
      </span>
      <span className="daily-go">{cards.length === 0 ? 'Add' : 'Open'}</span>
    </Link>
  );
}
