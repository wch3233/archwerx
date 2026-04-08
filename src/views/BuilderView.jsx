import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useBlueprintContext } from '../context/BlueprintContext';
import { callArchitect, callCritic } from '../lib/api';
import ProgressTrack from '../components/ProgressTrack';
import EmptyState from '../components/EmptyState';
import LayerCard from '../components/LayerCard';
import CriticCard from '../components/CriticCard';
import LayerInput from '../components/LayerInput';
import BlueprintExport from '../components/BlueprintExport';

// The generation sequence:
// gen L0 → approve → gen L1 → approve → critic CR1 → proceed →
// gen L2 → approve → gen L3 → approve → critic CR2 → proceed →
// gen L4 → approve → critic CR3 → proceed → COMPLETE

const LAYER_NAMES = {
  L0: 'Intent Classification',
  L1: 'Stack Selection',
  L2: 'Component Map',
  L3: 'Data Flow',
  L4: 'Retrofit Nodes',
};

function nextAfterApprove(approvedLayerId) {
  switch (approvedLayerId) {
    case 'L0': return { action: 'gen_layer', layerId: 'L1' };
    case 'L1': return { action: 'gen_critic', criticId: 'CR1', label: 'L0-L1 Review' };
    case 'L2': return { action: 'gen_layer', layerId: 'L3' };
    case 'L3': return { action: 'gen_critic', criticId: 'CR2', label: 'L2-L3 Review' };
    case 'L4': return { action: 'gen_critic', criticId: 'CR3', label: 'L4 Final Review' };
    default: return null;
  }
}

function nextAfterCriticProceed(criticId) {
  switch (criticId) {
    case 'CR1': return { action: 'gen_layer', layerId: 'L2' };
    case 'CR2': return { action: 'gen_layer', layerId: 'L4' };
    case 'CR3': return { action: 'complete' };
    default: return null;
  }
}

function lastApprovedLayerId(layers) {
  const approved = layers.filter((l) => l.isApproved);
  return approved.length > 0 ? approved[approved.length - 1].layerId : null;
}

