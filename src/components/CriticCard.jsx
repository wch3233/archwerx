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

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.startsWith('VERDICT:')) {
      verdict = trimmed.slice('VERDICT:'.length).trim();
      current = null;
      continue;
    }

    const match = QUESTION_TYPES.find((q) => trimmed.startsWith(q.key + ':'));
    if (match) {
      current = match.key;
      result[current] = [];
      continue;
    }

    if (current && trimmed.startsWith('-')) {
      result[current].push(trimmed.slice(1).trim());
    } else if (current && trimmed) {
      result[current].push(trimmed);
    }
  }

  return { sections: result, verdict };
}

export default function CriticCard({ critic, onProceed, onFlag }) {
  const { criticId, label, content, awaitingDecision } = critic;

  const { sections, verdict } = parseCriticContent(content || '');

  const isFlagged = verdict && verdict.startsWith('FLAG');
  const verdictColor = isFlagged ? 'text-amber-400 bg-amber-950/40' : 'text-emerald-400 bg-emerald-950/40';

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-zinc-100 font-mono">
          Critic Review {label ? `\u2014 ${label}` : `\u2014 ${criticId}`}
        </h3>
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
