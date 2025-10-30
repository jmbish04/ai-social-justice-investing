/**
 * React application entry point
 *
 * This is the main entry point for the React frontend app.
 * It initializes the React app with routing and global contexts.
 *
 * @module frontend/main
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import { AudioPlayerRoot } from './ui/audio/AudioPlayerRoot';
import './index.css';

// Lazy load pages
const BrainstormPage = React.lazy(() => import('./pages/BrainstormPage'));
const EpisodePage = React.lazy(() => import('./pages/EpisodePage'));
const HomePage = React.lazy(() => import('./pages/HomePage'));
const EpisodesListPage = React.lazy(() => import('./pages/EpisodesListPage'));

/**
 * Main App component with routing
 */
function App() {
  return (
    <AudioPlayerProvider>
      <BrowserRouter>
        <React.Suspense
          fallback={
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-lg">Loading...</div>
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/brainstorm" element={<BrainstormPage />} />
            <Route path="/brainstorm/:threadId" element={<BrainstormPage />} />
            <Route path="/episodes" element={<EpisodesListPage />} />
            <Route path="/episodes/:id" element={<EpisodePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </BrowserRouter>
      <AudioPlayerRoot />
    </AudioPlayerProvider>
  );
}

// Render app
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
