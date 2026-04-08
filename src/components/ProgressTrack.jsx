const STEPS = [
  { id: 'L0', label: 'L0' },
  { id: 'L1', label: 'L1' },
  { id: 'CR1', label: 'CR1' },
  { id: 'L2', label: 'L2' },
  { id: 'L3', label: 'L3' },
  { id: 'CR2', label: 'CR2' },
  { id: 'L4', label: 'L4' },
  { id: 'CR3', label: 'CR3' },
];

function resolveStepState(stepId, layers, critics, phase) {
  const isLayer = stepId.startsWith('L');

  if (isLayer) {
    const layerNum = parseInt(stepId.slice(1), 10);
    const layerKey = `L${layerNum}`;
    const found = layers.find((l) => l.layerId === layerKey);
    if (found && found.isApproved) return 'done';
    if (found) return 'active';
  } else {
    const criticNum = parseInt(stepId.slice(2), 10);
    const criticKey = `CR${criticNum}`;
    const found = critics.find((c) => c.criticId === criticKey);
    if (found) return 'done';
  }

  // If phase is generating/await and this is the next expected step, mark active
  return 'pending';
}

export default function ProgressTrack({ layers = [], critics = [], phase = 'idle' }) {
  return (
    <div className="flex items-center gap-1 py-3">
      {STEPS.map((step, i) => {
        const state = resolveStepState(step.id, layers, critics, phase);

        const bgColor =
          state === 'done'
            ? 'bg-emerald-500'
            : state === 'active'
              ? 'bg-cyan-500 animate-pulse'
              : 'bg-zinc-700';

        const textColor =
          state === 'done'
            ? 'text-white'
            : state === 'active'
              ? 'text-white'
              : 'text-zinc-500';

        return (
          <div key={step.id} className="flex items-center">
            <div
              className={`w-9 h-9 rounded-full ${bgColor} ${textColor} flex items-center justify-center text-xs font-bold font-mono`}
            >
              {step.label}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-4 h-0.5 ${state === 'done' ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
