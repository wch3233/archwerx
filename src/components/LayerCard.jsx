import { useBlueprintContext } from '../context/BlueprintContext';

const SECTIONS = [
  { key: 'RECOMMENDED', color: 'text-emerald-400', bg: 'bg-emerald-950/40' },
  { key: 'WHY', color: 'text-blue-400', bg: 'bg-blue-950/40' },
  { key: 'ALTERNATIVES CONSIDERED', color: 'text-amber-400', bg: 'bg-amber-950/40' },
  { key: 'ASSUMPTIONS MADE', color: 'text-purple-400', bg: 'bg-purple-950/40' },
  { key: 'RETROFIT HOOKS IDENTIFIED', color: 'text-rose-400', bg: 'bg-rose-950/40' },
];

function parseLayerContent(raw) {
  if (!raw || typeof raw !== 'string') {
    console.warn('[ArchWerx] parseLayerContent: content is not a string:', typeof raw, raw);
    return {};
  }

  console.log('[ArchWerx] Raw layer content (' + raw.length + ' chars):', raw);

  const result = {};
  let current = null;
  const lines = raw.split('\n');

  console.log('[ArchWerx] Split into', lines.length, 'lines');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Strip markdown bold/italic markers for matching
    const stripped = line.trim().replace(/\*+/g, '');
    if (!stripped) continue;

    const upper = stripped.toUpperCase();

    // Try to match a section header — check longest keys first to avoid
    // "WHY" matching inside "WHY NOT" etc.
    let matched = false;
    for (const section of SECTIONS) {
      if (
        upper === section.key + ':' ||
        upper.startsWith(section.key + ': ') ||
        upper.startsWith(section.key + ':')
      ) {
        current = section.key;
        const colonPos = stripped.indexOf(':');
        const after = colonPos >= 0 ? stripped.slice(colonPos + 1).trim() : '';
        result[current] = after ? [after] : [];
        console.log(`[ArchWerx] Line ${i}: matched section "${section.key}", inline text: "${after || '(none)'}"`);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Skip the LAYER header line
    if (upper.startsWith('LAYER ')) continue;

    if (!current) continue;

    // Bullet lines: -, •, *, or numbered (1., 2.)
    const bulletMatch = stripped.match(/^[-•*]\s*(.+)/) || stripped.match(/^\d+\.\s*(.+)/);
    if (bulletMatch) {
      const text = bulletMatch[1].replace(/\*+/g, '').trim();
      if (text) {
        result[current].push(text);
        console.log(`[ArchWerx] Line ${i}: bullet under "${current}": "${text.slice(0, 60)}..."`);
      }
    } else {
      // Continuation text
      result[current].push(stripped);
      console.log(`[ArchWerx] Line ${i}: continuation under "${current}": "${stripped.slice(0, 60)}..."`);
    }
  }

  console.log('[ArchWerx] Parsed sections:', Object.keys(result).map(k => `${k}(${result[k].length})`).join(', ') || '(none)');
  return result;
}

export default function LayerCard({ layer }) {
  const { dispatch } = useBlueprintContext();
  const { layerId, content, isApproved, isFlagged, awaitingApproval } = layer;

  console.log(`[ArchWerx] LayerCard render: layerId=${layerId}, content type=${typeof content}, length=${content?.length || 0}`);

  const sections = parseLayerContent(content || '');
  const hasParsedContent = Object.values(sections).some((arr) => arr.length > 0);

  // Extract layer header from content
  const headerMatch = (content || '').match(/^LAYER\s+\d+\s*[—–\-]\s*.+/m);
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
        // Fallback: show raw content if parsing found nothing
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
