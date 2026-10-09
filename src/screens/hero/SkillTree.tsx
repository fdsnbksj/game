import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { Sheet } from '../../components/Sheet';
import { buy, canBuy, GROUPS, NODES, pointsFor, spent, type NodeId, type NodeInfo, type Tree } from '../../games/hero/stats';
import { BALL_LEVELS } from '../../games/hero/skills';
import { useHeroStore } from '../../heroStore';
import { SkillIcon } from './Fight';

// The skill tree, laid out like a game's: a branch per group (All skills, Gambler, Body),
// each skill a row of ten level slots, chained until they open, with lines from the slot
// that opens the next row. Spending is a draft: Undo steps back, Confirm keeps it.

export function SkillTree() {
  const navigate = useNavigate();
  const saved = useHeroStore((s) => s.tree);
  const cleared = useHeroStore((s) => s.cleared);
  const commit = useHeroStore((s) => s.commit);
  const reset = useHeroStore((s) => s.reset);
  const fight = useHeroStore((s) => s.fight);
  // Each step of the draft, newest last; the first is the saved tree.
  const [steps, setSteps] = useState<Tree[]>([saved]);
  const [leaving, setLeaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [info, setInfo] = useState<NodeInfo | null>(null);
  const draft = steps.at(-1)!;
  const left = pointsFor(cleared) - spent(draft);
  const changed = steps.length > 1;

  const spend = (node: NodeId) => canBuy(draft, node, cleared) && setSteps([...steps, buy(draft, node)]);
  const confirm = () => {
    if (commit(draft)) setSteps([draft]);
  };
  const back = () => (changed ? setLeaving(true) : navigate('/'));

  return (
    <Page title="Skill tree" onBack={back}>
      <div className="st-board">
        {GROUPS.map((g) => {
          const nodes = NODES.filter((n) => n.group === g.id);
          const opener = nodes[0].needs;
          const open = !opener || draft[opener.node] >= opener.level;
          return (
            <section key={g.id} className={`st-branch st-${g.id}${open ? '' : ' shut'}`}>
              <header className="st-head">
                <strong className="tree-title">{g.name}</strong>
                <small>{opener && !open ? `Opens at ${name(opener.node)} ${opener.level}` : g.blurb}</small>
              </header>
              {nodes.map((n, i) => {
                const level = draft[n.id];
                const locked = !!n.needs && draft[n.needs.node] < n.needs.level;
                return (
                  <div key={n.id} className={`st-row${locked ? ' locked' : ''}`}>
                    {i > 0 && n.needs?.node === nodes[i - 1].id && <span className={`st-link${locked ? '' : ' on'}`} aria-hidden="true" />}
                    <button className="st-badge" onClick={() => setInfo(n)} aria-label={`About ${n.name}`}>
                      <NodeIcon id={n.id} />
                    </button>
                    <div className="st-main">
                      <span className="st-name">
                        {n.name} <small>{level}/{n.max}</small>
                      </span>
                      <span className="st-slots">
                        {Array.from({ length: n.max }, (_, k) => {
                          const owned = k < level;
                          const fresh = owned && k >= saved[n.id];
                          const next = k === level && canBuy(draft, n.id, cleared);
                          return (
                            <button
                              key={k}
                              className={`st-slot${owned ? ' owned' : ''}${fresh ? ' fresh' : ''}${next ? ' next' : ''}${!owned && !next ? ' chained' : ''}${n.id === 'roulette' && BALL_LEVELS.includes(k + 1) ? ' ball' : ''}`}
                              disabled={!next}
                              onClick={() => spend(n.id)}
                              aria-label={`${n.name} level ${k + 1}`}
                            >
                              {!owned && !next && <Chain />}
                              {next && '+'}
                            </button>
                          );
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      {fight && <p className="note center-note">Changes count from your next fight.</p>}
      <button className="button ghost" onClick={() => setResetting(true)}>
        Reset all (free)
      </button>

      <div className="st-bar">
        <span className="st-left">
          <strong>{left}</strong> {left === 1 ? 'POINT' : 'POINTS'} LEFT
        </span>
        <button className="button" disabled={!changed} onClick={() => setSteps(steps.slice(0, -1))}>
          Undo
        </button>
        <button className="button primary" disabled={!changed} onClick={confirm}>
          Confirm
        </button>
      </div>

      {info && (
        <Sheet title={info.name} onClose={() => setInfo(null)}>
          <p className="note">
            Each level: {info.per}. Up to {info.max}.{info.needs ? ` Opens at ${name(info.needs.node)} ${info.needs.level}.` : ''}
          </p>
          <button className="button" onClick={() => setInfo(null)}>
            Got it
          </button>
        </Sheet>
      )}
      {leaving && (
        <Sheet title="Keep these points?" onClose={() => setLeaving(false)}>
          <button
            className="button primary"
            onClick={() => {
              confirm();
              navigate('/');
            }}
          >
            Confirm and leave
          </button>
          <button className="button ghost" onClick={() => navigate('/')}>
            Throw them back
          </button>
        </Sheet>
      )}
      {resetting && (
        <Sheet title="Reset the tree?" onClose={() => setResetting(false)}>
          <p className="note">Every point comes back to spend again. It's free.</p>
          <button
            className="button primary"
            onClick={() => {
              reset();
              setSteps([useHeroStore.getState().tree]);
              setResetting(false);
            }}
          >
            Reset
          </button>
          <button className="button ghost" onClick={() => setResetting(false)}>
            Keep it
          </button>
        </Sheet>
      )}
    </Page>
  );
}

const name = (id: NodeId) => NODES.find((n) => n.id === id)!.name;

const Chain = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
    <rect x="5" y="10" width="14" height="10" rx="2" fill="currentColor" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.5" />
  </svg>
);

function NodeIcon({ id }: { id: NodeId }) {
  if (id === 'stopwatch' || id === 'roulette' || id === 'poker') return <SkillIcon skill={id} />;
  const path =
    id === 'hp'
      ? 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'
      : id === 'def'
        ? 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z'
        : id === 'crit'
          ? 'M13 2L5 14h6l-1 8 8-12h-6z'
          : 'M12 2l2.4 5.6L20 6l-3 5 4 4-5.6.6L14 22l-2-5-2 5-1.4-6.4L3 15l4-4-3-5 5.6 1.6z';
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path d={path} fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}
