import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { SummaryRow } from '../../components/SummaryRow';
import { GameBanner } from '../world/GameBanner';
import { peekVault } from './save';

// Vault's front door: carry on the level you're on. The rules fold away.

export function VaultHome() {
  const navigate = useNavigate();
  const [save] = useState(peekVault);

  return (
    <Page title="" back="/" game="vault">
      <div className="home front-door">
        <GameBanner id="vault" line={save.best ? `${save.best} ${save.best === 1 ? 'lock' : 'locks'} opened` : 'Work out the code. No clock, no losing.'} />

        <button className="button primary" onClick={() => navigate('/vault/play')}>
          {save.started ? `Carry on · Level ${save.level}` : `Play · Level ${save.level}`}
        </button>

        <div className="home-more">
          <SummaryRow label="How to play" title="How to play Vault">
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
      <p>The lock hides a row of coloured pegs. Tap colours to make a row of your own, then Try it.</p>
      <p>The lock answers with dots: a filled dot for each peg the right colour in the right place, a ring for each one the right colour in the wrong place. It doesn't say which pegs they are.</p>
      <p>Use the answers to work the code out. Early levels never repeat a colour; later ones can, and get more pegs and colours. Tap a peg in your row to take it out.</p>
      <p>There's no limit on tries. Hint fills your row with a code that fits every answer so far. Every tap is saved, so put it down whenever you like.</p>
    </div>
  );
}
