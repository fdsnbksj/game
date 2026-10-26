import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { SummaryRow } from '../../components/SummaryRow';
import { GameBanner } from '../world/GameBanner';
import { peekThreads } from './save';

// Threads' front door: carry on the level you're on. The rules fold away.

export function ThreadsHome() {
  const navigate = useNavigate();
  const [save] = useState(peekThreads);

  return (
    <Page title="" back="/" game="threads">
      <div className="home front-door">
        <GameBanner id="threads" line={save.best ? `${save.best} ${save.best === 1 ? 'level' : 'levels'} solved` : 'Join the pairs, fill the square. No clock, no losing.'} />

        <button className="button primary" onClick={() => navigate('/threads/play')}>
          {save.started ? `Carry on · Level ${save.level}` : `Play · Level ${save.level}`}
        </button>

        <div className="home-more">
          <SummaryRow label="How to play" title="How to play Threads">
            <HowTo />
          </SummaryRow>
        </div>
      </div>
    </Page>
  );
}

export function HowTo() {
  return (
    <div className="how-to">
      <p>Each colour has two knots. Drag from a knot to draw a thread, square by square (no diagonals), and finish on the other knot of the same colour.</p>
      <p>Threads can't cross or share a square, and the level is done when every pair is joined and every square is used. Any way that fits counts.</p>
      <p>Drag back over a thread to shorten it, start on any square of a thread to carry on from there, or tap a knot to clear its thread. Drawing across another thread cuts it. Undo as far as you like, or ask for a hint, which draws one thread for you; every stroke is saved, so put it down whenever you like.</p>
    </div>
  );
}
