import { useState } from 'react';
import { useBlueprintContext } from '../context/BlueprintContext';

export default function EmptyState() {
  const [description, setDescription] = useState('');
  const { dispatch } = useBlueprintContext();

  function handleGenerate(e) {
    e.preventDefault();
    if (!description.trim()) return;
    dispatch({
      type: 'START_SESSION',
      payload: {
        id: crypto.randomUUID(),
        description: description.trim(),
      },
    });
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <form onSubmit={handleGenerate} className="w-full max-w-xl text-center">
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">ArchWerx</h2>
        <p className="text-zinc-400 text-sm mb-6">
          Describe your project and generate a layered architectural blueprint.
        </p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your project — what it does, who it's for, key constraints..."
          rows={5}
          className="w-full rounded-lg bg-zinc-800 border border-zinc-600 text-zinc-200 placeholder-zinc-500 p-4 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none mb-4"
        />
        <button
          type="submit"
          disabled={!description.trim()}
          className="px-6 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          Generate Blueprint
        </button>
      </form>
    </div>
  );
}
