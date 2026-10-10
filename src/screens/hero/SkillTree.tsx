import { useLayoutEffect, useRef, useState } from 'react';
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
import { BALL_LEVELS } from '../../games/hero/skills';
import { useHeroStore } from '../../heroStore';
import { SKILL_NAME, SkillIcon } from './Fight';

// The skill tree, laid out like a game's: a branch per group (All skills, Gambler, Body),
// each skill a row of ten level slots, chained until they open. Like a map, a road runs
// from the exact slot that opens a skill (Stopwatch 5 → I'm Speed) to that skill's badge,
// lit once it's open; the next slot shows its price. Spending is a draft: Undo steps
// back, Confirm keeps it. Above it, the loadout: the skills you take into a fight.

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
      <section className="st-loadout" aria-label="Loadout">
        <header className="st-head">
          <strong className="tree-title">Loadout</strong>
          <small>
            {loadout.length}/{LOADOUT_SIZE} · tap to bring or bench
          </small>
        </header>
        <div className="st-loadout-row">
          {SKILLS.map((skill) => {
            const have = saved[skill] >= 1;
            const on = loadout.includes(skill);
            return (
              <button
                key={skill}
                className={`st-pick${on ? ' on' : ''}${have ? '' : ' locked'}`}
                disabled={!have || (on ? loadout.length <= 1 : loadout.length >= LOADOUT_SIZE)}
                aria-pressed={on}
                onClick={() => toggle(skill)}
              >
                <SkillIcon skill={skill} />
                <small>{have ? SKILL_NAME[skill] : 'Locked'}</small>
              </button>
            );
          })}
        </div>
      </section>

      <div className="st-board">
        <Roads draft={draft} />
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
              {nodes.map((n) => {
                const level = draft[n.id];
                const locked = !!n.needs && draft[n.needs.node] < n.needs.level;
                return (
                  <div key={n.id} className={`st-row${locked ? ' locked' : ''}`}>
                    <button data-badge={n.id} className="st-badge" onClick={() => setInfo(n)} aria-label={`About ${n.name}`}>
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
                          const next = k === level && canBuy(draft, n.id, cleared, resets);
                          // The next level, open but more than you have: its price, greyed.
                          const pricey = k === level && !next && !locked;
                          const cost = levelCost(n.id, k + 1);
                          // This slot opens another skill: a road starts here.
                          const opens = NODES.find((m) => m.needs?.node === n.id && m.needs.level === k + 1);
                          return (
                            <button
                              key={k}
                              data-slot={`${n.id}:${k + 1}`}
                              className={`st-slot${owned ? ' owned' : ''}${fresh ? ' fresh' : ''}${next ? ' next' : ''}${pricey ? ' pricey' : ''}${!owned && !next && !pricey ? ' chained' : ''}${n.id === 'roulette' && BALL_LEVELS.includes(k + 1) ? ' ball' : ''}${opens ? ' opens' : ''}`}
                              disabled={!next}
                              onClick={() => spend(n.id)}
                              aria-label={`${n.name} level ${k + 1}${next || pricey ? `, ${cost} ${cost === 1 ? 'point' : 'points'}` : ''}`}
                            >
                              {!owned && !next && !pricey && <Chain />}
                              {(next || pricey) && cost}
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
      <button className="button ghost" disabled={!canReset(cleared, resets)} onClick={() => setResetting(true)}>
        Reset all · costs {price} {price === 1 ? 'point' : 'points'}
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

/** Where an element sits inside `root`, by offsets (so a slot's pulsing scale doesn't move it). */
function boxIn(el: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  for (let at: HTMLElement | null = el; at && at !== root; at = at.offsetParent as HTMLElement | null) {
    x += at.offsetLeft;
    y += at.offsetTop;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

interface Road {
  id: NodeId;
  d: string;
  open: boolean;
  end: { x: number; y: number };
}

/**
 * The roads between skills, drawn over the board. Each leaves the bottom of the slot that
 * opens a skill. When that skill's row is just below, the road crosses the gap between the
 * rows and drops onto its badge; otherwise (another branch, should a skill ever need one) it
 * runs down the left margin and turns into the badge from the side, so it never crosses a slot.
 */
function Roads({ draft }: { draft: Tree }) {
  const svg = useRef<SVGSVGElement>(null);
  const [roads, setRoads] = useState<Road[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    // The board is the roads' own parent (its ref isn't attached yet when this runs).
    const root = svg.current?.parentElement;
    if (!root) return;
    const measure = () => {
      const next: Road[] = [];
      for (const n of NODES) {
        if (!n.needs) continue;
        const slot = root.querySelector<HTMLElement>(`[data-slot="${n.needs.node}:${n.needs.level}"]`);
        const badge = root.querySelector<HTMLElement>(`[data-badge="${n.id}"]`);
        if (!slot || !badge) continue;
        const a = boxIn(slot, root);
        const b = boxIn(badge, root);
        const fromRow = slot.closest('.st-row') as HTMLElement;
        const toRow = badge.closest('.st-row') as HTMLElement;
        const sx = a.x + a.w / 2;
        const sy = a.y + a.h;
        const rowBottom = boxIn(fromRow, root).y + fromRow.offsetHeight;
        let d: string;
        let end: { x: number; y: number };
        if (fromRow.nextElementSibling === toRow) {
          const gap = (rowBottom + boxIn(toRow, root).y) / 2;
          const bx = b.x + b.w / 2;
          end = { x: bx, y: b.y };
          d = `M${sx} ${sy} V${gap} H${bx} V${b.y}`;
        } else {
          const gap = rowBottom + 5;
          const lane = b.x - 14;
          const by = b.y + b.h / 2;
          end = { x: b.x, y: by };
          d = `M${sx} ${sy} V${gap} H${lane} V${by} H${b.x}`;
        }
        next.push({ id: n.id, d, open: draft[n.needs.node] >= n.needs.level, end });
      }
      setRoads(next);
      setSize({ w: root.offsetWidth, h: root.offsetHeight });
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(root);
    void document.fonts?.ready.then(measure);
    return () => watch.disconnect();
  }, [draft]);

  return (
    <svg ref={svg} className="st-roads" width={size.w} height={size.h} aria-hidden="true">
      {roads.map((r) => (
        <g key={r.id} className={r.open ? 'open' : 'shut'}>
          <path className="st-road-edge" d={r.d} />
          <path className="st-road" d={r.d} />
          <circle className="st-road-end" cx={r.end.x} cy={r.end.y} r="5" />
        </g>
      ))}
    </svg>
  );
}

function priceLine(info: NodeInfo): string {
  const skill = (SKILLS as readonly NodeId[]).includes(info.id);
  const rest = info.cooldown ? ` After you use it, it rests ${info.cooldown} ${info.cooldown === 1 ? 'turn' : 'turns'}.` : skill ? ' It never rests.' : '';
  if (!skill) return `Level N costs N points.${rest}`;
  if (info.id === 'stopwatch') return `Level 2 costs 1 point, level 3 costs 2, and so on.${rest}`;
  return `Unlocking costs 5 points, then level 2 costs 1, level 3 costs 2, and so on.${rest}`;
}

const Chain = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
    <rect x="5" y="10" width="14" height="10" rx="2" fill="currentColor" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.5" />
  </svg>
);

function NodeIcon({ id }: { id: NodeId }) {
  if ((SKILLS as readonly NodeId[]).includes(id)) return <SkillIcon skill={id as SkillId} />;
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
