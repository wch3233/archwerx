import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { load } from '../lib/storage';
import BlueprintExport from '../components/BlueprintExport';

const LAYER_SECTIONS = [
  { key: 'RECOMMENDED', color: 'text-emerald-400', bg: 'bg-emerald-950/40' },
  { key: 'WHY', color: 'text-blue-400', bg: 'bg-blue-950/40' },
  { key: 'ALTERNATIVES CONSIDERED', color: 'text-amber-400', bg: 'bg-amber-950/40' },
  { key: 'ASSUMPTIONS MADE', color: 'text-purple-400', bg: 'bg-purple-950/40' },
  { key: 'RETROFIT HOOKS IDENTIFIED', color: 'text-rose-400', bg: 'bg-rose-950/40' },
];

const CRITIC_SECTIONS = [
  { key: 'WHAT QUESTIONS', color: 'text-cyan-400', bg: 'bg-cyan-950/40' },
  { key: 'HOW QUESTIONS', color: 'text-violet-400', bg: 'bg-violet-950/40' },
  { key: 'WHAT IF QUESTIONS', color: 'text-amber-400', bg: 'bg-amber-950/40' },
  { key: 'WHY NOT QUESTIONS', color: 'text-rose-400', bg: 'bg-rose-950/40' },
  { key: 'REASONING GAPS', color: 'text-orange-400', bg: 'bg-orange-950/40' },
];

function parseContent(raw, sectionDefs) {
  const result = {};
  let current = null;

  for (const line of (raw || '').split('\n')) {
    const trimmed = line.trim();
    const match = sectionDefs.find((s) => trimmed.startsWith(s.key + ':'));
    if (match) {
      current = match.key;
      const after = trimmed.slice(match.key.length + 1).trim();
      result[current] = after ? [after] : [];
      continue;
    }
    if (current && trimmed.startsWith('-')) {
      result[current].push(trimmed.slice(1).trim());
    } else if (current && trimmed) {
      result[current].push(trimmed);
    }
  }

  return result;
}

function ReadOnlyLayer({ entry }) {
  const sections = parseContent(entry.content, LAYER_SECTIONS);
  const headerMatch = (entry.content || '').match(/^LAYER\s+\d+\s*[—–-]\s*.+/m);
  const header = headerMatch ? headerMatch[0] : `Layer ${entry.layerId}`;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-5 mb-4">
      <h3 className="text-lg font-semibold text-zinc-100 font-mono mb-4">{header}</h3>
      {LAYER_SECTIONS.map(({ key, color, bg }) => {
        const items = sections[key];
        if (!items || items.length === 0) return null;
        return (
          <div key={key} className={`rounded-md ${bg} p-3 mb-3`}>
            <h4 className={`text-xs font-bold uppercase tracking-wider ${color} mb-2`}>{key}</h4>
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
    </div>
  );
}

function ReadOnlyCritic({ entry }) {
  const sections = parseContent(entry.content, CRITIC_SECTIONS);
  const verdictMatch = (entry.content || '').match(/^VERDICT:\s*(.+)/m);
  const verdict = verdictMatch ? verdictMatch[1].trim() : null;
  const isFlagged = verdict && verdict.startsWith('FLAG');

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-5 mb-4">
      <h3 className="text-lg font-semibold text-zinc-100 font-mono mb-4">
        Critic Review {entry.label ? `\u2014 ${entry.label}` : `\u2014 ${entry.criticId}`}
      </h3>
      {CRITIC_SECTIONS.map(({ key, color, bg }) => {
        const items = sections[key];
        if (!items || items.length === 0) return null;
        return (
          <div key={key} className={`rounded-md ${bg} p-3 mb-3`}>
            <h4 className={`text-xs font-bold uppercase tracking-wider ${color} mb-2`}>{key}</h4>
            <ul className="space-y-1.5">
              {items.map((item, i) => (
                <li key={i} className="text-zinc-300 text-sm flex gap-2 items-start">
                  <span className={`${color} mt-1 shrink-0`}>&#x2022;</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {verdict && (
        <div
          className={`rounded-md px-4 py-2 font-mono text-sm font-bold ${
            isFlagged ? 'text-amber-400 bg-amber-950/40' : 'text-emerald-400 bg-emerald-950/40'
          }`}
        >
          VERDICT: {verdict}
        </div>
      )}
    </div>
  );
}

export default function DetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [blueprint, setBlueprint] = useState(null);

  useEffect(() => {
    const bp = load(id);
    if (!bp) {
      navigate('/history');
      return;
    }
    setBlueprint(bp);
  }, [id, navigate]);

  if (!blueprint) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate('/history')}
        className="text-zinc-400 hover:text-zinc-200 text-sm mb-6 flex items-center gap-1 transition-colors cursor-pointer"
      >
        <span>&larr;</span> Back to History
      </button>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-zinc-100 mb-1">
          {blueprint.description || 'Untitled Blueprint'}
        </h2>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-zinc-500 text-xs font-mono">{blueprint.id}</span>
          <span className="text-zinc-500 text-xs">
            {blueprint.updatedAt ? new Date(blueprint.updatedAt).toLocaleString() : ''}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {(blueprint.architectHistory || []).map((entry, i) => {
          if (entry.type === 'architect_layer') {
            return <ReadOnlyLayer key={`l-${i}`} entry={entry} />;
          }
          if (entry.type === 'critic_review') {
            return <ReadOnlyCritic key={`c-${i}`} entry={entry} />;
          }
          return null;
        })}
      </div>

      <div className="mt-6 flex justify-center">
        <BlueprintExport blueprint={blueprint} />
      </div>
    </div>
  );
}
