/**
 * AI Business Analyst — provider abstraction over Gemini and Groq REST APIs.
 * Plain fetch, no SDKs. Key resolution: restaurant settings → env fallback.
 * If the preferred provider fails with a quota/auth error and the other
 * provider has a key, we retry there before giving up.
 */
import { AppError } from '../middleware/errorHandler';
import type { AiProvider, AiReportContent } from '@waiterless/types';

const GEMINI_MODEL = 'gemini-2.0-flash';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export interface AiKeys { geminiApiKey?: string; groqApiKey?: string; }

export function resolveKey(provider: AiProvider, keys: AiKeys): string | undefined {
  if (provider === 'gemini') return keys.geminiApiKey || process.env.GEMINI_API_KEY || undefined;
  return keys.groqApiKey || process.env.GROQ_API_KEY || undefined;
}

const SYSTEM_PROMPT = `You are a veteran restaurant business consultant analysing point-of-sale data for a small restaurant. You write for a busy owner with no analytics background: plain language, specific numbers, no fluff. All money values are in the restaurant's local currency.

Respond with ONLY a JSON object matching exactly this schema (no markdown, no commentary):
{
  "healthScore": <integer 0-100 judging overall business health from growth, volume and consistency>,
  "healthLabel": <"Strong" | "Stable" | "Needs attention" | "At risk">,
  "executiveSummary": <2-3 sentences: the state of the business and the single most important thing to act on>,
  "insights": [4 to 6 items of { "type": "win"|"warning"|"opportunity", "title": <short punchy headline>, "detail": <1-2 sentences with concrete numbers>, "metric": <the key number as a short string, e.g. "+12% WoW"> }],
  "menuEngineering": {
    "stars": [<item names: high volume AND high revenue — promote these>],
    "puzzles": [<low volume but high revenue per sale — market these>],
    "plowhorses": [<high volume but low revenue contribution — consider repricing>],
    "dogs": [<low volume, low revenue — rework or drop>],
    "note": <1 sentence on the single most impactful menu move>
  },
  "actions": [3 to 5 items of { "title": <imperative, e.g. "Add a lunch set menu">, "detail": <what to do and why, 1-2 sentences>, "expectedImpact": <estimated effect, e.g. "+NPR 15,000/month">, "effort": "low"|"medium"|"high" }],
  "forecast": { "nextWeekRevenue": <integer, projected from the trend>, "confidence": "low"|"medium"|"high", "note": <1 sentence> }
}`;

function buildUserPrompt(snapshot: Record<string, unknown>): string {
  return `Analyse this restaurant's last-30-days data and produce the JSON report.\n\n${JSON.stringify(snapshot, null, 1)}`;
}

// ── Providers ────────────────────────────────────────────────────────────────

async function callGemini(apiKey: string, snapshot: Record<string, unknown>): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: buildUserPrompt(snapshot) }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      }),
    }
  );
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Gemini request failed (${res.status})`;
    throw new AppError(msg, res.status === 429 ? 429 : 502);
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new AppError('Gemini returned an empty response', 502);
  return text;
}

async function callGroq(apiKey: string, snapshot: Record<string, unknown>): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(snapshot) },
      ],
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Groq request failed (${res.status})`;
    throw new AppError(msg, res.status === 429 ? 429 : 502);
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new AppError('Groq returned an empty response', 502);
  return text;
}

// ── Parsing & validation ─────────────────────────────────────────────────────

function parseReport(raw: string): AiReportContent {
  // Strip accidental markdown fences and grab the outermost JSON object
  const cleaned = raw.replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new AppError('AI response was not valid JSON', 502);

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new AppError('AI response could not be parsed as JSON', 502);
  }

  const labels = ['Strong', 'Stable', 'Needs attention', 'At risk'];
  if (
    typeof parsed.healthScore !== 'number' ||
    typeof parsed.executiveSummary !== 'string' ||
    !Array.isArray(parsed.insights) ||
    !Array.isArray(parsed.actions) ||
    !parsed.menuEngineering || !parsed.forecast
  ) {
    throw new AppError('AI response was missing required report fields', 502);
  }

  parsed.healthScore = Math.max(0, Math.min(100, Math.round(parsed.healthScore)));
  if (!labels.includes(parsed.healthLabel)) {
    parsed.healthLabel =
      parsed.healthScore >= 75 ? 'Strong' :
      parsed.healthScore >= 55 ? 'Stable' :
      parsed.healthScore >= 35 ? 'Needs attention' : 'At risk';
  }
  for (const key of ['stars', 'puzzles', 'plowhorses', 'dogs'] as const) {
    if (!Array.isArray(parsed.menuEngineering[key])) parsed.menuEngineering[key] = [];
  }
  parsed.insights = parsed.insights.filter((i: any) => i && i.title && i.detail).slice(0, 6);
  parsed.actions = parsed.actions.filter((a: any) => a && a.title && a.detail).slice(0, 5);

  return parsed as AiReportContent;
}

