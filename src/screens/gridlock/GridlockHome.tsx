import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { SummaryRow } from '../../components/SummaryRow';
import { GameBanner } from '../world/GameBanner';
import { peekGridlock } from './save';

// Gridlock's front door: carry on the level you're on. The rules fold away.

export function GridlockHome() {
  const navigate = useNavigate();
  const [save] = useState(peekGridlock);

  return (
    <Page title="" back="/" game="gridlock">
      <div className="home front-door">
        <GameBanner id="gridlock" line={save.best ? `${save.best} ${save.best === 1 ? 'car' : 'cars'} driven out` : 'Slide, shuffle, drive out. No clock, no losing.'} />

        <button className="button primary" onClick={() => navigate('/gridlock/play')}>
          {save.started ? `Carry on · Level ${save.level}` : `Play · Level ${save.level}`}
        </button>

        <div className="home-more">
          <SummaryRow label="How to play" title="How to play Gridlock">
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
      <p>The car park is jammed. Get the red car out through the gap in the right-hand wall.</p>
      <p>Drag a car to slide it. Cars only drive forwards and back the way they face, and can't pass through each other. A slide of any length is one move.</p>
      <p>Each level says the fewest moves it can be done in, to aim for; any number counts.</p>
      <p>There's no way to lose. Undo takes back a slide, and Hint shows the next slide of a fewest way out from where you are. Every slide is saved, so put it down whenever you like.</p>
    </div>
  );
}
