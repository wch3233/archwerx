import { useState, useEffect } from 'react';

const SECTIONS = [
  { key: 'RECOMMENDED', color: 'text-emerald-400', bg: 'bg-emerald-950/40' },
  { key: 'WHY', color: 'text-blue-400', bg: 'bg-blue-950/40' },
  { key: 'ALTERNATIVES CONSIDERED', color: 'text-amber-400', bg: 'bg-amber-950/40' },
  { key: 'ASSUMPTIONS MADE', color: 'text-purple-400', bg: 'bg-purple-950/40' },
  { key: 'RETROFIT HOOKS IDENTIFIED', color: 'text-rose-400', bg: 'bg-rose-950/40' },
];

function parseLayerContent(raw) {
  if (!raw || typeof raw !== 'string') return {};

  const result = {};
  let current = null;
  const lines = raw.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].trim().replace(/\*+/g, '');
    if (!stripped) continue;

    const upper = stripped.toUpperCase();

    let matched = false;
    for (const section of SECTIONS) {
      if (upper === section.key + ':' || upper.startsWith(section.key + ':')) {
        current = section.key;
        const colonPos = stripped.indexOf(':');
        const after = colonPos >= 0 ? stripped.slice(colonPos + 1).trim() : '';
        result[current] = after ? [after] : [];
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (upper.startsWith('LAYER ')) continue;
    if (!current) continue;

    const bulletMatch = stripped.match(/^[-•*]\s*(.+)/) || stripped.match(/^\d+\.\s*(.+)/);
    if (bulletMatch) {
      const text = bulletMatch[1].replace(/\*+/g, '').trim();
      if (text) result[current].push(text);
    } else {
      result[current].push(stripped);
    }
  }

  return result;
}

function Chevron({ expanded }) {
  return (
    <svg
      className={`w-4 h-4 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function LayerCard({ layer, onApprove, onRequestRevision }) {
  const { layerId, content, isApproved, isFlagged, awaitingApproval } = layer;
  const [expanded, setExpanded] = useState(!isApproved);

  // Auto-collapse when layer becomes approved
  useEffect(() => {
    if (isApproved && !awaitingApproval) {
      setExpanded(false);
    }
  }, [isApproved, awaitingApproval]);

  const sections = parseLayerContent(content || '');
  const hasParsedContent = Object.values(sections).some((arr) => arr.length > 0);
  const recommended = sections['RECOMMENDED']?.join(' ') || '';

  const headerMatch = (content || '').match(/^LAYER\s+\d+\s*[—–\-]\s*.+/m);
  const header = headerMatch ? headerMatch[0] : `Layer ${layerId}`;

  const borderColor = isApproved
    ? 'border-emerald-500/40'
    : isFlagged
      ? 'border-amber-500'
      : awaitingApproval
        ? 'border-cyan-500 animate-pulse'
        : 'border-zinc-700';

  // Collapsed view
  if (!expanded) {
    return (
      <div
        className={`rounded-lg border ${borderColor} bg-zinc-900 px-5 py-3 mb-2 cursor-pointer hover:bg-zinc-800/80 transition-colors`}
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-center gap-3">
          <span className="text-zinc-100 font-mono text-sm font-semibold shrink-0">{header}</span>
          <span className="text-zinc-400 text-sm truncate flex-1">{recommended}</span>
          {isApproved && (
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-400 shrink-0">
              Approved
            </span>
          )}
          {isFlagged && (
            <span className="text-xs px-2 py-0.5 rounded bg-amber-900/60 text-amber-400 shrink-0">
              Flagged
            </span>
          )}
          <Chevron expanded={false} />
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${borderColor} bg-zinc-900 p-5 mb-4`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-zinc-100 font-mono">{header}</h3>
        <div className="flex items-center gap-2">
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
          <button
            onClick={() => setExpanded(false)}
            className="p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Chevron expanded={true} />
          </button>
        </div>
      </div>

      {hasParsedContent ? (
        SECTIONS.map(({ key, color, bg }) => {
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
        })
      ) : (
        <div className="rounded-md bg-zinc-800 p-3 mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
            Raw Response
          </h4>
          <pre className="text-zinc-300 text-sm whitespace-pre-wrap font-mono">{content}</pre>
        </div>
      )}

      {awaitingApproval && (
        <div className="flex gap-3 mt-4 pt-4 border-t border-zinc-700">
          <button
            onClick={onApprove}
            className="flex-1 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            Approve Layer
          </button>
          <button
            onClick={onRequestRevision}
            className="flex-1 px-4 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium transition-colors cursor-pointer"
          >
            Request Changes
          </button>
        </div>
      )}
    </div>
  );
}
