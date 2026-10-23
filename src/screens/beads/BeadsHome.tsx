import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { SummaryRow } from '../../components/SummaryRow';
import { GameBanner } from '../world/GameBanner';
import { peekBeads } from './save';

// Bead Sort's front door: carry on the level you're on. The rules fold away.

export function BeadsHome() {
  const navigate = useNavigate();
  const [save] = useState(peekBeads);

  return (
    <Page title="" back="/" game="beads">
      <div className="home front-door">
        <GameBanner id="beads" line={save.best ? `${save.best} ${save.best === 1 ? 'level' : 'levels'} sorted` : 'One colour to a tube. No clock, no losing.'} />

        <button className="button primary" onClick={() => navigate('/beads/play')}>
          {save.started ? `Carry on · Level ${save.level}` : `Play · Level ${save.level}`}
        </button>

        <div className="home-more">
          <SummaryRow label="How to play" title="How to play Bead Sort">
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
      <p>Sort the beads so every tube holds one colour, or nothing.</p>
      <p>Tap a tube to pick up its top beads, then tap another tube to drop them in. They go onto an empty tube, or onto beads of the same colour with room above.</p>
      <p>Every level can be sorted. Stuck? Undo as far back as you like, start the level again, or ask for a hint. Every move is saved, so put it down whenever you like.</p>
    </div>
  );
}
