import { useState, useEffect } from 'react';

const QUESTION_TYPES = [
  { key: 'WHAT QUESTIONS', color: 'text-cyan-400', bg: 'bg-cyan-950/40', dot: 'bg-cyan-400' },
  { key: 'HOW QUESTIONS', color: 'text-violet-400', bg: 'bg-violet-950/40', dot: 'bg-violet-400' },
  { key: 'WHAT IF QUESTIONS', color: 'text-amber-400', bg: 'bg-amber-950/40', dot: 'bg-amber-400' },
  { key: 'WHY NOT QUESTIONS', color: 'text-rose-400', bg: 'bg-rose-950/40', dot: 'bg-rose-400' },
  { key: 'REASONING GAPS', color: 'text-orange-400', bg: 'bg-orange-950/40', dot: 'bg-orange-400' },
];

function parseCriticContent(raw) {
  const result = {};
  let verdict = null;
  let current = null;

  for (const line of (raw || '').split('\n')) {
    const stripped = line.trim().replace(/\*+/g, '');
    if (!stripped) continue;

    const upper = stripped.toUpperCase();

    if (upper.startsWith('VERDICT:')) {
      verdict = stripped.slice(stripped.indexOf(':') + 1).trim();
      current = null;
      continue;
    }

    let matched = false;
    for (const q of QUESTION_TYPES) {
      if (upper === q.key + ':' || upper.startsWith(q.key + ':')) {
        current = q.key;
        result[current] = [];
        matched = true;
        break;
      }
    }
    if (matched) continue;

    if (upper.startsWith('CRITIC REVIEW')) continue;
    if (!current) continue;

    const bulletMatch = stripped.match(/^[-•*]\s*(.+)/) || stripped.match(/^\d+\.\s*(.+)/);
    if (bulletMatch) {
      const text = bulletMatch[1].replace(/\*+/g, '').trim();
      if (text) result[current].push(text);
    } else {
      result[current].push(stripped);
    }
  }

  return { sections: result, verdict };
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

export default function CriticCard({ critic, onProceed, onFlag }) {
  const { criticId, label, content, awaitingDecision } = critic;
  const [expanded, setExpanded] = useState(!!awaitingDecision);

  // Auto-collapse when critic is resolved
  useEffect(() => {
    if (!awaitingDecision) {
      setExpanded(false);
    }
  }, [awaitingDecision]);

  const { sections, verdict } = parseCriticContent(content || '');

  const isFlagged = verdict && verdict.toUpperCase().startsWith('FLAG');
  const verdictColor = isFlagged ? 'text-amber-400 bg-amber-950/40' : 'text-emerald-400 bg-emerald-950/40';
  const title = label ? `Critic Review \u2014 ${label}` : `Critic Review \u2014 ${criticId}`;

  // Collapsed view
  if (!expanded) {
    return (
      <div
        className="rounded-lg border border-zinc-700/40 bg-zinc-900 px-5 py-3 mb-2 cursor-pointer hover:bg-zinc-800/80 transition-colors"
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-center gap-3">
          <span className="text-zinc-100 font-mono text-sm font-semibold shrink-0">{title}</span>
          {verdict && (
            <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${isFlagged ? 'bg-amber-900/60 text-amber-400' : 'bg-emerald-900/60 text-emerald-400'}`}>
              {isFlagged ? 'Flagged' : 'Proceed'}
            </span>
          )}
          <span className="flex-1" />
          <Chevron expanded={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-zinc-100 font-mono">{title}</h3>
        <button
          onClick={() => setExpanded(false)}
          className="p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <Chevron expanded={true} />
        </button>
      </div>

      {QUESTION_TYPES.map(({ key, color, bg, dot }) => {
        const items = sections[key];
        if (!items || items.length === 0) return null;
        return (
          <div key={key} className={`rounded-md ${bg} p-3 mb-3`}>
            <h4 className={`text-xs font-bold uppercase tracking-wider ${color} mb-2`}>
              {key}
            </h4>
            <ul className="space-y-1.5">
              {items.map((item, i) => (
                <li key={i} className="text-zinc-300 text-sm flex gap-2 items-start">
                  <span className={`w-1.5 h-1.5 rounded-full ${dot} mt-1.5 shrink-0`} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {verdict && (
        <div className={`rounded-md ${verdictColor} px-4 py-2 mb-3 font-mono text-sm font-bold`}>
          VERDICT: {verdict}
        </div>
      )}

      {awaitingDecision && (
        <div className="flex gap-3 mt-4 pt-4 border-t border-zinc-700">
          <button
            onClick={onProceed}
            className="flex-1 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            Proceed
          </button>
          <button
            onClick={onFlag}
            className="flex-1 px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            Flag for Review
          </button>
        </div>
      )}
    </div>
  );
}
