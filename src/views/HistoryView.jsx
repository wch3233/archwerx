import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { list, remove } from '../lib/storage';

export default function HistoryView() {
  const [blueprints, setBlueprints] = useState([]);
  const [confirmId, setConfirmId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setBlueprints(list());
  }, []);

  function handleDelete(id) {
    if (confirmId === id) {
      remove(id);
      setBlueprints(list());
      setConfirmId(null);
    } else {
      setConfirmId(id);
    }
  }

  if (blueprints.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-zinc-100 mb-6">History</h2>
        <div className="text-center py-16">
          <p className="text-zinc-500 text-sm">No blueprints yet.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            Create Your First Blueprint
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-zinc-100 mb-6">History</h2>
      <div className="space-y-3">
        {blueprints.map((bp) => {
          const layerCount = (bp.architectHistory || []).filter(
            (e) => e.type === 'architect_layer' && e.isApproved,
          ).length;
          const date = bp.updatedAt
            ? new Date(bp.updatedAt).toLocaleDateString()
            : 'Unknown';

          return (
            <div
              key={bp.id}
              className="flex items-center justify-between p-4 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-500 transition-colors"
            >
              <div
                className="flex-1 cursor-pointer"
                onClick={() => navigate(`/blueprint/${bp.id}`)}
              >
                <h3 className="text-zinc-100 font-medium">
                  {bp.description || 'Untitled Blueprint'}
                </h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-zinc-500 text-xs">{date}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    {layerCount} layers
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      bp.complete
                        ? 'bg-emerald-900 text-emerald-300'
                        : 'bg-amber-900 text-amber-300'
                    }`}
                  >
                    {bp.complete ? 'Complete' : 'In Progress'}
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(bp.id);
                }}
                className={`ml-4 px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                  confirmId === bp.id
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
                }`}
              >
                {confirmId === bp.id ? 'Confirm Delete' : 'Delete'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
