import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CreatureChip } from '../components/CreatureChip';
import { ItemChip } from '../components/ItemChip';
import { SoundToggle } from '../components/SoundToggle';
import { setMusicLevel, sfx, startMusic, stopMusic } from '../game/audio';
import { PhaserGame } from '../game/PhaserGame';
import { BattleScene, BOARD_HEIGHT, BOARD_WIDTH, CANVAS_ZOOM } from '../game/scenes/BattleScene';
import { useRunStore } from '../runStore';
import {
  getItem,
  getTrait,
  ITEM_ROUNDS,
  getUnit,
  LEVEL_XP,
  MAX_LEVEL,
  MAX_ROUNDS,
  REROLL_COST,
  STAR_PERCENT,
  TICKS_PER_SECOND,
  XP_COST,
  type TraitId,
} from '../sim/balance';
import { sellValue } from '../sim/economy';
import { boardCount, buy, buyXp, equip, ownedUnits, reroll, sell, unequip, whyNotBuy, type RunState, type Slot } from '../sim/planning';
import { activeTraits } from '../sim/traits';

const SCENES = [BattleScene];

const traitName = (id: TraitId) => getTrait(id).name;

export function Run() {
  const run = useRunStore((s) => s.run);
  const battle = useRunStore((s) => s.battle);
  const startRun = useRunStore((s) => s.startRun);

  // Arriving here without a run (a bookmark, or the last one ended) starts a fresh one.
  useEffect(() => {
    if (!useRunStore.getState().run) startRun();
  }, [startRun]);

  useEffect(() => {
    startMusic();
    return stopMusic;
  }, []);

  useEffect(() => {
    if (!run) return;
    setMusicLevel(battle ? (run.round >= 10 ? 3 : run.round >= 5 ? 2 : 1) : 0);
  }, [battle, run]);

  useRoundResultNotice();
  useOnlineSync();

  if (!run) return null;
  // During the replay, show the run as it was when the fight began.
  const shown = battle ? battle.before : run;

  return (
    <main className="screen run">
      <Hud run={shown} />
      <PhaserGame
        className="board-canvas"
        scenes={SCENES}
        width={BOARD_WIDTH * CANVAS_ZOOM}
        height={BOARD_HEIGHT * CANVAS_ZOOM}
        transparent
      />
      <TraitBar run={shown} opponent={battle ? { name: battle.opponent, kind: battle.opponentKind } : undefined} />
      {/* Both panels share one grid cell, so the board keeps its size when a fight starts. */}
      <div className="dock">
        <div className={battle ? 'dock-layer inactive' : 'dock-layer'} aria-hidden={battle ? true : undefined}>
          <Planning run={run} />
        </div>
        {battle && (
          <div className="dock-layer replay">
            <ReplayControls />
          </div>
        )}
      </div>
      <UnitSheet />
      <Notice />
      {run.done && !battle && <Summary run={run} />}
    </main>
  );
}

function Hud({ run }: { run: RunState }) {
  return (
    <header className="run-hud">
      <Link className="button small icon" to="/" aria-label="Home">
        ←
      </Link>
      <div className="hud-round">
        <span className="eyebrow">{run.mode === 'daily' ? 'Daily' : 'Round'}</span>
        <strong>
          {run.round}
          <small>/{MAX_ROUNDS}</small>
        </strong>
      </div>
      <div className="hud-hp" aria-label={`${run.hp} health`}>
        <div className="hp-bar">
          <span style={{ width: `${run.hp}%` }} />
        </div>
        <strong>{run.hp}</strong>
      </div>
      <div className="hud-wins" aria-label={`${run.wins} wins`}>
        <strong>{run.wins}</strong>
        <span className="eyebrow">Wins</span>
      </div>
      <SoundToggle />
    </header>
  );
}

