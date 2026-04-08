import { useEffect, useRef, useCallback, useState } from 'react';
import { useBlueprintContext } from '../context/BlueprintContext';
import { callArchitect, callCritic } from '../lib/api';
import ProgressTrack from '../components/ProgressTrack';
import EmptyState from '../components/EmptyState';
import LayerCard from '../components/LayerCard';
import CriticCard from '../components/CriticCard';
import BlueprintExport from '../components/BlueprintExport';

// Fully automatic sequence — no manual approval:
// L0 → L1 → CR1 → L2 → L3 → CR2 → L4 → CR3 → COMPLETE
const SEQUENCE = [
  { type: 'layer', layerId: 'L0' },
  { type: 'layer', layerId: 'L1' },
  { type: 'critic', criticId: 'CR1', label: 'L0-L1 Review' },
  { type: 'layer', layerId: 'L2' },
  { type: 'layer', layerId: 'L3' },
  { type: 'critic', criticId: 'CR2', label: 'L2-L3 Review' },
  { type: 'layer', layerId: 'L4' },
  { type: 'critic', criticId: 'CR3', label: 'L4 Final Review' },
];

const LAYER_NAMES = {
  L0: 'Intent Classification',
  L1: 'Stack Selection',
  L2: 'Component Map',
  L3: 'Data Flow',
  L4: 'Retrofit Nodes',
};