export default function BuilderView() {
  const { state, layers, critics, dispatch } = useBlueprintContext();
  const { phase, description, architectHistory } = state;
  const generating = useRef(false);
  const [error, setError] = useState(null);
  const [slowTimer, setSlowTimer] = useState(false);
  const slowTimerRef = useRef(null);
  const lastRetryRef = useRef(null);

  // Start a 45s timer when generation begins, clear when it ends
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

  const buildArchitectMessages = useCallback(
    (layerId) => {
      const msgs = [];
      // Include prior layers as assistant/user pairs for context
      for (const entry of architectHistory) {
        if (entry.type === 'architect_layer' && entry.isApproved) {
          if (msgs.length === 0) {
            // First pair needs a user message
            msgs.push({
              role: 'user',
              content: `Project description: ${description}\n\nGenerate ${entry.layerId} — ${LAYER_NAMES[entry.layerId] || entry.layerId}. Use ONLY the structured format from your instructions. Do not ask questions. Do not add commentary. Output the layer now.`,
            });
          }
          msgs.push({ role: 'assistant', content: entry.content });
        }
      }

      // Final user message requesting the target layer
      msgs.push({
        role: 'user',
        content: `Project description: ${description}\n\nGenerate ${layerId} — ${LAYER_NAMES[layerId] || layerId}. Use ONLY the structured format from your instructions. Do not ask clarifying questions — work with the description as given. Output the LAYER/RECOMMENDED/WHY/ALTERNATIVES/ASSUMPTIONS/RETROFIT structure now.`,
      });

      return msgs;
    },
    [description, architectHistory],
  );

  const buildCriticContext = useCallback(
    (label) => {
      const summaries = layers.map((l) => {
        const raw = l.content || '';
        const name = LAYER_NAMES[l.layerId] || l.layerId;

        // Extract RECOMMENDED value
        const recMatch = raw.match(/RECOMMENDED:\s*(.+)/i);
        const rec = recMatch ? recMatch[1].trim().slice(0, 150) : '(none)';

        // Extract first 2 ASSUMPTIONS
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

  const generateLayer = useCallback(
    async (layerId) => {
      if (generating.current) return;
      generating.current = true;
      setError(null);
      lastRetryRef.current = () => generateLayer(layerId);
      try {
        const messages = buildArchitectMessages(layerId);
        const content = await callArchitect(messages, undefined, layerId);
        dispatch({
          type: 'PUSH_HISTORY',
          payload: {
            type: 'architect_layer',
            layerId,
            content,
            isApproved: false,
            isFlagged: false,
            awaitingApproval: true,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (err) {
        setError({ message: err.message, retryAction: () => generateLayer(layerId) });
      } finally {
        generating.current = false;
      }
    },
    [buildArchitectMessages, dispatch],
  );

  const generateCritic = useCallback(
    async (criticId, label) => {
      if (generating.current) return;
      generating.current = true;
      setError(null);
      lastRetryRef.current = () => generateCritic(criticId, label);
      try {
        const context = buildCriticContext(label);
        const content = await callCritic(context, undefined, criticId);
        dispatch({
          type: 'PUSH_HISTORY',
          payload: {
            type: 'critic_review',
            criticId,
            label,
            content,
            awaitingDecision: true,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (err) {
        setError({ message: err.message, retryAction: () => generateCritic(criticId, label) });
      } finally {
        generating.current = false;
      }
    },
    [buildCriticContext, dispatch],
  );

  // Drive initial generation and revision re-generation only
  useEffect(() => {
    if (phase === 'generating' && !generating.current && !error) {
      if (layers.length === 0) {
        generateLayer('L0');
        return;
      }

      const lastLayer = layers[layers.length - 1];
      if (lastLayer && !lastLayer.isApproved) {
        generateLayer(lastLayer.layerId);
        return;
      }
    }
  }, [phase, layers, generateLayer, error]);

  const handleApproveLayer = useCallback(
    (layerId) => {
      // Mark layer approved in history
      dispatch({
        type: 'PUSH_HISTORY',
        payload: {
          ...architectHistory.find(
            (e) => e.type === 'architect_layer' && e.layerId === layerId,
          ),
          isApproved: true,
          awaitingApproval: false,
        },
      });

      const next = nextAfterApprove(layerId);
      console.log(`[ArchWerx] Approved ${layerId} → next:`, next);

      if (next && next.action === 'gen_layer') {
        dispatch({ type: 'APPROVE_LAYER', payload: { nextPhase: 'generating' } });
        setTimeout(() => generateLayer(next.layerId), 100);
      } else if (next && next.action === 'gen_critic') {
        dispatch({ type: 'APPROVE_LAYER', payload: { nextPhase: 'critic_gen' } });
        setTimeout(() => generateCritic(next.criticId, next.label), 100);
      }
    },
    [architectHistory, dispatch, generateLayer, generateCritic],
  );

  const handleCriticProceed = useCallback(
    (criticId) => {
      dispatch({ type: 'CRITIC_PROCEED' });
      const next = nextAfterCriticProceed(criticId);
      if (next) {
        if (next.action === 'gen_layer') {
          setTimeout(() => generateLayer(next.layerId), 100);
        } else if (next.action === 'complete') {
          setTimeout(() => dispatch({ type: 'COMPLETE' }), 100);
        }
      }
    },
    [dispatch, generateLayer],
  );

  const handleCriticFlag = useCallback(
    (criticId) => {
      dispatch({ type: 'CRITIC_FLAG' });
    },
    [dispatch],
  );

  const blueprintSnapshot = {
    id: state.blueprintId,
    description: state.description,
    architectHistory: state.architectHistory,
    updatedAt: new Date().toISOString(),
  };

  // Deduplicate: take last entry per layerId / criticId, render in sequence order
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
      const isActive = latest.awaitingApproval && phase === 'await_layer';
      renderedEntries.push(
        <LayerCard
          key={`layer-${latest.layerId}`}
          layer={{ ...latest, awaitingApproval: isActive }}
          onApprove={() => handleApproveLayer(latest.layerId)}
          onRequestRevision={() => dispatch({ type: 'REQUEST_REVISION' })}
        />,
      );
    } else if (entry.type === 'critic_review') {
      if (seenCritics.has(entry.criticId)) continue;
      seenCritics.add(entry.criticId);
      const latest = criticLatest.get(entry.criticId);
      const isActive = latest.awaitingDecision && phase === 'await_critic';
      renderedEntries.push(
        <CriticCard
          key={`critic-${latest.criticId}`}
          critic={{ ...latest, awaitingDecision: isActive }}
          onProceed={() => handleCriticProceed(latest.criticId)}
          onFlag={() => handleCriticFlag(latest.criticId)}
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

      {phase === 'generating' && !error && (
        <div className="my-4 p-4 rounded-lg bg-zinc-800 border border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="waveform"><span></span><span></span><span></span><span></span><span></span></div>
            <span className="text-cyan-400 text-sm">Generating...</span>
          </div>
          {slowTimer && (
            <button
              onClick={() => { generating.current = false; lastRetryRef.current?.(); }}
              className="mt-3 px-4 py-2 rounded-md bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              Taking too long — retry this layer
            </button>
          )}
        </div>
      )}

      {phase === 'critic_gen' && !error && (
        <div className="my-4 p-4 rounded-lg bg-zinc-800 border border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="waveform"><span></span><span></span><span></span><span></span><span></span></div>
            <span className="text-violet-400 text-sm">Critic is reviewing...</span>
          </div>
          {slowTimer && (
            <button
              onClick={() => { generating.current = false; lastRetryRef.current?.(); }}
              className="mt-3 px-4 py-2 rounded-md bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              Taking too long — retry this layer
            </button>
          )}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {renderedEntries}
      </div>

      {phase === 'await_layer' && (
        <LayerInput />
      )}

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