function TraitBar({ run, opponent }: { run: RunState; opponent?: { name: string; kind: 'ghost' | 'bot' } }) {
  const notify = useRunStore((s) => s.notify);
  const traits = activeTraits(run.board.flatMap((unit) => (unit ? [unit.unitId] : [])))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.tier - a.tier || b.count - a.count);
  return (
    <div className="trait-bar">
      {opponent ? (
        <span className="versus">
          vs {opponent.name}
          <small className={`rival-kind ${opponent.kind}`}>{opponent.kind === 'ghost' ? 'player' : 'bot'}</small>
        </span>
      ) : (
        <span className="board-count">
          {boardCount(run)}/{run.level}
        </span>
      )}
      {traits.map(({ trait, count, tier }) => (
        <button
          key={trait.id}
          className={`trait-chip tier-${tier}`}
          onClick={() =>
            notify(
              `${trait.name} (${trait.thresholds.join('/')}): ${trait.values
                .map((value) => trait.description.replace('{v}', `${value}`))
                .join(' → ')}`,
            )
          }
        >
          {trait.name} <b>{count}</b>
          <small>/{count >= trait.thresholds[0] ? trait.thresholds[1] : trait.thresholds[0]}</small>
        </button>
      ))}
      {traits.length === 0 && !opponent && <span className="muted hint">Drag units from the bench onto your hexes</span>}
    </div>
  );
}

function Planning({ run }: { run: RunState }) {
  const act = useRunStore((s) => s.act);
  const notify = useRunStore((s) => s.notify);
  const fight = useRunStore((s) => s.fight);
  const xpInto = run.xp - LEVEL_XP[run.level];
  const xpNeeded = run.level < MAX_LEVEL ? LEVEL_XP[run.level + 1] - LEVEL_XP[run.level] : 0;
  const empty = boardCount(run) === 0 && ownedUnits(run).length === 0;

  return (
    <>
      <section className="controls">
        <div className="gold" aria-label={`${run.gold} gold`}>
          <span className="coin" aria-hidden="true" />
          {run.gold}
        </div>
        <div className="level">
          <span>Lv {run.level}</span>
          <div className="xp-bar" aria-label={`${xpInto} of ${xpNeeded} XP`}>
            <span style={{ width: xpNeeded ? `${(xpInto / xpNeeded) * 100}%` : '100%' }} />
          </div>
        </div>
        <button
          className="button small"
          disabled={run.gold < XP_COST || run.level >= MAX_LEVEL}
          onClick={() => {
            const before = run.level;
            if (act(buyXp) && useRunStore.getState().run!.level > before) sfx.levelUp();
          }}
        >
          XP <span className="price">{XP_COST}</span>
        </button>
        <button className="button small" disabled={run.gold < REROLL_COST} onClick={() => act(reroll)}>
          ↻ <span className="price">{REROLL_COST}</span>
        </button>
      </section>

      {run.bag.length > 0 && (
        <div className="bag" aria-label="Items to give out">
          {run.bag.map((itemId, index) => (
            <ItemChip key={`${itemId}-${index}`} itemId={itemId} />
          ))}
          <span className="muted hint">Tap a creature to give it one</span>
        </div>
      )}

      <section className="shop" aria-label="Shop">
        {run.shop.map((unitId, index) =>
          unitId ? (
            <ShopCard
              key={index}
              unitId={unitId}
              owned={ownedUnits(run).filter((u) => u.unitId === unitId && u.star === 1).length}
              affordable={run.gold >= getUnit(unitId).cost}
              onBuy={() => {
                const reason = whyNotBuy(run, index);
                if (reason) notify(reason);
                else if (act((r) => buy(r, index))) sfx.buy();
              }}
            />
          ) : (
            <div key={index} className="shop-card sold" aria-hidden="true" />
          ),
        )}
      </section>

      <button className="button primary fight-button" disabled={empty} onClick={fight}>
        Fight
      </button>
    </>
  );
}

function ShopCard({ unitId, owned, affordable, onBuy }: { unitId: string; owned: number; affordable: boolean; onBuy: () => void }) {
  const unit = getUnit(unitId);
  return (
    <button className={`shop-card cost-${unit.cost}${affordable ? '' : ' poor'}`} onClick={onBuy}>
      {owned > 0 && <span className="owned-badge">{owned}/3</span>}
      <CreatureChip unitId={unitId} size={44} />
      <span className="card-name">{unit.name}</span>
      <span className="card-traits">
        {traitName(unit.origin)} · {traitName(unit.role)}
      </span>
      <span className="card-cost">
        <span className="coin" aria-hidden="true" />
        {unit.cost}
      </span>
    </button>
  );
}

