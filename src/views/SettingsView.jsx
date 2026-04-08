import { useState, useEffect } from 'react';
import { resolveKey } from '../lib/api';
import { estimateUsage, clearHistory } from '../lib/storage';

const STORAGE_KEY = 'archwerx_api_key';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function maskKey(key) {
  if (!key || key.length < 12) return '****';
  return key.slice(0, 7) + '...' + key.slice(-4);
}

export default function SettingsView() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [storageChars, setStorageChars] = useState(0);
  const [quotaWarning, setQuotaWarning] = useState(null);

  const currentKey = resolveKey();
  const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY || null;
  const localKey = localStorage.getItem(STORAGE_KEY) || null;

  function refreshUsage() {
    setStorageChars(estimateUsage());
  }

  useEffect(() => {
    refreshUsage();

    function onQuotaExceeded(e) {
      setQuotaWarning({
        key: e.detail.key,
        bytesUsed: e.detail.bytesUsed,
      });
      refreshUsage();
    }

    window.addEventListener('archwerx:quota_exceeded', onQuotaExceeded);
    return () => window.removeEventListener('archwerx:quota_exceeded', onQuotaExceeded);
  }, []);

  function handleSave(e) {
    e.preventDefault();
    if (apiKey.trim()) {
      localStorage.setItem(STORAGE_KEY, apiKey.trim());
      setApiKey('');
      setSaved(true);
      refreshUsage();
      setTimeout(() => setSaved(false), 2000);
    }
  }

  function handleClear() {
    localStorage.removeItem(STORAGE_KEY);
    setSaved(false);
    refreshUsage();
  }

  function handleClearHistory() {
    if (window.confirm('Delete all blueprint history? This cannot be undone.')) {
      clearHistory();
      setQuotaWarning(null);
      refreshUsage();
    }
  }

  const hasKey = !!currentKey;
  const usageBytes = storageChars * 2;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-zinc-100 mb-6">Settings</h2>

      {!hasKey && (
        <div className="mb-6 p-4 rounded-lg bg-red-950/40 border border-red-700">
          <h3 className="text-red-300 font-bold text-sm mb-1">No API Key Configured</h3>
          <p className="text-red-400 text-xs">
            Add your Anthropic API key below or set VITE_ANTHROPIC_API_KEY in your .env file.
            ArchWerx cannot generate blueprints without a key.
          </p>
        </div>
      )}

      {quotaWarning && (
        <div className="mb-6 p-4 rounded-lg bg-amber-950/40 border border-amber-700">
          <h3 className="text-amber-300 font-bold text-sm mb-1">Storage Quota Exceeded</h3>
          <p className="text-amber-400 text-xs mb-2">
            localStorage is full ({formatBytes(quotaWarning.bytesUsed * 2)} used).
            Clear old blueprints to free space.
          </p>
          <button
            onClick={handleClearHistory}
            className="px-3 py-1.5 rounded text-xs font-medium bg-amber-700 hover:bg-amber-600 text-white transition-colors cursor-pointer"
          >
            Clear All History
          </button>
        </div>
      )}

      <div className="rounded-lg bg-zinc-900 border border-zinc-700 p-5 mb-6">
        <h3 className="text-zinc-200 font-semibold text-sm mb-4">API Key</h3>

        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Environment variable:</span>
            <span className={envKey ? 'text-emerald-400 font-mono text-xs' : 'text-zinc-600'}>
              {envKey ? maskKey(envKey) : 'Not set'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">localStorage:</span>
            <span className={localKey ? 'text-emerald-400 font-mono text-xs' : 'text-zinc-600'}>
              {localKey ? maskKey(localKey) : 'Not set'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Active key source:</span>
            <span className="text-zinc-300 text-xs">
              {envKey ? 'Environment' : localKey ? 'localStorage' : 'None'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="flex-1 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-200 placeholder-zinc-500 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
          <button
            type="submit"
            disabled={!apiKey.trim()}
            className="px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            Save
          </button>
        </form>

        {saved && (
          <p className="text-emerald-400 text-xs mt-2">Key saved to localStorage.</p>
        )}

        {localKey && (
          <button
            onClick={handleClear}
            className="mt-3 text-xs text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
          >
            Clear stored key
          </button>
        )}
      </div>

      <div className="rounded-lg bg-zinc-900 border border-zinc-700 p-5">
        <h3 className="text-zinc-200 font-semibold text-sm mb-3">Storage</h3>
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">ArchWerx localStorage usage:</span>
          <span className="text-zinc-300 font-mono text-xs">
            {formatBytes(usageBytes)}
          </span>
        </div>
        <div className="mt-2 w-full bg-zinc-800 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${usageBytes > 4 * 1024 * 1024 ? 'bg-red-500' : usageBytes > 2 * 1024 * 1024 ? 'bg-amber-500' : 'bg-cyan-500'}`}
            style={{ width: `${Math.min((usageBytes / (5 * 1024 * 1024)) * 100, 100)}%` }}
          />
        </div>
        <p className="text-zinc-600 text-xs mt-2">
          {formatBytes(usageBytes)} of ~5 MB limit (UTF-16).
        </p>
        <button
          onClick={handleClearHistory}
          className="mt-3 text-xs text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
        >
          Clear all blueprint history
        </button>
      </div>
    </div>
  );
}
