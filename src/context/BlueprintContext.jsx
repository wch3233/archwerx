import { createContext, useContext, useReducer, useMemo, useCallback } from 'react';
import { save, update, clearActive } from '../lib/storage';

const BlueprintContext = createContext(null);

const INITIAL_STATE = {
  phase: 'idle',
  blueprintId: null,
  description: '',
  architectHistory: [],
  activeLayerId: null,
  activeCriticId: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'START_SESSION':
      return {
        ...INITIAL_STATE,
        phase: 'generating',
        blueprintId: action.payload.id,
        description: action.payload.description,
      };

    case 'PUSH_HISTORY':
      return {
        ...state,
        architectHistory: [...state.architectHistory, action.payload],
        phase: action.payload.type === 'architect_layer' ? 'await_layer' : 'await_critic',
        activeLayerId:
          action.payload.type === 'architect_layer'
            ? action.payload.layerId
            : state.activeLayerId,
        activeCriticId:
          action.payload.type === 'critic_review'
            ? action.payload.criticId
            : state.activeCriticId,
      };

    case 'APPROVE_LAYER':
      return {
        ...state,
        phase: action.payload?.nextPhase || 'generating',
        activeLayerId: null,
      };

    case 'REQUEST_REVISION':
      return {
        ...state,
        phase: 'generating',
        activeLayerId: null,
      };

    case 'CRITIC_PROCEED':
      return {
        ...state,
        phase: 'generating',
        activeCriticId: null,
      };

    case 'CRITIC_FLAG':
      return {
        ...state,
        phase: 'generating',
        activeCriticId: null,
      };

    case 'COMPLETE':
      return {
        ...state,
        phase: 'complete',
        activeLayerId: null,
        activeCriticId: null,
      };

    case 'RESET':
      return { ...INITIAL_STATE };

    default:
      return state;
  }
}

function blueprintSnapshot(state) {
  return {
    id: state.blueprintId,
    description: state.description,
    architectHistory: state.architectHistory,
    phase: state.phase,
    complete: state.phase === 'complete',
    updatedAt: new Date().toISOString(),
  };
}

export function BlueprintProvider({ children }) {
  const [state, rawDispatch] = useReducer(reducer, INITIAL_STATE);

  const dispatchWithPersistence = useCallback(
    (action) => {
      // Compute next state for persistence
      const next = reducer(state, action);
      rawDispatch(action);

      if (action.type === 'PUSH_HISTORY') {
        update(blueprintSnapshot(next));
      }

      if (action.type === 'COMPLETE') {
        const snap = blueprintSnapshot(next);
        snap.complete = true;
        save(snap);
        clearActive();
      }
    },
    [state],
  );

  // Derive layers from architectHistory: filter architect_layer, group by layerId, last entry wins
  const layers = useMemo(() => {
    const map = new Map();
    for (const entry of state.architectHistory) {
      if (entry.type === 'architect_layer') {
        map.set(entry.layerId, entry);
      }
    }
    return Array.from(map.values());
  }, [state.architectHistory]);

  // Derive critics from architectHistory: filter critic_review, group by criticId, last entry wins
  const critics = useMemo(() => {
    const map = new Map();
    for (const entry of state.architectHistory) {
      if (entry.type === 'critic_review') {
        map.set(entry.criticId, entry);
      }
    }
    return Array.from(map.values());
  }, [state.architectHistory]);

  const value = useMemo(
    () => ({
      state,
      layers,
      critics,
      dispatch: dispatchWithPersistence,
    }),
    [state, layers, critics, dispatchWithPersistence],
  );

  return (
    <BlueprintContext.Provider value={value}>
      {children}
    </BlueprintContext.Provider>
  );
}

export function useBlueprintContext() {
  const ctx = useContext(BlueprintContext);
  if (!ctx) throw new Error('useBlueprintContext must be used within BlueprintProvider');
  return ctx;
}

export default BlueprintContext;
