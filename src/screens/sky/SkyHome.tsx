import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { SummaryRow } from '../../components/SummaryRow';
import { newRun, stageNumber } from '../../games/sky/sim';
import { GameBanner } from '../world/GameBanner';
import { loadSky, saveSky } from './save';
import { newSeed } from './SkyPlay';

// Sky Ace's front door: carry on the run you left, or start a new one. The rules fold away.

export function SkyHome() {
  const navigate = useNavigate();
  const [save] = useState(loadSky);
  const run = save.run;

  const start = () => {
    saveSky(newRun(newSeed()), Math.max(save.best, run?.score ?? 0));
    navigate('/sky/play');
  };

  return (
    <Page title="" back="/" game="sky">
      <div className="home front-door">
        <GameBanner id="sky" line={save.best ? `Best ${save.best.toLocaleString()}` : 'Fly, dodge, shoot. One thumb.'} />

        {run ? (
          <>
            <button className="button primary" onClick={() => navigate('/sky/play')}>
              Carry on · Stage {stageNumber(run)}
            </button>
            <button className="button" onClick={start}>
              New run
            </button>
          </>
        ) : (
          <button className="button primary" onClick={start}>
            Fly
          </button>
        )}

        <div className="home-more">
          <SummaryRow label="How to play" title="How to play Sky Ace">
            <div className="how-to">
              <p>Put your thumb anywhere and drag: the ship moves with it, and fires by itself. Lift your thumb and everything stops, so you can put it down any time; it's saved.</p>
              <p>Dodge the pink bullets: only the ship's centre counts. Touch B (bottom left) to bomb: it clears the bullets and hurts everything on screen.</p>
              <p>
                <strong>Pickups:</strong> V is the wide red shot, L the blue laser (strong straight ahead), M a homing missile, B a bomb. The same colour again powers it up.
              </p>
              <p>
                <strong>Medals</strong> drop from things on the ground: each one is worth more than the last, until you miss one. Kill a plane right as it shows up for a Quick shot, worth double.
              </p>
              <p>Each stage ends with a big one: knock out its guns, then its core. After stage 3 it starts again, harder. Out of ships, you can always carry on from where you are, for half your score.</p>
            </div>
          </SummaryRow>
        </div>
      </div>
    </Page>
  );
}
