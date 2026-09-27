import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
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
        <Route path="/" element={<Play />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/ranks" element={<Rankings />} />
        <Route path="/settings" element={<Settings />} />
        {/* Everything else, including old links and installed shortcuts, opens the puzzle. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
