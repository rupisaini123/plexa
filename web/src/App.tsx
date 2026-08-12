import { useEffect, useState } from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import { PlayerProvider } from './context/PlayerContext';
import { PlaylistActionsProvider } from './context/PlaylistActionsContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { LibraryPage } from './pages/LibraryPage';
import { PlaylistsPage } from './pages/PlaylistsPage';
import { SettingsPage } from './pages/SettingsPage';
import { fetchCsrf } from './lib/api';
import { AppBootstrapSkeleton } from './components/Skeleton';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCsrf()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <AppBootstrapSkeleton />;
  }

  if (!authed) {
    return (
      <ThemeProvider>
        <LoginPage onSuccess={() => setAuthed(true)} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <PlayerProvider>
        <PlaylistActionsProvider>
          <Routes>
            <Route element={<Layout onLogout={() => setAuthed(false)} />}>
              <Route index element={<DashboardPage />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="playlists" element={<PlaylistsPage />} />
              <Route path="search" element={<Navigate to="/library" replace />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </PlaylistActionsProvider>
      </PlayerProvider>
    </ThemeProvider>
  );
}
