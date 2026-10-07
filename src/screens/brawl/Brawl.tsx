import { useState } from 'react';
import { Link } from 'react-router';
import { useBrawlStore } from '../../brawlStore';
import type { Match } from '../../games/brawl/state';
import { Page } from '../../components/Page';
import { Sheet } from '../../components/Sheet';
import { SummaryRow } from '../../components/SummaryRow';
import { BOT_NAMES, BrawlMatch } from './BrawlMatch';
import { HowToBrawl } from './HowTo';

const LEVELS = ['', 'Easy', 'Normal', 'Hard'];

/**
 * Stick Brawl: the front door (pick a fighter, then Fight), or the fight itself while one is
 * on. A fight in progress is saved, so leaving and coming back carries straight on.
 */
export function Brawl() {
  const match = useBrawlStore((s) => s.match);
  const keep = useBrawlStore((s) => s.keep);
  const finish = useBrawlStore((s) => s.finish);
  const start = useBrawlStore((s) => s.start);
  const quit = useBrawlStore((s) => s.quit);
  // The fight just finished: kept here, not saved, so the result shows once.
  const [ended, setEnded] = useState<Match | null>(null);
  const shown = match ?? ended;

  if (!shown) return <FrontDoor />;

  const again = () => {
    setEnded(null);
    start(newSeed());
  };

  return (
    <BrawlMatch
      key={shown.seed}
      initial={shown}
      onKeep={keep}
      onQuit={quit}
      onEnd={(m) => {
        setEnded(m);
        finish(m.winner === 0);
      }}
    >
      {ended && <Result match={ended} onAgain={again} onDone={() => setEnded(null)} />}
    </BrawlMatch>
  );
}

const newSeed = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function Result({ match, onAgain, onDone }: { match: Match; onAgain: () => void; onDone: () => void }) {
  const won = match.winner === 0;
  const you = match.fighters[0];
  const winner = match.winner !== null ? BOT_NAMES[match.winner] : '';
  return (
    <div className="overlay">
      <div className="panel" role="dialog" aria-label="Fight over">
        <p className="solved-title">Fight over</p>
        <p className="brawl-result">
          {won ? 'You win' : `${winner} wins`} {match.wins[match.winner ?? 0]}–{Math.max(...match.wins.filter((_, i) => i !== match.winner))}
        </p>
        <p className="note">
          {you.kos} {you.kos === 1 ? 'knockout' : 'knockouts'} · {you.dealt}% damage dealt
        </p>
        <button className="button primary" onClick={onAgain}>
          Fight again
        </button>
        <button className="button ghost" onClick={onDone}>
          Change fighter
        </button>
      </div>
    </div>
  );
}

function FrontDoor() {
  const bots = useBrawlStore((s) => s.bots);
  const level = useBrawlStore((s) => s.level);
  const wins = useBrawlStore((s) => s.wins);
  const fights = useBrawlStore((s) => s.fights);
  const choose = useBrawlStore((s) => s.choose);
  const start = useBrawlStore((s) => s.start);
  const [rules, setRules] = useState(false);

  return (
    <Page title="Stick Brawl">
      <p className="lead-note">Stick fighters, guns and blades, six stages. Last one standing takes the round; first to three wins. Played sideways, with both thumbs.</p>

      <SummaryRow label="Opponents" figures={`${bots} ${bots === 1 ? 'bot' : 'bots'} · ${LEVELS[level]}`}>
        <p className="group-title">Bots</p>
        <div className="segmented" role="radiogroup" aria-label="Bots">
          {([1, 2, 3] as const).map((n) => (
            <button key={n} role="radio" aria-checked={bots === n} onClick={() => choose({ bots: n })}>
              {n}
            </button>
          ))}
        </div>
        <p className="group-title">How good</p>
        <div className="segmented" role="radiogroup" aria-label="How good">
          {([1, 2, 3] as const).map((n) => (
            <button key={n} role="radio" aria-checked={level === n} onClick={() => choose({ level: n })}>
              {LEVELS[n]}
            </button>
          ))}
        </div>
      </SummaryRow>

      <div className="spacer" />
      {fights > 0 && (
        <p className="note center-note">
          Won {wins} of {fights}
        </p>
      )}
      <div className="front-door">
        <button className="button primary" onClick={() => start(newSeed())}>
          Fight
        </button>
        <Link className="button" to="/brawl/online">
          Play a friend
        </Link>
        <button className="button ghost" onClick={() => setRules(true)}>
          How to play
        </button>
      </div>
      {rules && (
        <Sheet title="How to play Stick Brawl" onClose={() => setRules(false)}>
          <div className="how-to">
            <HowToBrawl />
          </div>
          <button className="button" onClick={() => setRules(false)}>
            Got it
          </button>
        </Sheet>
      )}
    </Page>
  );
}
