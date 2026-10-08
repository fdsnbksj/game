import { useState } from 'react';
import { Page } from '../../components/Page';
import { Sheet } from '../../components/Sheet';
import { canBuy, NODES, type NodeId, type NodeInfo } from '../../games/hero/stats';
import { useHeroStore } from '../../heroStore';
import { SkillIcon } from './Fight';

/** The skill tree: the three skills as one branch, each opening the next, then the four stats. */
export function SkillTree() {
  const tree = useHeroStore((s) => s.tree);
  const cleared = useHeroStore((s) => s.cleared);
  const unspent = useHeroStore((s) => s.unspent());
  const buy = useHeroStore((s) => s.buy);
  const reset = useHeroStore((s) => s.reset);
  const fight = useHeroStore((s) => s.fight);
  const [confirm, setConfirm] = useState(false);

  const node = (info: NodeInfo) => {
    const level = tree[info.id];
    const locked = !!info.needs && tree[info.needs.node] < info.needs.level;
    const can = canBuy(tree, info.id, cleared);
    return (
      <button key={info.id} className={`tree-node${level ? ' owned' : ''}${locked ? ' locked' : ''}`} disabled={!can} onClick={() => buy(info.id)}>
        {isSkill(info.id) && <SkillIcon skill={info.id} />}
        <strong>{info.name}</strong>
        <span className="tree-pips" aria-label={`Level ${level} of ${info.max}`}>
          {Array.from({ length: info.max }, (_, i) => (
            <i key={i} className={i < level ? 'on' : undefined} />
          ))}
        </span>
        <small>
          {locked && info.needs
            ? `Needs ${NODES.find((n) => n.id === info.needs!.node)!.name} ${info.needs.level}`
            : level >= info.max
              ? 'Max'
              : info.per}
        </small>
      </button>
    );
  };

  const skills = NODES.filter((n) => isSkill(n.id));
  const stats = NODES.filter((n) => !isSkill(n.id));

  return (
    <Page title="Skill tree" back="/hero">
      <div className="tree-points frame">
        <span className="micro">Skill points</span>
        <strong>{unspent}</strong>
        <span className="note">{unspent ? 'Tap a node to spend one.' : 'Beat a new bot level to earn more.'}</span>
      </div>
      <p className="group-title">Skills</p>
      <div className="tree-branch">
        {skills.map((info, i) => (
          <div key={info.id} className="tree-step">
            {i > 0 && <span className={`tree-line${tree[info.id] ? ' on' : ''}`} aria-hidden="true" />}
            {node(info)}
          </div>
        ))}
      </div>
      <p className="group-title">Stats</p>
      <div className="tree-stats">{stats.map(node)}</div>
      {fight && <p className="note center-note">Changes count from your next fight.</p>}
      <button className="button ghost" onClick={() => setConfirm(true)}>
        Reset the tree
      </button>
      {confirm && (
        <Sheet title="Reset the tree?" onClose={() => setConfirm(false)}>
          <p className="note">Every point comes back to spend again. It's free.</p>
          <button
            className="button primary"
            onClick={() => {
              reset();
              setConfirm(false);
            }}
          >
            Reset
          </button>
          <button className="button ghost" onClick={() => setConfirm(false)}>
            Keep it
          </button>
        </Sheet>
      )}
    </Page>
  );
}

const isSkill = (id: NodeId): id is 'stopwatch' | 'roulette' | 'poker' => id === 'stopwatch' || id === 'roulette' || id === 'poker';
