import { useEffect, useRef, useCallback, useState } from 'react';
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
  const bottomRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [architectHistory.length, phase]);

  const buildArchitectMessages = useCallback(
    (layerId) => {
      const msgs = [];
      msgs.push({
        role: 'user',
        content: `Project: ${description}\n\nGenerate ${layerId} — ${LAYER_NAMES[layerId] || layerId}.`,
      });

      for (const entry of architectHistory) {
        if (entry.type === 'architect_layer') {
          msgs.push({ role: 'assistant', content: entry.content });
          msgs.push({ role: 'user', content: `Layer ${entry.layerId} approved. Continue.` });
        }
      }

      if (msgs[msgs.length - 1]?.role === 'user') {
        msgs[msgs.length - 1] = {
          role: 'user',
          content: `Now generate ${layerId} — ${LAYER_NAMES[layerId] || layerId}.`,
        };
      }

      return msgs;
    },
    [description, architectHistory],
  );

  const buildCriticContext = useCallback(
    (label) => {
      const layerContent = layers
        .map((l) => l.content)
        .join('\n\n---\n\n');
      return `Review the following architectural layers:\n\n${layerContent}`;
    },
    [layers],
  );

  const generateLayer = useCallback(
    async (layerId) => {
      if (generating.current) return;
      generating.current = true;
      setError(null);
      try {
        const messages = buildArchitectMessages(layerId);
        const content = await callArchitect(messages);
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
      try {
        const context = buildCriticContext(label);
        const content = await callCritic(context);
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

    if (phase === 'critic_gen' && !error) {
      const lastApproved = lastApprovedLayerId(layers);
      const next = nextAfterApprove(lastApproved);
      if (next && next.action === 'gen_critic') {
        generateCritic(next.criticId, next.label);
      }
    }
  }, [phase, layers, generateLayer, generateCritic, error]);

  const handleApproveLayer = useCallback(
    (layerId) => {
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

      dispatch({ type: 'APPROVE_LAYER' });

      const next = nextAfterApprove(layerId);
      if (next) {
        if (next.action === 'gen_layer') {
          setTimeout(() => generateLayer(next.layerId), 100);
        }
      }
    },
    [architectHistory, dispatch, generateLayer],
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

  const renderedEntries = architectHistory.map((entry, i) => {
    if (entry.type === 'architect_layer') {
      return (
        <LayerCard
          key={`layer-${entry.layerId}-${i}`}
          layer={{
            ...entry,
            awaitingApproval: entry.awaitingApproval && phase === 'await_layer',
          }}
          onApprove={() => handleApproveLayer(entry.layerId)}
          onRequestRevision={() => dispatch({ type: 'REQUEST_REVISION' })}
        />
      );
    }
    if (entry.type === 'critic_review') {
      return (
        <CriticCard
          key={`critic-${entry.criticId}-${i}`}
          critic={{
            ...entry,
            awaitingDecision: entry.awaitingDecision && phase === 'await_critic',
          }}
          onProceed={() => handleCriticProceed(entry.criticId)}
          onFlag={() => handleCriticFlag(entry.criticId)}
        />
      );
    }
    return null;
  });

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
        <div className="flex items-center gap-3 my-4 p-4 rounded-lg bg-zinc-800 border border-zinc-700">
          <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-cyan-400 text-sm">Generating...</span>
        </div>
      )}

      {phase === 'critic_gen' && !error && (
        <div className="flex items-center gap-3 my-4 p-4 rounded-lg bg-zinc-800 border border-zinc-700">
          <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-violet-400 text-sm">Critic is reviewing...</span>
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

      <div ref={bottomRef} />
    </div>
  );
}
