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
import { Home } from './screens/Home';
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
        <Route path="/" element={<Home />} />
        <Route path="/account" element={<Account />} />
        <Route path="/nonograms" element={<Play />} />
        <Route path="/avalon" element={<AvalonHome />} />
        <Route path="/avalon/:code" element={<Room />} />
        <Route path="/duel" element={<DuelHome />} />
        <Route path="/duel/:code" element={<DuelRoom />} />
        <Route path="/wonders" element={<WondersHome />} />
        <Route path="/wonders/:code" element={<WondersRoom />} />
        <Route path="/isle" element={<IsleHome />} />
        <Route path="/isle/:code" element={<IsleRoom />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/ranks" element={<Rankings />} />
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