function ReplayControls() {
  const speed = useRunStore((s) => s.speed);
  const setSpeed = useRunStore((s) => s.setSpeed);
  const endReplay = useRunStore((s) => s.endReplay);
  return (
    <section className="replay-controls">
      <button className="button" aria-pressed={speed === 1} onClick={() => setSpeed(1)}>
        ×1
      </button>
      <button className="button" aria-pressed={speed === 2} onClick={() => setSpeed(2)}>
        ×2
      </button>
      <button className="button" onClick={endReplay}>
        Skip ⏭
      </button>
    </section>
  );
}

function UnitSheet() {
  const selected = useRunStore((s) => s.selected);
  const run = useRunStore((s) => s.run);
  const battle = useRunStore((s) => s.battle);
  const act = useRunStore((s) => s.act);
  const select = useRunStore((s) => s.select);
  const unit = selected && run ? (selected.area === 'board' ? run.board : run.bench)[selected.index] : null;
  if (!run || !unit || !selected || battle) return null;

  const def = getUnit(unit.unitId);
  const scale = (value: number) => Math.floor((value * STAR_PERCENT[unit.star]) / 100);
  const ability = def.ability;
  const perStar = ability.damage ?? ability.heal ?? ability.shield;
  const stats: [string, string | number][] = [
    ['Health', scale(def.hp)],
    ['Damage', scale(def.damage)],
    ['Attacks/s', (TICKS_PER_SECOND / def.attackTicks).toFixed(2)],
    ['Range', def.range],
    ['Armor', def.armor],
    ['Mana', `${def.startMana}/${def.maxMana}`],
  ];

  return (
    <div className="sheet-backdrop" onClick={() => select(null)}>
      <div className="sheet" role="dialog" aria-label={def.name} onClick={(event) => event.stopPropagation()}>
        <div className="sheet-head">
          <CreatureChip unitId={def.id} size={64} />
          <div>
            <h3>
              {def.name} <span className="stars">{'★'.repeat(unit.star)}</span>
            </h3>
            <p className="muted">
              {traitName(def.origin)} · {traitName(def.role)} · <span className="coin" aria-hidden="true" />
              {def.cost}
            </p>
          </div>
        </div>
        <dl className="sheet-stats">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="ability">
          <strong>{ability.name}</strong>
          <p className="muted">
            {ability.description}
            {perStar && ` ${perStar.slice(0, 3).join(' / ')}`}
            {ability.stunTicks && `, stun ${(ability.stunTicks / TICKS_PER_SECOND).toFixed(1)}s`}
          </p>
        </div>
        <TraitLines traits={[def.origin, def.role]} />
        <ItemSection slot={selected} held={unit.item} bag={run.bag} />
        <div className="sheet-actions">
          <button
            className="button danger"
            onClick={() => {
              if (act((r) => sell(r, selected as Slot))) sfx.sell();
              select(null);
            }}
          >
            Sell for <span className="coin" aria-hidden="true" />
            {sellValue(def.cost, unit.star)}
          </button>
          <button className="button" onClick={() => select(null)}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** The item a creature holds, and the ones waiting to be given out. */
function ItemSection({ slot, held, bag }: { slot: Slot; held?: string; bag: string[] }) {
  const act = useRunStore((s) => s.act);
  if (!held && bag.length === 0) return null;
  return (
    <div className="item-section">
      <p className="eyebrow">Item</p>
      {held && (
        <button className="item-row held" onClick={() => act((run) => unequip(run, slot))}>
          <ItemChip itemId={held} size={26} />
          <span>
            <strong>{getItem(held).name}</strong>
            <small className="muted">{getItem(held).description}</small>
          </span>
          <span className="take-off">Take off</span>
        </button>
      )}
      {bag.map((itemId, index) => (
        <button key={`${itemId}-${index}`} className="item-row" onClick={() => act((run) => equip(run, slot, itemId))}>
          <ItemChip itemId={itemId} size={26} />
          <span>
            <strong>{getItem(itemId).name}</strong>
            <small className="muted">{getItem(itemId).description}</small>
          </span>
          <span className="take-off">{held ? 'Swap' : 'Give'}</span>
        </button>
      ))}
    </div>
  );
}

function TraitLines({ traits }: { traits: TraitId[] }) {
  return (
    <ul className="trait-lines">
      {traits.map((id) => {
        const trait = getTrait(id);
        return (
          <li key={id}>
            <strong>{trait.name}</strong>{' '}
            <span className="muted">
              {trait.thresholds.map((t, i) => `(${t}) ${trait.description.replace('{v}', `${trait.values[i]}`)}`).join('  ')}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Notice() {
  const notice = useRunStore((s) => s.notice);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!notice) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 2400);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!notice || !visible) return null;
  return (
    <div key={notice.id} className="notice" role="status">
      {notice.text}
    </div>
  );
}

/** Once a replay ends, says what the round did to the run. */
function useRoundResultNotice() {
  const battle = useRunStore((s) => s.battle);
  const notify = useRunStore((s) => s.notify);
  const wasFighting = useRef(false);
  useEffect(() => {
    if (battle) {
      wasFighting.current = true;
      return;
    }
    if (!wasFighting.current) return;
    wasFighting.current = false;
    const last = useRunStore.getState().run?.history.at(-1);
    if (!last || useRunStore.getState().run?.done) return;
    const run = useRunStore.getState().run;
    const dropped = run && run.bag.length > 0 && ITEM_ROUNDS.includes(last.round) ? getItem(run.bag[run.bag.length - 1]) : null;
    const result = last.won ? `Round ${last.round} won` : `Round ${last.round} ${last.draw ? 'drawn' : 'lost'}: −${last.damage} HP`;
    notify(dropped ? `${result}. ${dropped.name} dropped!` : result);
  }, [battle, notify]);
}

function Summary({ run }: { run: RunState }) {
  const startRun = useRunStore((s) => s.startRun);
  const leaveRun = useRunStore((s) => s.leaveRun);
  const stats = useRunStore((s) => s.stats);
  const online = useRunStore((s) => s.online);
  const navigate = useNavigate();
  const survived = run.hp > 0;
  const saving = online !== null && online.status !== 'offline' && (online.status === 'starting' || online.pending.length > 0);
  // Leaving drops anything unsaved, so wait for the result, but not forever.
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!saving) return;
    const timer = setTimeout(() => setGaveUp(true), 12_000);
    return () => clearTimeout(timer);
  }, [saving]);
  const blocked = saving && !gaveUp;

  return (
    <div className="overlay">
      <div className="panel">
        <p className="eyebrow">{survived ? 'Run complete' : 'Knocked out'}</p>
        <p className="big-score">{run.wins}</p>
        <p className="muted">wins in {run.history.length} rounds</p>
        {run.wins >= stats.bestWins && run.wins > 0 && <p className="highlight">Best run yet!</p>}
        <ol className="round-strip" aria-label="Round results">
          {run.history.map((round) => (
            <li key={round.round} className={round.won ? 'won' : round.draw ? 'draw' : 'lost'} title={`Round ${round.round}`} />
          ))}
        </ol>
        {survived && <p className="muted">{run.hp} HP left</p>}
        <p className="muted status-line small-print">
          {blocked ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Saving your result…
            </>
          ) : online?.status === 'live' && !saving ? (
            <Link to="/ranks">See today's rankings</Link>
          ) : (
            "This run couldn't be saved online, so it isn't ranked."
          )}
        </p>
        <div className="menu">
          <button className="button primary" disabled={blocked} onClick={() => startRun()}>
            New run
          </button>
          <button
            className="button"
            disabled={blocked}
            onClick={() => {
              leaveRun();
              navigate('/');
            }}
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}

/** Keeps the run's Firestore writes moving, and finds a real player's board for each round. */
function useOnlineSync() {
  const round = useRunStore((s) => s.run?.round);
  const fighting = useRunStore((s) => s.battle !== null);
  const sync = useRunStore((s) => s.sync);
  const prepareOpponent = useRunStore((s) => s.prepareOpponent);

  useEffect(() => {
    void sync();
    const retry = () => void sync();
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [sync]);

  useEffect(() => {
    if (!fighting) void prepareOpponent();
  }, [round, fighting, prepareOpponent]);
}
