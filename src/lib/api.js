const API_URL = 'https://api.anthropic.com/v1/messages';
const MODELS = {
  opus: 'claude-opus-4-6',
  sonnet: 'claude-sonnet-4-6',
};
const MAX_TOKENS = 4096;

const ARCH_SYS = `You are ArchWerx, a senior software architect operating under RAPTOR design principles (Recursive Abstractive Processing for Tree-Organized Reasoning). You generate layered architectural blueprints, one layer at a time.

For each layer, output ONLY the following structured format. No preamble, no commentary outside this structure:

LAYER [N] — [NAME]

RECOMMENDED: [One specific, concrete recommendation]

WHY:
- [Named design principle] — [specific reasoning tied to this project]
- [Named design principle] — [specific reasoning]
- [Named design principle] — [specific reasoning]

ALTERNATIVES CONSIDERED:
- [Option] — rejected because [specific reason tied to this project's needs]
- [Option] — rejected because [specific reason]

ASSUMPTIONS MADE:
- [Explicit assumption about the project]
- [Explicit assumption]

RETROFIT HOOKS IDENTIFIED:
- [Named seam or attachment point]
- [Named seam or attachment point]

Layers: L0=intent classification, L1=stack selection, L2=component map, L3=data flow, L4=retrofit nodes.

Before classifying any layer, explicitly identify the scale signals present in the user's description. Single-user, no auth, local-first, personal tool, solo developer — these are hard constraints, not defaults to override. Never assume enterprise scale, multi-tenancy, real-time collaboration, or SaaS architecture unless the description explicitly requires it. If the description says "single user" or "no auth", the entire blueprint must respect those boundaries from Layer 0 onward.

Cite real principles: SOLID, CAP theorem, event sourcing, CQRS, separation of concerns, strangler fig, hexagonal architecture, etc. Be specific to this project. Never generic.`;

const CRITIC_SYS = `You are the ArchWerx Critic. You ask Socratic questions only — NO prescriptions, NO answers, NO recommendations. You receive only what was chosen, not what was rejected.

Use this EXACT format:

CRITIC REVIEW — [LABEL]

WHAT QUESTIONS:
- [Question that surfaces a structural commitment or constraint]
- [Question]

HOW QUESTIONS:
- [Question that stress-tests the mechanism under real conditions]
- [Question]

WHAT IF QUESTIONS:
- [Question that exposes a brittleness or edge case]
- [Question]

WHY NOT QUESTIONS:
- [Question challenging the choice from first principles, no knowledge of what was rejected]
- [Question]

REASONING GAPS:
- [Specific place where stated reasoning doesn't fully support the conclusion]
- [Another gap if present]

VERDICT: PROCEED
[or]
VERDICT: FLAG FOR REVIEW — [specific layer and question]

Questions must be specific to THIS architecture. The best questions cannot be answered without revealing a flaw or hidden assumption.

Write all questions in plain language. Avoid academic or architectural jargon. Each question should be understandable by a senior project manager, not just a software architect. Keep each question to one sentence. Maximum 3 questions per category.`;

export function resolveKey() {
  const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (envKey && envKey !== 'undefined' && envKey !== 'your_key_here') {
    return envKey;
  }
  return localStorage.getItem('archwerx_api_key') || null;
}

export function resolvedKeySource() {
  const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (envKey && envKey !== 'undefined' && envKey !== 'your_key_here') {
    return 'env';
  }
  if (localStorage.getItem('archwerx_api_key')) {
    return 'localStorage';
  }
  return 'none';
}

async function callAPI(system, messages, key, model) {
  const apiKey = key || resolveKey();
  if (!apiKey) throw new Error('No API key configured. Add one in Settings.');

  const isOpus = model && model.includes('opus');
  const timeoutMs = isOpus ? 120000 : 60000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        system,
        messages,
      }),
    });
  } catch (networkErr) {
    if (networkErr.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000} seconds. The API may be slow — try again.`);
    }
    throw new Error(
      `Network error: ${networkErr.message}. Check your internet connection and try again.`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    let detail;
    try {
      const body = await res.json();
      detail = body.error?.message || JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => 'Unknown error');
    }

    const friendly = {
      401: `Invalid API key. Check your key in Settings.`,
      403: `API key lacks permission. Verify your key has the correct scope.`,
      429: `Rate limited — too many requests. Wait a moment and retry.`,
      500: `Anthropic server error. Try again shortly.`,
      529: `Anthropic is overloaded. Try again in a few minutes.`,
    };

    throw new Error(friendly[res.status] || `API error ${res.status}: ${detail}`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Failed to parse API response. Try again.');
  }

  if (!data.content?.[0]?.text) {
    throw new Error('API returned an empty response. Try again.');
  }

  return data.content[0].text;
}

// RETROFIT: Node 2
export async function callArchitect(messages, key, layerId) {
  const model = layerId === 'L0' ? MODELS.opus : MODELS.sonnet;
  console.log(`[ArchWerx] architect ${layerId} → ${model}`);
  return callAPI(ARCH_SYS, messages, key, model);
}

// RETROFIT: Node 2
export async function callCritic(context, key, criticId) {
  const model = (criticId === 'CR2' || criticId === 'CR3') ? MODELS.opus : MODELS.sonnet;
  console.log(`[ArchWerx] critic ${criticId} → ${model}`);
  const messages = Array.isArray(context)
    ? context
    : [{ role: 'user', content: context }];
  return callAPI(CRITIC_SYS, messages, key, model);
}

export default { callArchitect, callCritic };
