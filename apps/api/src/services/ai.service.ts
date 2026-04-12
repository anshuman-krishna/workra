import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// thin wrapper over the anthropic messages api. the rest of the codebase talks
// to this module only — callers never import fetch directly. every public
// function returns both the generated text and a flag saying whether the call
// actually reached the llm, so ui can label "ai-enhanced" vs "system summary".
//
// design rules:
// - ai is optional. if ANTHROPIC_API_KEY is missing, every call resolves with
//   the caller-supplied fallback and `aiGenerated: false`.
// - the request has a hard timeout (AI_TIMEOUT_MS) so a flaky provider never
//   stalls a user action. timeouts count as fallback, not errors.
// - we never throw from here. a failed ai call is a degraded experience, not
//   a broken endpoint — the product still works without it.
// - prompts are short and structured. the llm is asked for one paragraph, no
//   markdown, no preamble. we strip any leakage before returning.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export function isAiEnabled(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

interface GenerateOptions {
  system: string;
  prompt: string;
  fallback: string;
  // caller-controlled ceiling. the service enforces its own absolute ceiling
  // via AI_MAX_TOKENS so a misconfigured caller can't blow the budget.
  maxTokens?: number;
}

interface GenerateResult {
  text: string;
  aiGenerated: boolean;
}

async function generate(options: GenerateOptions): Promise<GenerateResult> {
  if (!isAiEnabled()) {
    return { text: options.fallback, aiGenerated: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY as string,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        max_tokens: Math.min(options.maxTokens ?? env.AI_MAX_TOKENS, env.AI_MAX_TOKENS),
        system: options.system,
        messages: [{ role: 'user', content: options.prompt }],
      }),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, 'ai provider returned non-ok status');
      return { text: options.fallback, aiGenerated: false };
    }

    const payload = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const parts = payload.content ?? [];
    const text = parts
      .filter((p) => p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text as string)
      .join('')
      .trim();

    if (!text) {
      logger.warn('ai provider returned empty content');
      return { text: options.fallback, aiGenerated: false };
    }

    return { text: cleanup(text), aiGenerated: true };
  } catch (err) {
    const aborted = (err as { name?: string }).name === 'AbortError';
    logger.warn({ err, aborted }, 'ai call failed, using fallback');
    return { text: options.fallback, aiGenerated: false };
  } finally {
    clearTimeout(timeout);
  }
}

// strip common llm preambles and quote marks. llms occasionally prepend "here's
// a summary:" even when told not to — we'd rather drop that than surface it.
function cleanup(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '');
  cleaned = cleaned.replace(/^(here'?s?|sure|here is|certainly)[^:.\n]*[:.]\s*/i, '');
  cleaned = cleaned.replace(/^["']+|["']+$/g, '');
  return cleaned.trim();
}

// ---------------------------------------------------------------------------
// report narrative
// ---------------------------------------------------------------------------

export interface ReportNarrativeInput {
  roomName: string;
  scopeLabel: string;
  rangeLabel: string;
  totals: {
    tracked: string;
    sessionCount: number;
    taskCompletedCount: number;
    activeDays: number;
    rangeDays: number;
    eventCount: number;
  };
  topTasks: Array<{ title: string; duration: string }>;
  dailyHighlights: Array<{ date: string; duration: string }>;
  recentSessions: Array<{ intent: string; summary: string | null; duration: string }>;
  fallback: string;
}

export async function generateReportNarrative(
  input: ReportNarrativeInput,
): Promise<GenerateResult> {
  const { totals } = input;
  // compose a tight prompt. the llm is asked for one short paragraph the user
  // can send to a client verbatim, grounded in the numbers we actually measured.
  const prompt = [
    `room: ${input.roomName}`,
    `range: ${input.rangeLabel}`,
    `scope: ${input.scopeLabel}`,
    `tracked: ${totals.tracked}`,
    `sessions: ${totals.sessionCount}`,
    `tasks_completed: ${totals.taskCompletedCount}`,
    `active_days: ${totals.activeDays} of ${totals.rangeDays}`,
    `events: ${totals.eventCount}`,
    '',
    'top tasks by time:',
    ...(input.topTasks.length > 0
      ? input.topTasks.map((t) => `- ${t.title} (${t.duration})`)
      : ['- (none)']),
    '',
    'recent sessions:',
    ...(input.recentSessions.length > 0
      ? input.recentSessions
          .slice(0, 6)
          .map(
            (s) =>
              `- ${s.duration} — ${s.intent}${s.summary ? ` — ${s.summary}` : ''}`,
          )
      : ['- (none)']),
  ].join('\n');

  return generate({
    system:
      'you write short, professional work summaries for a freelancer sharing progress with a client. ' +
      'tone: calm, humble, specific. use lowercase prose. no emoji, no em-dashes, no hype. ' +
      'output one paragraph (3-5 sentences). stick to the numbers and tasks provided. ' +
      'if the data shows little work, say so plainly.',
    prompt,
    fallback: input.fallback,
    maxTokens: 400,
  });
}

// ---------------------------------------------------------------------------
// session summary suggestion
// ---------------------------------------------------------------------------

export interface SessionSummaryInput {
  intent: string;
  linkedTaskTitle: string | null;
  durationLabel: string;
  fallback: string;
}

export async function suggestSessionSummary(
  input: SessionSummaryInput,
): Promise<GenerateResult> {
  const prompt = [
    `intent: ${input.intent}`,
    input.linkedTaskTitle ? `linked_task: ${input.linkedTaskTitle}` : 'linked_task: (none)',
    `duration: ${input.durationLabel}`,
  ].join('\n');

  return generate({
    system:
      'you write a single-sentence session log entry for a freelancer who just finished working. ' +
      'tone: honest, specific, lowercase. no hype, no emoji, no em-dashes. ' +
      'base it on the intent. never claim completion unless the intent does. ' +
      'output at most one sentence under 140 characters.',
    prompt,
    fallback: input.fallback,
    maxTokens: 120,
  });
}

// ---------------------------------------------------------------------------
// daily recap
// ---------------------------------------------------------------------------

export interface DailyRecapInput {
  dateLabel: string;
  tracked: string;
  sessionCount: number;
  taskCompletedCount: number;
  sessions: Array<{ intent: string; summary: string | null; duration: string; roomName: string }>;
  insights: string[];
  fallback: string;
}

export async function generateDailyRecap(input: DailyRecapInput): Promise<GenerateResult> {
  const prompt = [
    `date: ${input.dateLabel}`,
    `tracked: ${input.tracked}`,
    `sessions: ${input.sessionCount}`,
    `completed_tasks: ${input.taskCompletedCount}`,
    '',
    'sessions today:',
    ...(input.sessions.length > 0
      ? input.sessions.map(
          (s) =>
            `- [${s.roomName}] ${s.duration} — ${s.intent}${s.summary ? ` — ${s.summary}` : ''}`,
        )
      : ['- (none)']),
    '',
    'computed insights:',
    ...(input.insights.length > 0 ? input.insights.map((i) => `- ${i}`) : ['- (none)']),
  ].join('\n');

  return generate({
    system:
      'you write a calm daily recap for a freelancer looking at their own dashboard. ' +
      'tone: personal, quiet, lowercase. no hype, no emoji, no em-dashes. ' +
      'output two short sentences at most, referencing actual numbers and what they worked on.',
    prompt,
    fallback: input.fallback,
    maxTokens: 200,
  });
}
