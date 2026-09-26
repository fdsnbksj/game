import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { TabBar } from './components/TabBar';
import { Books } from './screens/Books';
import { Home } from './screens/Home';
import { HowToPlay } from './screens/HowToPlay';
import { Play } from './screens/Play';
import { Profile } from './screens/Profile';
import { Rankings } from './screens/Rankings';
import { startSession } from './services/auth';

/** The puzzle screens, which use the whole height and hide the tab bar. */
export const PLAY_PATHS = ['/play', '/daily'];

export function App() {
  // In the background: everything plays without it, which matters in a tunnel.
  useEffect(() => startSession(), []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play" element={<Play which="ladder" />} />
        <Route path="/daily" element={<Play which="daily" />} />
        <Route path="/books" element={<Books />} />
        <Route path="/how" element={<HowToPlay />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/ranks" element={<Rankings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Navigation />
    </BrowserRouter>
  );
}

function Navigation() {
  const { pathname } = useLocation();
  return PLAY_PATHS.includes(pathname) ? null : <TabBar />;
}
