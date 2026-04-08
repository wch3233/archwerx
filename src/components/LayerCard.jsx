import { useBlueprintContext } from '../context/BlueprintContext';

const SECTIONS = [
  { key: 'RECOMMENDED', color: 'text-emerald-400', bg: 'bg-emerald-950/40' },
  { key: 'WHY', color: 'text-blue-400', bg: 'bg-blue-950/40' },
  { key: 'ALTERNATIVES CONSIDERED', color: 'text-amber-400', bg: 'bg-amber-950/40' },
  { key: 'ASSUMPTIONS MADE', color: 'text-purple-400', bg: 'bg-purple-950/40' },
  { key: 'RETROFIT HOOKS IDENTIFIED', color: 'text-rose-400', bg: 'bg-rose-950/40' },
];

function parseLayerContent(raw) {
  const result = {};
  let current = null;

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();

    // Check if this line starts a known section
    const match = SECTIONS.find((s) => trimmed.startsWith(s.key + ':'));
    if (match) {
      current = match.key;
      const after = trimmed.slice(match.key.length + 1).trim();
      result[current] = after ? [after] : [];
      continue;
    }

    // Accumulate bullet lines under the current section
    if (current && trimmed.startsWith('-')) {
      result[current].push(trimmed.slice(1).trim());
    } else if (current && trimmed) {
      result[current].push(trimmed);
    }
  }

  return result;
}

export default function LayerCard({ layer }) {
  const { dispatch } = useBlueprintContext();
  const { layerId, content, isApproved, isFlagged, awaitingApproval } = layer;

  const sections = parseLayerContent(content || '');

  // Extract layer header from content (e.g. "LAYER 0 — Intent Classification")
  const headerMatch = (content || '').match(/^LAYER\s+\d+\s*[—–-]\s*.+/m);
  const header = headerMatch ? headerMatch[0] : `Layer ${layerId}`;

  const borderColor = isApproved
    ? 'border-emerald-500'
    : isFlagged
      ? 'border-amber-500'
      : awaitingApproval
        ? 'border-cyan-500 animate-pulse'
        : 'border-zinc-700';

  return (
    <div className={`rounded-lg border ${borderColor} bg-zinc-900 p-5 mb-4`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-zinc-100 font-mono">{header}</h3>
        <div className="flex gap-2">
          {isApproved && (
            <span className="text-xs px-2 py-1 rounded bg-emerald-900 text-emerald-300">
              Approved
            </span>
          )}
          {isFlagged && (
            <span className="text-xs px-2 py-1 rounded bg-amber-900 text-amber-300">
              Flagged
            </span>
          )}
        </div>
      </div>

      {SECTIONS.map(({ key, color, bg }) => {
        const items = sections[key];
        if (!items || items.length === 0) return null;
        return (
          <div key={key} className={`rounded-md ${bg} p-3 mb-3`}>
            <h4 className={`text-xs font-bold uppercase tracking-wider ${color} mb-2`}>
              {key}
            </h4>
            {key === 'RECOMMENDED' ? (
              <p className="text-zinc-200 text-sm">{items.join(' ')}</p>
            ) : (
              <ul className="space-y-1">
                {items.map((item, i) => (
                  <li key={i} className="text-zinc-300 text-sm flex gap-2">
                    <span className={`${color} mt-1 shrink-0`}>&#x2022;</span>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {awaitingApproval && (
        <div className="flex gap-3 mt-4 pt-4 border-t border-zinc-700">
          <button
            onClick={() => dispatch({ type: 'APPROVE_LAYER' })}
            className="flex-1 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            Approve Layer
          </button>
          <button
            onClick={() => dispatch({ type: 'REQUEST_REVISION' })}
            className="flex-1 px-4 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium transition-colors cursor-pointer"
          >
            Request Changes
          </button>
        </div>
      )}
    </div>
  );
}
