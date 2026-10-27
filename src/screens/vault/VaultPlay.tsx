import { useEffect, useMemo, useRef, useState } from 'react';
import { Page } from '../../components/Page';
import { SummaryRow } from '../../components/SummaryRow';
import { CLEAR, TRY, codesLeft, fillMoves, hint, isSolved, newGame, play, undo, type Answer, type VaultGame } from '../../games/vault/vault';
import { HowTo } from './VaultHome';
import { loadVault, saveVault } from './save';

// Vault's play screen: the rows tried and the lock's answers in the middle, the row being made
// under them, the colours and Undo, Hint and Try under the thumb. Every tap is saved at once.

/** A small white mark on each colour, so pegs tell apart without seeing colour. */
const MARKS = [
  <circle cx="12" cy="12" r="3.2" />,
  <rect x="6.5" y="10.4" width="11" height="3.2" rx="1" />,
  <rect x="10.4" y="6.5" width="3.2" height="11" rx="1" />,
  <path d="M12 6.8l5.6 9.6H6.4z" />,
  <rect x="7.8" y="7.8" width="8.4" height="8.4" rx="1" />,
  <path d="M10.4 6.5h3.2v3.9h3.9v3.2h-3.9v3.9h-3.2v-3.9H6.5v-3.2h3.9z" />,
  <path d="M12 6.2l5.8 5.8-5.8 5.8-5.8-5.8z" />,
  <circle cx="12" cy="12" r="4.4" fill="none" stroke="currentColor" strokeWidth="2.4" />,
];

const NAMES = ['red', 'blue', 'yellow', 'green', 'purple', 'orange', 'pink', 'grey'];

function Peg({ colour }: { colour: number | null }) {
  if (colour === null) return <span className="vault-peg empty" aria-hidden="true" />;
  return (
    <svg className={`vault-peg c${colour}`} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <g className="vault-mark" fill="currentColor">
        {MARKS[colour]}
      </g>
    </svg>
  );
}

function AnswerDots({ answer, slots }: { answer: Answer; slots: number }) {
  const dots = Array.from({ length: slots }, (_, i) => (i < answer.exact ? 'exact' : i < answer.exact + answer.near ? 'near' : 'none'));
  return (
    <span className="vault-answer" role="img" aria-label={`${answer.exact} right place, ${answer.near} wrong place`}>
      {dots.map((kind, i) => (
        <span key={i} className={`vault-dot ${kind}`} />
      ))}
    </span>
  );
}

export function VaultPlay() {
  const [{ game, best }, setState] = useState(loadVault);
  const [hinted, setHinted] = useState(false);
  const { rules } = game;
  const solved = isSolved(game);
  const tries = game.tries.length;
  const full = !game.draft.includes(null);
  const left = useMemo(() => codesLeft(game), [game]);
  const rowsRef = useRef<HTMLDivElement>(null);

  // Keep the newest row in view as tries pile up.
  useEffect(() => {
    const rows = rowsRef.current;
    if (rows) rows.scrollTop = rows.scrollHeight;
  }, [tries]);

  const update = (next: VaultGame, nextBest = best) => {
    setState({ game: next, best: nextBest });
    saveVault(next, nextBest);
    setHinted(false);
  };

  const move = (m: number) => {
    const next = play(game, m);
    if (next === game) return;
    // A solved level counts at once, so leaving before Next keeps it.
    update(next, isSolved(next) ? Math.max(best, next.level) : best);
  };

  const giveHint = () => {
    const code = hint(game);
    if (!code) return;
    let next = game;
    for (const m of fillMoves(game, code)) next = play(next, m);
    update(next);
    setHinted(true);
  };

  const already = full && game.tries.some((t) => t.guess.every((c, i) => c === game.draft[i]));
  const usedColour = (c: number) => !rules.repeats && game.draft.includes(c);

  return (
    <Page title={`Level ${game.level}`} back="/vault" game="vault">
      <div className="vault-play">
        <SummaryRow
          label={solved ? 'Open!' : tries === 0 ? `${rules.slots} pegs, ${rules.colours} colours` : `${left} ${left === 1 ? 'code fits' : 'codes fit'}`}
          figures={`${rules.repeats ? 'Repeats' : 'No repeats'}${best ? ` · Best level ${best}` : ''}`}
          title="How to play"
        >
          <HowTo />
        </SummaryRow>

        <div className="vault-rows" ref={rowsRef} aria-label="Rows tried">
          {game.tries.map((t, i) => (
            <div key={i} className="vault-row">
              <span className="vault-num">{i + 1}</span>
              <span className="vault-pegs">
                {t.guess.map((c, s) => (
                  <Peg key={s} colour={c} />
                ))}
              </span>
              <AnswerDots answer={t.answer} slots={rules.slots} />
            </div>
          ))}
          {tries === 0 && <p className="vault-empty">Your tries and the lock's answers show here.</p>}
        </div>

        {solved ? (
          <div className="vault-row vault-open" aria-label="The code">
            <span className="vault-num">✓</span>
            <span className="vault-pegs">
              {game.code.map((c, s) => (
                <Peg key={s} colour={c} />
              ))}
            </span>
            <span className="vault-open-label">Open</span>
          </div>
        ) : (
          <div className="vault-row vault-draft" aria-label="Your row">
            <span className="vault-num">{tries + 1}</span>
            <span className="vault-pegs">
              {game.draft.map((c, s) => (
                <button key={s} type="button" className="vault-slot" onClick={() => move(CLEAR + s)} disabled={c === null} aria-label={c === null ? 'Empty slot' : `Take out ${NAMES[c]}`}>
                  <Peg colour={c} />
                </button>
              ))}
            </span>
          </div>
        )}

        <p className="note vault-note" aria-live="polite">
          {solved
            ? `Opened in ${tries} ${tries === 1 ? 'try' : 'tries'}.`
            : already
              ? 'You tried that row already.'
              : hinted
                ? 'This code fits every answer so far. Try it.'
                : tries === 0 && !game.draft.some((c) => c !== null)
                  ? `Tap colours to make a row of ${rules.slots}, then Try.`
                  : '● right place · ○ wrong place'}
        </p>

        <div className="spacer" />

        {solved ? (
          <button className="button primary" onClick={() => update(newGame(game.level + 1))}>
            Next level
          </button>
        ) : (
          <>
            <div className="vault-colours" style={{ gridTemplateColumns: `repeat(${rules.colours <= 4 ? rules.colours : Math.ceil(rules.colours / 2)}, minmax(0, 1fr))` }}>
              {Array.from({ length: rules.colours }, (_, c) => (
                <button key={c} type="button" className="vault-colour" onClick={() => move(c)} disabled={full || usedColour(c)} aria-label={`Add ${NAMES[c]}`}>
                  <Peg colour={c} />
                </button>
              ))}
            </div>
            <div className="vault-controls">
              <button className="button" onClick={() => update(undo(game))} disabled={game.moves.length === 0}>
                Undo
              </button>
              <button className="button" onClick={giveHint}>
                Hint
              </button>
              <button className="button primary" onClick={() => move(TRY)} disabled={!full || already}>
                Try
              </button>
            </div>
          </>
        )}
      </div>
    </Page>
  );
}
