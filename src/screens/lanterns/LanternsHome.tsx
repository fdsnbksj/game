import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { SummaryRow } from '../../components/SummaryRow';
import { GameBanner } from '../world/GameBanner';
import { peekLanterns } from './save';

// Lanterns' front door: carry on the level you're on. The rules fold away.

export function LanternsHome() {
  const navigate = useNavigate();
  const [save] = useState(peekLanterns);

  return (
    <Page title="" back="/" game="lanterns">
      <div className="home front-door">
        <GameBanner id="lanterns" line={save.best ? `${save.best} ${save.best === 1 ? 'level' : 'levels'} solved` : 'Put the lights out. No clock, no losing.'} />

        <button className="button primary" onClick={() => navigate('/lanterns/play')}>
          {save.started ? `Carry on · Level ${save.level}` : `Play · Level ${save.level}`}
        </button>

        <div className="home-more">
          <SummaryRow label="How to play" title="How to play Lanterns">
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
      <p>Some lanterns are lit. Tap a lantern and it flips, and so do the ones right beside it: above, below, left and right. Lit ones go out, dark ones light up.</p>
      <p>Put every lantern out. Each level says the fewest taps it can be done in; any number of taps counts, the fewest is just to aim for.</p>
      <p>Tapping the same lantern twice changes nothing, and the order doesn't matter. Undo as far as you like, or ask for a hint; every tap is saved, so put it down whenever you like.</p>
    </div>
  );
}