// ── Chat with the analyst (plain-text answers over the same snapshot) ────────

export interface ChatMessage { role: 'user' | 'assistant'; content: string }

const CHAT_SYSTEM_PROMPT = `You are the AI business analyst inside Waiterless, talking to a restaurant owner about THEIR restaurant. You are given a JSON snapshot of their last 30 days (sales, menu items, hours, payments, guest feedback, inventory).

Rules:
- Answer ONLY from the snapshot. If the data can't answer it, say so briefly and suggest what data would help.
- Be concise: 2-5 sentences, plain text (no markdown, no bullet lists unless asked). Always cite concrete numbers from the snapshot.
- Money is in the restaurant's currency (NPR unless stated). Round sensibly.
- You may do arithmetic (growth %, averages, projections) but never invent data.
- If asked something unrelated to their restaurant business, politely steer back in one sentence.`;

async function chatGemini(apiKey: string, snapshot: Record<string, unknown>, messages: ChatMessage[]): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${CHAT_SYSTEM_PROMPT}\n\nSNAPSHOT:\n${JSON.stringify(snapshot)}` }] },
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
      }),
    }
  );
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new AppError(data?.error?.message || `Gemini request failed (${res.status})`, res.status === 429 ? 429 : 502);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new AppError('Gemini returned an empty response', 502);
  return text.trim();
}

async function chatGroq(apiKey: string, snapshot: Record<string, unknown>, messages: ChatMessage[]): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.3,
      max_tokens: 400,
      messages: [
        { role: 'system', content: `${CHAT_SYSTEM_PROMPT}\n\nSNAPSHOT:\n${JSON.stringify(snapshot)}` },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new AppError(data?.error?.message || `Groq request failed (${res.status})`, res.status === 429 ? 429 : 502);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new AppError('Groq returned an empty response', 502);
  return text.trim();
}

export async function chatWithAnalyst(
  snapshot: Record<string, unknown>,
  messages: ChatMessage[],
  preferred: AiProvider,
  keys: AiKeys
): Promise<{ answer: string; provider: AiProvider }> {
  const order: AiProvider[] = preferred === 'gemini' ? ['gemini', 'groq'] : ['groq', 'gemini'];
  let lastError: Error | null = null;

  for (const provider of order) {
    const key = resolveKey(provider, keys);
    if (!key) continue;
    try {
      const answer = provider === 'gemini'
        ? await chatGemini(key, snapshot, messages)
        : await chatGroq(key, snapshot, messages);
      return { answer, provider };
    } catch (err) {
      lastError = err as Error;
    }
  }

  if (lastError) throw lastError;
  throw new AppError('No AI API key configured. Add a free Gemini or Groq API key in Settings.', 400);
}

// ── Entry point ──────────────────────────────────────────────────────────────

export async function generateBusinessReport(
  snapshot: Record<string, unknown>,
  preferred: AiProvider,
  keys: AiKeys
): Promise<{ content: AiReportContent; provider: AiProvider; model: string }> {
  const order: AiProvider[] = preferred === 'gemini' ? ['gemini', 'groq'] : ['groq', 'gemini'];
  let lastError: Error | null = null;

  for (const provider of order) {
    const key = resolveKey(provider, keys);
    if (!key) continue;
    try {
      const raw = provider === 'gemini' ? await callGemini(key, snapshot) : await callGroq(key, snapshot);
      return {
        content: parseReport(raw),
        provider,
        model: provider === 'gemini' ? GEMINI_MODEL : GROQ_MODEL,
      };
    } catch (err) {
      lastError = err as Error;
      // Quota/auth problems are worth retrying on the other provider; parse errors too.
    }
  }

  if (lastError) throw lastError;
  throw new AppError(
    'No AI API key configured. Add a free Gemini or Groq API key in Settings to enable AI reports.',
    400
  );
}
