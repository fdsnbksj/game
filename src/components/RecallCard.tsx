import { useState } from 'react';
import { INTERVALS } from '../learn/schedule';
import { useLibraryStore, type Card } from '../libraryStore';
import type { JustSolved } from '../nonogramStore';
import { MiniGrid } from './Board';

/**
 * A line from the player's own highlights, one word blanked, to recall before the next
 * level. A wrong pick only greys out; there's no failing, just trying again. Getting it
 * first time sends the line further away; a miss brings it back soon.
 */
export function RecallCard({
  card,
  solved,
  onNext,
  onLeave,
}: {
  card: Card;
  solved: JustSolved | null;
  onNext: () => void;
  onLeave: () => void;
}) {
  const answer = useLibraryStore((s) => s.answer);
  // Made once: answering changes the card's review, which would change the question.
  const [question] = useState(() => useLibraryStore.getState().questionFor(card.id));
  const [wrong, setWrong] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  if (!question) return null;
  const firstTry = wrong.length === 0;
  const box = Math.min(card.review.box + 1, INTERVALS.length - 1);

  const choose = (choice: string) => {
    if (done) return;
    if (choice !== question.answer) {
      setWrong([...wrong, choice]);
      return;
    }
    answer(card.id, firstTry);
    setDone(true);
  };

  return (
    <div className="panel recall" role="dialog" aria-label="Recall a line from your book">
      {solved && (
        <div className="recall-solved">
          <MiniGrid size={solved.size} marks={solved.marks} px={40} />
          <span>
            <strong>Solved</strong>
            <span className="micro">{solved.title}</span>
          </span>
        </div>
      )}

      <p className="micro">{done ? 'From' : 'Fill the gap to open the next level'} · {card.book}</p>
      <p className="recall-line">
        {question.before}
        <span className={done ? 'blank filled' : 'blank'}>{done ? question.answer : ' '}</span>
        {question.after}
      </p>

      {done ? (
        <>
          <p className="note">
            {firstTry
              ? `Right first time. It comes back in ${INTERVALS[box]} ${INTERVALS[box] === 1 ? 'day' : 'days'}.`
              : "Got it. This line will come back soon."}
          </p>
          <button className="button primary big" onClick={onNext}>
            Next puzzle
          </button>
          <button className="button ghost" onClick={onLeave}>
            Back to my book
          </button>
        </>
      ) : (
        <div className="choices">
          {question.choices.map((choice) => {
            const missed = wrong.includes(choice);
            return (
              <button key={choice} className={missed ? 'button choice missed' : 'button choice'} disabled={missed} onClick={() => choose(choice)}>
                {choice}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
