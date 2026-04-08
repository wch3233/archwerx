const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1000;

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

Questions must be specific to THIS architecture. The best questions cannot be answered without revealing a flaw or hidden assumption.`;

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

async function callAPI(system, messages, key) {
  const apiKey = key || resolveKey();
  if (!apiKey) throw new Error('No API key configured. Add one in Settings.');

  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages,
      }),
    });
  } catch (networkErr) {
    throw new Error(
      `Network error: ${networkErr.message}. Check your internet connection and try again.`,
    );
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
export async function callArchitect(messages, key) {
  return callAPI(ARCH_SYS, messages, key);
}

// RETROFIT: Node 2
export async function callCritic(context, key) {
  const messages = Array.isArray(context)
    ? context
    : [{ role: 'user', content: context }];
  return callAPI(CRITIC_SYS, messages, key);
}

export default { callArchitect, callCritic };