export default function BuilderView() {
  const { state, layers, critics, dispatch } = useBlueprintContext();
  const { phase, description, architectHistory } = state;
  const generating = useRef(false);
  const [error, setError] = useState(null);
  const [slowTimer, setSlowTimer] = useState(false);
  const slowTimerRef = useRef(null);
  const lastRetryRef = useRef(null);

  // 45s slow-timer for retry button
  useEffect(() => {
    if ((phase === 'generating' || phase === 'critic_gen') && !error) {
      setSlowTimer(false);
      slowTimerRef.current = setTimeout(() => setSlowTimer(true), 45000);
    } else {
      setSlowTimer(false);
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    }
    return () => { if (slowTimerRef.current) clearTimeout(slowTimerRef.current); };
  }, [phase, error]);

  // Count completed steps to determine where we are in the sequence
  const completedSteps = architectHistory.filter(
    (e) => e.type === 'architect_layer' || e.type === 'critic_review',
  );
  // Deduplicate by layerId/criticId to get unique completed steps
  const completedIds = new Set();
  for (const e of completedSteps) {
    if (e.type === 'architect_layer') completedIds.add(e.layerId);
    else completedIds.add(e.criticId);
  }

  const buildArchitectMessages = useCallback(
    (layerId) => {
      const msgs = [];
      for (const entry of architectHistory) {
        if (entry.type === 'architect_layer') {
          if (msgs.length === 0) {
            msgs.push({
              role: 'user',
              content: `Project description: ${description}\n\nGenerate ${entry.layerId} — ${LAYER_NAMES[entry.layerId] || entry.layerId}. Use ONLY the structured format from your instructions. Do not ask questions. Do not add commentary. Output the layer now.`,
            });
          }
          msgs.push({ role: 'assistant', content: entry.content });
        }
      }
      msgs.push({
        role: 'user',
        content: `Project description: ${description}\n\nGenerate ${layerId} — ${LAYER_NAMES[layerId] || layerId}. Use ONLY the structured format from your instructions. Do not ask clarifying questions — work with the description as given. Output the LAYER/RECOMMENDED/WHY/ALTERNATIVES/ASSUMPTIONS/RETROFIT structure now.`,
      });
      return msgs;
    },
    [description, architectHistory],
  );

  const buildCriticContext = useCallback(
    () => {
      const summaries = layers.map((l) => {
        const raw = l.content || '';
        const name = LAYER_NAMES[l.layerId] || l.layerId;
        const recMatch = raw.match(/RECOMMENDED:\s*(.+)/i);
        const rec = recMatch ? recMatch[1].trim().slice(0, 150) : '(none)';
        const assumptions = [];
        let inAssumptions = false;
        for (const line of raw.split('\n')) {
          const stripped = line.trim().replace(/\*+/g, '');
          if (/^ASSUMPTIONS MADE:/i.test(stripped)) { inAssumptions = true; continue; }
          if (inAssumptions && /^[A-Z][A-Z\s]+:/.test(stripped.toUpperCase())) break;
          if (inAssumptions && /^[-•*]/.test(stripped)) {
            assumptions.push(stripped.replace(/^[-•*]\s*/, '').slice(0, 100));
            if (assumptions.length >= 2) break;
          }
        }
        const assumStr = assumptions.length > 0
          ? assumptions.map((a) => `- ${a}`).join('\n')
          : '- (none stated)';
        return `Layer ${l.layerId.slice(1)} — ${name}\nRecommended: ${rec}\nKey assumptions:\n${assumStr}`;
      });
      return `Review the following architectural decisions:\n\n${summaries.join('\n\n')}`;
    },
    [layers],
  );

  // Run the next step in the sequence
  const runNextStep = useCallback(
    async (stepIndex) => {
      if (stepIndex >= SEQUENCE.length) {
        dispatch({ type: 'COMPLETE' });
        return;
      }

      const step = SEQUENCE[stepIndex];

      // Skip if already completed (for resume after error)
      if (step.type === 'layer' && completedIds.has(step.layerId)) {
        runNextStep(stepIndex + 1);
        return;
      }
      if (step.type === 'critic' && completedIds.has(step.criticId)) {
        runNextStep(stepIndex + 1);
        return;
      }

      if (generating.current) return;
      generating.current = true;
      setError(null);
      lastRetryRef.current = () => { generating.current = false; runNextStep(stepIndex); };

      try {
        if (step.type === 'layer') {
          dispatch({ type: 'APPROVE_LAYER', payload: { nextPhase: 'generating' } });
          const messages = buildArchitectMessages(step.layerId);
          const content = await callArchitect(messages, undefined, step.layerId);
          dispatch({
            type: 'PUSH_HISTORY',
            payload: {
              type: 'architect_layer',
              layerId: step.layerId,
              content,
              isApproved: true,
              isFlagged: false,
              awaitingApproval: false,
              timestamp: new Date().toISOString(),
            },
          });
          console.log(`[ArchWerx] ${step.layerId} complete → next step ${stepIndex + 1}`);
        } else {
          dispatch({ type: 'APPROVE_LAYER', payload: { nextPhase: 'critic_gen' } });
          const context = buildCriticContext();
          const content = await callCritic(context, undefined, step.criticId);
          dispatch({
            type: 'PUSH_HISTORY',
            payload: {
              type: 'critic_review',
              criticId: step.criticId,
              label: step.label,
              content,
              awaitingDecision: false,
              timestamp: new Date().toISOString(),
            },
          });
          console.log(`[ArchWerx] ${step.criticId} complete → next step ${stepIndex + 1}`);
        }
      } catch (err) {
        setError({
          message: err.message,
          retryAction: () => { generating.current = false; runNextStep(stepIndex); },
        });
        generating.current = false;
        return;
      }

      generating.current = false;

      // Small delay then continue to next step
      setTimeout(() => runNextStep(stepIndex + 1), 500);
    },
    [dispatch, buildArchitectMessages, buildCriticContext, completedIds],
  );

  // Kick off the sequence when session starts
  useEffect(() => {
    if (phase === 'generating' && !generating.current && !error && completedIds.size === 0) {
      runNextStep(0);
    }
  }, [phase, error, completedIds.size, runNextStep]);

  const blueprintSnapshot = {
    id: state.blueprintId,
    description: state.description,
    architectHistory: state.architectHistory,
    updatedAt: new Date().toISOString(),
  };

  // Deduplicate entries for rendering
  const layerLatest = new Map();
  const criticLatest = new Map();
  for (const entry of architectHistory) {
    if (entry.type === 'architect_layer') layerLatest.set(entry.layerId, entry);
    else if (entry.type === 'critic_review') criticLatest.set(entry.criticId, entry);
  }

  const renderedEntries = [];
  const seenLayers = new Set();
  const seenCritics = new Set();
  for (const entry of architectHistory) {
    if (entry.type === 'architect_layer') {
      if (seenLayers.has(entry.layerId)) continue;
      seenLayers.add(entry.layerId);
      const latest = layerLatest.get(entry.layerId);
      renderedEntries.push(
        <LayerCard
          key={`layer-${latest.layerId}`}
          layer={{ ...latest, isApproved: true, awaitingApproval: false }}
        />,
      );
    } else if (entry.type === 'critic_review') {
      if (seenCritics.has(entry.criticId)) continue;
      seenCritics.add(entry.criticId);
      const latest = criticLatest.get(entry.criticId);
      renderedEntries.push(
        <CriticCard
          key={`critic-${latest.criticId}`}
          critic={{ ...latest, awaitingDecision: false }}
        />,
      );
    }
  }

  if (phase === 'idle') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <EmptyState />
      </div>
    );
  }

  const isGenerating = (phase === 'generating' || phase === 'critic_gen') && !error;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-zinc-100 mb-1">{description}</h2>
        <p className="text-zinc-500 text-sm font-mono">ID: {state.blueprintId}</p>
      </div>

      <ProgressTrack layers={layers} critics={critics} phase={phase} />

      {error && (
        <div className="my-4 p-4 rounded-lg bg-red-950/40 border border-red-700">
          <h4 className="text-red-300 font-semibold text-sm mb-1">Generation Error</h4>
          <p className="text-red-400 text-sm mb-3">{error.message}</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setError(null);
                error.retryAction();
              }}
              className="px-4 py-2 rounded-md bg-red-700 hover:bg-red-600 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              Retry
            </button>
            <button
              onClick={() => setError(null)}
              className="px-4 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {isGenerating && (
        <div className="my-4 p-4 rounded-lg bg-zinc-800 border border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="waveform"><span></span><span></span><span></span><span></span><span></span></div>
            <span className="text-cyan-400 text-sm">
              {phase === 'critic_gen' ? 'Critic is reviewing...' : 'Generating...'}
            </span>
          </div>
          {slowTimer && (
            <button
              onClick={() => { generating.current = false; lastRetryRef.current?.(); }}
              className="mt-3 px-4 py-2 rounded-md bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              Taking too long — retry
            </button>
          )}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {renderedEntries}
      </div>

      {phase === 'complete' && (
        <div className="mt-6 p-6 rounded-lg bg-emerald-950/30 border border-emerald-700 text-center">
          <h3 className="text-lg font-bold text-emerald-300 mb-2">Blueprint Complete</h3>
          <p className="text-zinc-400 text-sm mb-4">
            All 5 layers generated and reviewed. Export your blueprint below.
          </p>
          <BlueprintExport blueprint={blueprintSnapshot} />
        </div>
      )}
    </div>
  );
}
