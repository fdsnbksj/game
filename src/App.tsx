import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Account } from './screens/Account';
import { AvalonHome } from './screens/avalon/AvalonHome';
import { Room } from './screens/avalon/Room';
import { DuelHome } from './screens/duel/DuelHome';
import { DuelRoom } from './screens/duel/DuelRoom';
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
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/account" element={<Account />} />
        <Route path="/nonograms" element={<Play />} />
        <Route path="/avalon" element={<AvalonHome />} />
        <Route path="/avalon/:code" element={<Room />} />
        <Route path="/duel" element={<DuelHome />} />
        <Route path="/duel/:code" element={<DuelRoom />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/ranks" element={<Rankings />} />
        <Route path="/settings" element={<Settings />} />
        {/* Everything else, including old links and installed shortcuts, opens the home screen. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
