import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { SummaryRow } from '../../components/SummaryRow';
import { GameBanner } from '../world/GameBanner';
import { peekGlide } from './save';

// Glide's front door: carry on the level you're on. The rules fold away.

export function GlideHome() {
  const navigate = useNavigate();
  const [save] = useState(peekGlide);

  return (
    <Page title="" back="/" game="glide">
      <div className="home front-door">
        <GameBanner id="glide" line={save.best ? `${save.best} ${save.best === 1 ? 'level' : 'levels'} solved` : 'Swipe, slide, stop. No clock, no losing.'} />

        <button className="button primary" onClick={() => navigate('/glide/play')}>
          {save.started ? `Carry on · Level ${save.level}` : `Play · Level ${save.level}`}
        </button>

        <div className="home-more">
          <SummaryRow label="How to play" title="How to play Glide">
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
      <p>Bring every block to rest on the ring of its colour.</p>
      <p>Swipe a block and it slides on the ice until something stops it: a wall, the edge, or another block. It can't stop halfway, so look for what will catch it.</p>
      <p>Each level gives you exactly the fewest moves it can be done in. Out of moves? Undo as far back as you like, or start again; nothing is lost. Every move is saved, so put it down whenever you like.</p>
    </div>
  );
}
