import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Page } from '../../components/Page';
import { Sheet } from '../../components/Sheet';
import {
  available,
  buy,
  canBuy,
  canReset,
  GROUPS,
  levelCost,
  LOADOUT_SIZE,
  NODES,
  resetCost,
  SKILLS,
  type NodeId,
  type NodeInfo,
  type SkillId,
  type Tree,
} from '../../games/hero/stats';
import { useHeroStore } from '../../heroStore';
import { SKILL_NAME } from './Fight';

// The skill tree, kept plain: a list per branch (All skills, Gambler, Body), each node with
// its level, what a level does and a button to buy the next one at its price. Spending is a
// draft: Undo steps back, Confirm keeps it. Above it, the loadout: the skills you take into
// a fight.

export function SkillTree() {
  const navigate = useNavigate();
  const saved = useHeroStore((s) => s.tree);
  const cleared = useHeroStore((s) => s.cleared);
  const commit = useHeroStore((s) => s.commit);
  const reset = useHeroStore((s) => s.reset);
  const resets = useHeroStore((s) => s.resets);
  const loadout = useHeroStore((s) => s.loadout);
  const setLoadout = useHeroStore((s) => s.setLoadout);
  const fight = useHeroStore((s) => s.fight);
  // Each step of the draft, newest last; the first is the saved tree.
  const [steps, setSteps] = useState<Tree[]>([saved]);
  const [leaving, setLeaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [info, setInfo] = useState<NodeInfo | null>(null);
  const draft = steps.at(-1)!;
  const left = available(draft, cleared, resets);
  const price = resetCost(resets + 1);
  const changed = steps.length > 1;

  const spend = (node: NodeId) => canBuy(draft, node, cleared, resets) && setSteps([...steps, buy(draft, node)]);
  const toggle = (skill: SkillId) => {
    if (loadout.includes(skill)) setLoadout(loadout.filter((s) => s !== skill));
    else setLoadout([...loadout, skill]);
  };
  const confirm = () => {
    if (commit(draft)) setSteps([draft]);
  };
  const back = () => (changed ? setLeaving(true) : navigate('/'));

  return (
    <Page title="Skill tree" onBack={back}>
      <p className="group-title">
        Loadout · {loadout.length}/{LOADOUT_SIZE} · tap to bring or bench
      </p>
      <div className="st-loadout">
        {SKILLS.map((skill) => {
          const have = saved[skill] >= 1;
          const on = loadout.includes(skill);
          return (
            <button
              key={skill}
              className={`button${on ? ' primary' : ''}`}
              disabled={!have || (on ? loadout.length <= 1 : loadout.length >= LOADOUT_SIZE)}
              aria-pressed={on}
              onClick={() => toggle(skill)}
            >
              {have ? SKILL_NAME[skill] : 'Locked'}
            </button>
          );
        })}
      </div>

      {GROUPS.map((g) => (
        <section key={g.id}>
          <p className="group-title">
            {g.name} · {g.blurb}
          </p>
          <ul className="group">
            {NODES.filter((n) => n.group === g.id).map((n) => {
              const level = draft[n.id];
              const locked = !!n.needs && draft[n.needs.node] < n.needs.level;
              const cost = levelCost(n.id, level + 1);
              return (
                <li key={n.id} className="row st-row">
                  <button className="st-name" onClick={() => setInfo(n)} aria-label={`About ${n.name}`}>
                    <strong>{n.name}</strong> {level}/{n.max}
                    {level > saved[n.id] && ` (+${level - saved[n.id]})`}
                    <small>{locked ? `Opens at ${name(n.needs!.node)} ${n.needs!.level}` : n.per}</small>
                  </button>
                  {level < n.max && (
                    <button className="button" disabled={!canBuy(draft, n.id, cleared, resets)} onClick={() => spend(n.id)}>
                      +1 · {cost} {cost === 1 ? 'pt' : 'pts'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {fight && <p className="note center-note">Changes count from your next fight.</p>}
      <button className="button ghost" disabled={!canReset(cleared, resets)} onClick={() => setResetting(true)}>
        Reset all · costs {price} {price === 1 ? 'point' : 'points'}
      </button>

      <div className="st-bar">
        <span className="st-left">
          {left} {left === 1 ? 'point' : 'points'} left
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
          <p className="note">{priceLine(info)}</p>
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
          <p className="note">
            Every point comes back to spend again, less {price} for the reset. The one after costs {resetCost(resets + 2)}.
          </p>
          <button
            className="button primary"
            onClick={() => {
              reset();
              setSteps([useHeroStore.getState().tree]);
              setResetting(false);
            }}
          >
            Reset · −{price}
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

function priceLine(info: NodeInfo): string {
  const skill = (SKILLS as readonly NodeId[]).includes(info.id);
  const rest = info.cooldown ? ` After you use it, it rests ${info.cooldown} ${info.cooldown === 1 ? 'turn' : 'turns'}.` : skill ? ' It never rests.' : '';
  if (!skill) return `Level N costs N points.${rest}`;
  if (info.id === 'stopwatch') return `Level 2 costs 1 point, level 3 costs 2, and so on.${rest}`;
  return `Unlocking costs 5 points, then level 2 costs 1, level 3 costs 2, and so on.${rest}`;
}
