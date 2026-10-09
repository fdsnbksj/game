import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { rememberPage } from './lastPage';
import { Account } from './screens/Account';
import { AvalonHome } from './screens/avalon/AvalonHome';
import { Room } from './screens/avalon/Room';
import { DuelHome } from './screens/duel/DuelHome';
import { DuelRoom } from './screens/duel/DuelRoom';
import { WondersHome } from './screens/wonders/WondersHome';
import { WondersRoom } from './screens/wonders/WondersRoom';
import { IsleHome } from './screens/isle/IsleHome';
import { IsleRoom } from './screens/isle/IsleRoom';
import { Brawl } from './screens/brawl/Brawl';
import { BrawlOnline } from './screens/brawl/BrawlOnline';
import { BrawlRoom } from './screens/brawl/BrawlRoom';
import { Arena } from './screens/hero/Arena';
import { ArenaFight } from './screens/hero/ArenaFight';
import { HeroFight } from './screens/hero/HeroFight';
import { Home } from './screens/hero/Home';
import { Summon } from './screens/hero/Summon';
import { Wardrobe } from './screens/hero/Wardrobe';
import { HeroOnline } from './screens/hero/HeroOnline';
import { HeroRoom } from './screens/hero/HeroRoom';
import { SkillTree } from './screens/hero/SkillTree';
import { WorldShell } from './screens/world/WorldShell';
import { Zone } from './screens/world/Zone';
import { Play } from './screens/Play';
import { Rankings } from './screens/Rankings';
import { Saved } from './screens/Saved';
import { Settings } from './screens/Settings';
import { startSession } from './services/auth';

export function App() {
  // In the background: the puzzle plays without it, which matters in a tunnel.
  useEffect(() => startSession(), []);

  return (
    <BrowserRouter>
      <RememberPage />
      <Routes>
        <Route
          path="/"
          element={
            <WorldShell>
              <Home />
            </WorldShell>
          }
        />
        <Route path="/zone/:id" element={<Zone />} />
        <Route
          path="/account"
          element={
            <WorldShell>
              <Account />
            </WorldShell>
          }
        />
        <Route path="/nonograms" element={<Play />} />
        <Route path="/avalon" element={<AvalonHome />} />
        <Route path="/avalon/:code" element={<Room />} />
        <Route path="/duel" element={<DuelHome />} />
        <Route path="/duel/:code" element={<DuelRoom />} />
        <Route path="/wonders" element={<WondersHome />} />
        <Route path="/wonders/:code" element={<WondersRoom />} />
        <Route path="/isle" element={<IsleHome />} />
        <Route path="/isle/:code" element={<IsleRoom />} />
        <Route path="/brawl" element={<Brawl />} />
        <Route path="/brawl/online" element={<BrawlOnline />} />
        <Route path="/brawl/:code" element={<BrawlRoom />} />
        <Route path="/hero" element={<Navigate to="/" replace />} />
        <Route
          path="/hero/wardrobe"
          element={
            <WorldShell>
              <Wardrobe />
            </WorldShell>
          }
        />
        <Route
          path="/hero/summon"
          element={
            <WorldShell>
              <Summon />
            </WorldShell>
          }
        />
        <Route path="/hero/tree" element={<SkillTree />} />
        <Route path="/hero/fight" element={<HeroFight />} />
        <Route path="/hero/arena" element={<Arena />} />
        <Route path="/hero/arena/fight" element={<ArenaFight />} />
        <Route path="/hero/online" element={<HeroOnline />} />
        <Route path="/hero/:code" element={<HeroRoom />} />
        <Route
          path="/saved"
          element={
            <WorldShell>
              <Saved />
            </WorldShell>
          }
        />
        <Route
          path="/ranks"
          element={
            <WorldShell>
              <Rankings />
            </WorldShell>
          }
        />
        <Route path="/settings" element={<Settings />} />
        {/* Everything else, including old links and installed shortcuts, opens the home screen. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

/** Saves every page as it opens, home included, so the app reopens where it was left. */
function RememberPage() {
  const { pathname } = useLocation();
  useEffect(() => rememberPage(pathname), [pathname]);
  return null;
}
