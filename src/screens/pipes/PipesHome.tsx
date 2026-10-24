import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { SummaryRow } from '../../components/SummaryRow';
import { GameBanner } from '../world/GameBanner';
import { peekPipes } from './save';

// Waterworks' front door: carry on the level you're on. The rules fold away.

export function PipesHome() {
  const navigate = useNavigate();
  const [save] = useState(peekPipes);

  return (
    <Page title="" back="/" game="pipes">
      <div className="home front-door">
        <GameBanner id="pipes" line={save.best ? `${save.best} ${save.best === 1 ? 'level' : 'levels'} solved` : 'Turn the pipes. No clock, no losing.'} />

        <button className="button primary" onClick={() => navigate('/pipes/play')}>
          {save.started ? `Carry on · Level ${save.level}` : `Play · Level ${save.level}`}
        </button>

        <div className="home-more">
          <SummaryRow label="How to play" title="How to play Waterworks">
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
      <p>Every tile is a piece of pipe, turned the wrong way. Tap a tile to turn it a quarter clockwise.</p>
      <p>Water runs from the spring, the big round tile, through every pipe that meets the next one. Pipes turn blue as it reaches them.</p>
      <p>Solved when water reaches every tile and no pipe is left open: none pointing off the edge or at a tile that doesn't meet it. Any way that fits counts. Undo as far as you like; every tap is saved, so put it down whenever you like.</p>
    </div>
  );
}
