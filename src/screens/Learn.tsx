import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { looksLikeClippings, parseClippings, parsePasted } from '../learn/highlights';
import { dayNumber } from '../learn/schedule';
import { KNOWLEDGE, TOPICS } from '../learn/knowledge';
import { KnowledgeCard } from '../components/KnowledgeCard';
import { Toggle } from '../components/SettingsSheet';import { useLibraryStore, type Card } from '../libraryStore';
import { dayId } from '../shared/constants';

/**
 * What there is to learn between puzzles: a knowledge card after every solve, from the
 * topics chosen here, the cards saved to read again, and the player's own highlights,
 * which come back as lines to complete.
 */
export function Learn() {
  const cards = useLibraryStore((s) => s.cards);
  const topics = useLibraryStore((s) => s.topics);
  const setTopic = useLibraryStore((s) => s.setTopic);
  const saved = useLibraryStore((s) => s.saved);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const books = useMemo(() => {
    const byBook = new Map<string, Card[]>();
    for (const card of cards) byBook.set(card.book, [...(byBook.get(card.book) ?? []), card]);
    return [...byBook.entries()];
  }, [cards]);

  const added = (count: number) => {
    setNotice(count === 0 ? 'Nothing new: those lines are already here.' : `Added ${count} ${count === 1 ? 'line' : 'lines'}.`);
    if (count > 0) setAdding(false);
  };

  return (
    <main className="screen with-tabs">
      <header className="page-head">
        <div>
          <p className="micro">Learn</p>
          <h1>Between puzzles</h1>
        </div>
      </header>

      <section className="glass card-pad">
        <p className="micro">A card after every puzzle</p>
        <p className="note">One short idea you can use, from the topics you choose. Save the ones worth keeping.</p>
        <div className="setting-list">
          {TOPICS.map((topic) => (
            <Toggle
              key={topic.id}
              label={`${topic.name} · ${KNOWLEDGE.filter((k) => k.topic === topic.id).length}`}
              on={topics.includes(topic.id)}
              onChange={(on) => setTopic(topic.id, on)}
            />
          ))}
        </div>
      </section>

      <p className="micro section-label">Saved · {saved.length}</p>
      {saved.length === 0 ? (
        <p className="note section-note">Tap Save on a card after a puzzle to keep it here.</p>
      ) : (
        saved.map((id) => (
          <section key={id} className="glass card-pad">
            <KnowledgeCard id={id} />
          </section>
        ))
      )}

      <div className="section-row">
        <p className="micro">Your highlights</p>
        {!adding && (
          <button className="button small" onClick={() => setAdding(true)}>
            Add
          </button>
        )}
      </div>
      {adding && <AddHighlights onAdded={added} onCancel={() => setAdding(false)} />}
      {books.length === 0 && !adding && (
        <p className="note section-note">
          Optional: add lines you highlighted in a book. After each level one comes back with a word missing, and you pick
          the word to open the next level. They stay on this phone.
        </p>
      )}
      {books.map(([book, list]) => (
        <BookPanel key={book} book={book} cards={list} />
      ))}

      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
    </main>
  );
}

function AddHighlights({ onAdded, onCancel }: { onAdded: (count: number) => void; onCancel: () => void }) {
  const add = useLibraryStore((s) => s.add);
  const [book, setBook] = useState('');
  const [text, setText] = useState('');
  const lines = parsePasted(text, book);

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const content = await file.text();
    onAdded(add(looksLikeClippings(content) ? parseClippings(content) : parsePasted(content, file.name.replace(/\.[^.]+$/, ''))));
  };

  return (
    <section className="glass card-pad add-highlights">
      <p className="micro">Paste</p>
      <input className="field" placeholder="Book title" value={book} maxLength={80} onChange={(e) => setBook(e.target.value)} />
      <textarea
        className="field"
        placeholder="Paste highlights or notes, one per paragraph"
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="add-actions">
        <button className="button ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="button primary" disabled={lines.length === 0 || book.trim() === ''} onClick={() => onAdded(add(lines))}>
          {lines.length > 0 ? `Add ${lines.length} ${lines.length === 1 ? 'line' : 'lines'}` : 'Add'}
        </button>
      </div>

      <p className="micro add-or">Or import a file</p>
      <label className="button">
        Kindle “My Clippings.txt” or a .txt
        <input type="file" accept=".txt,text/plain" hidden onChange={(e) => void importFile(e)} />
      </label>
      <p className="note">
        On a Kindle, connect it to a computer and copy documents/My Clippings.txt. From Apple Books or elsewhere, copy your
        highlights and paste them above.
      </p>
    </section>
  );
}

function BookPanel({ book, cards }: { book: string; cards: Card[] }) {
  const remove = useLibraryStore((s) => s.remove);
  const removeBook = useLibraryStore((s) => s.removeBook);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const today = dayNumber(dayId());
  const due = cards.filter((c) => c.review.due <= today).length;
  const known = cards.filter((c) => c.review.box >= 3).length;

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <section className="glass book">
      <button className="book-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="book-title">
          <strong>{book}</strong>
          <span className="micro">
            {cards.length} {cards.length === 1 ? 'line' : 'lines'} · {due} due · {known} known
          </span>
        </span>
        <svg className="chevron" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <>
          <ul className="lines">
            {cards.map((card) => (
              <li key={card.id}>
                <span>{card.text}</span>
                <button className="icon-button" aria-label="Remove this line" onClick={() => remove(card.id)}>
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <div className="book-foot">
            <button
              className={confirming ? 'button danger' : 'button ghost'}
              onClick={() => (confirming ? removeBook(book) : setConfirming(true))}
            >
              {confirming ? 'Tap again to remove this book' : 'Remove book'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
