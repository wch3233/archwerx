import { useState } from 'react';
import { useBlueprintContext } from '../context/BlueprintContext';

export default function LayerInput() {
  const [text, setText] = useState('');
  const { dispatch } = useBlueprintContext();

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    dispatch({
      type: 'REQUEST_REVISION',
      payload: { feedback: text.trim() },
    });
    setText('');
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe what you'd like changed in this layer..."
        rows={3}
        className="w-full rounded-md bg-zinc-800 border border-zinc-600 text-zinc-200 placeholder-zinc-500 p-3 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="mt-2 px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
      >
        Submit Revision Request
      </button>
    </form>
  );
}
