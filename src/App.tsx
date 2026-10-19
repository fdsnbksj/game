import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { rememberPage } from './lastPage';
import { Account } from './screens/Account';
import { AvalonHome } from './screens/avalon/AvalonHome';
import { Room } from './screens/avalon/Room';
import { WondersHome } from './screens/wonders/WondersHome';
import { WondersRoom } from './screens/wonders/WondersRoom';
import { Home } from './screens/hero/Home';
import { GameList } from './screens/world/GameList';
import { HeroRoom } from './screens/hero/HeroRoom';
import { LocalFight } from './screens/hero/LocalFight';
import { BluffHome } from './screens/bluff/BluffHome';
import { BluffRoom } from './screens/bluff/BluffRoom';
import { SkyHome } from './screens/sky/SkyHome';
import { SkyPlay } from './screens/sky/SkyPlay';
import { WorldShell } from './screens/world/WorldShell';
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
<GameList />
          }
        />
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
        <Route path="/wonders" element={<WondersHome />} />
        <Route path="/wonders/:code" element={<WondersRoom />} />
        <Route path="/bluff" element={<BluffHome />} />
        <Route path="/bluff/:code" element={<BluffRoom />} />
        <Route path="/sky" element={<SkyHome />} />
        <Route path="/sky/play" element={<SkyPlay />} />
        <Route path="/hero" element={<Home />} />
        <Route path="/hero/local" element={<LocalFight />} />
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
