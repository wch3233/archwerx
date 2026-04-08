import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import './index.css';
import { BlueprintProvider } from './context/BlueprintContext';
import { resolveKey } from './lib/api';
import { loadActiveSession, clearActive } from './lib/storage';
import BuilderView from './views/BuilderView';
import HistoryView from './views/HistoryView';
import DetailView from './views/DetailView';
import SettingsView from './views/SettingsView';

function RequireKey({ children }) {
  const location = useLocation();
  if (!resolveKey() && location.pathname !== '/settings') {
    return <Navigate to="/settings" replace />;
  }
  return children;
}

function SessionRecoveryGate({ children }) {
  const [decision, setDecision] = useState(null); // null = checking, 'resume' | 'discard' | 'none'
  const [session, setSession] = useState(null);

  useEffect(() => {
    const active = loadActiveSession();
    if (active && active.phase && active.phase !== 'complete' && active.phase !== 'idle') {
      setSession(active);
      setDecision(null);
    } else {
      setDecision('none');
    }
  }, []);

  function handleResume() {
    setDecision('resume');
  }

  function handleDiscard() {
    clearActive();
    setSession(null);
    setDecision('discard');
  }

  // Still checking
  if (decision === null && session === null) {
    setDecision('none');
  }

  // Show recovery prompt
  if (decision === null && session) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="max-w-md w-full mx-4 p-6 rounded-lg bg-zinc-900 border border-zinc-700">
          <h2 className="text-lg font-bold text-zinc-100 mb-2">Active Session Found</h2>
          <p className="text-zinc-400 text-sm mb-1">
            {session.description || 'Untitled Blueprint'}
          </p>
          <p className="text-zinc-500 text-xs mb-4 font-mono">
            Phase: {session.phase} &middot; {(session.architectHistory || []).length} entries
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleResume}
              className="flex-1 px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              Resume Session
            </button>
            <button
              onClick={handleDiscard}
              className="flex-1 px-4 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium transition-colors cursor-pointer"
            >
              Discard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}

function Nav() {
  const location = useLocation();

  function linkClass(path) {
    const active = location.pathname === path;
    return `text-sm font-medium transition-colors ${
      active ? 'text-cyan-400' : 'text-zinc-400 hover:text-zinc-200'
    }`;
  }

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-zinc-100 font-bold tracking-tight">
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0a2 2 0 01-2 2H7a2 2 0 01-2-2m0 0H3" />
          </svg>
          ArchWerx
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/" className={linkClass('/')}>Builder</Link>
          <Link to="/history" className={linkClass('/history')}>History</Link>
          <Link to="/settings" className={linkClass('/settings')}>
            {!resolveKey() && (
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5" />
            )}
            Settings
          </Link>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Nav />
      <RequireKey>
        <Routes>
          <Route path="/" element={<BuilderView />} />
          <Route path="/history" element={<HistoryView />} />
          <Route path="/blueprint/:id" element={<DetailView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </RequireKey>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BlueprintProvider>
      <BrowserRouter>
        <SessionRecoveryGate>
          <App />
        </SessionRecoveryGate>
      </BrowserRouter>
    </BlueprintProvider>
  </StrictMode>,
);
