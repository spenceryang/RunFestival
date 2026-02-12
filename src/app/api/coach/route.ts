import { NextRequest } from 'next/server';
import { buildSystemPrompt, buildTriggerPrompt } from '@/lib/coach/prompts';
import { createEdgeSupabaseClient } from '@/lib/supabase/edge';
import type { CoachingContext } from '@/types/coach';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Auth check — skip for dev mode (unauthenticated)
  if (request.headers.get('x-demo-mode') !== 'true') {
    const supabase = createEdgeSupabaseClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  let context: CoachingContext;
  try {
    context = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const systemPrompt = buildSystemPrompt(context.persona);
  const triggerPrompt = buildTriggerPrompt(context.trigger.type);

  // If the runner spoke a voice message, override the trigger prompt
  const effectiveTriggerPrompt = context.userMessage
    ? `TRIGGER: The runner spoke to you and said: "${context.userMessage}". Respond directly to what they asked or said, using their current run data for context. Be helpful and conversational.`
    : triggerPrompt;

  // Storytelling and user-initiated get more room for longer responses
  const isLongForm = context.trigger.type === 'idle_storytelling' || context.trigger.type === 'user_initiated';
  const maxTokens = isLongForm ? 600 : 200;

  // Build specialist agent sections
  const paceSection = context.paceAnalysis
    ? `\nPACE ANALYSIS (from Pace Strategist):
- Strategy: ${context.paceAnalysis.strategy}
- Trend: ${context.paceAnalysis.recentTrend}
${context.paceAnalysis.advice ? `- Advice: ${context.paceAnalysis.advice}` : ''}
${context.paceAnalysis.projectedFinishSeconds ? `- Projected finish: ${formatTimeInline(context.paceAnalysis.projectedFinishSeconds)}` : ''}`
    : '';

  const motivationSection = context.motivationState
    ? `\nENERGY STATE (from Motivation Engine):
- Energy level: ${context.motivationState.energyLevel}
- Approach: ${context.motivationState.approach}`
    : '';

  const storySection = context.storyPlan
    ? `\nSTORY PLAN (from Story Curator — use this as raw material, adapt to your voice):
- Title: ${context.storyPlan.title}
- Topic: ${context.storyPlan.topic}
- Current chapter: ${context.storyPlan.arc.part1}
- Key facts: ${context.storyPlan.keyFacts.join(', ')}`
    : '';

  const qualitySection = context.qualityFeedback
    ? `\nCOACHING NOTES (from Quality Supervisor — incorporate this feedback):
${context.qualityFeedback}`
    : '';

  const userMessage = `${effectiveTriggerPrompt}

CURRENT RUN STATE:
- Distance: ${(context.runState.distanceMeters / 1000).toFixed(2)}km${context.runState.targetDistanceMeters ? ` of ${(context.runState.targetDistanceMeters / 1000).toFixed(1)}km` : ''}
- Current pace: ${formatPaceInline(context.runState.currentPaceSecondsPerKm)}/km${context.runState.targetPaceSecondsPerKm ? ` (target: ${formatPaceInline(context.runState.targetPaceSecondsPerKm)}/km)` : ''}
- Elapsed: ${formatTimeInline(context.runState.elapsedSeconds)}
- Splits: ${context.runState.splits.map((s) => `Split ${s.number}: ${formatPaceInline(s.paceSeconds)}/km`).join(', ') || 'None yet'}
${paceSection}
${motivationSection}

LIVE COLLECTIVE:
- ${context.collective.runnerCount} people running right now
- Average pace: ${context.collective.averagePaceFormatted}/km
${context.collective.recentEvents.length > 0 ? `- Recent: ${context.collective.recentEvents.map((e) => e.text).join('; ')}` : ''}

RUNNER PROFILE:
- Name: ${context.profile.name}
${context.profile.storyTopics.length > 0 ? `- Story topics: ${context.profile.storyTopics.join(', ')}` : ''}
${storySection}
${qualitySection}
${buildHistorySection(context)}
${JSON.stringify(context.trigger.data)}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: maxTokens,
        stream: true,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return new Response(JSON.stringify({ error }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Forward the stream directly to the client
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to reach Claude API' }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

function formatPaceInline(secondsPerKm: number): string {
  if (secondsPerKm <= 0 || !isFinite(secondsPerKm)) return '--:--';
  const mins = Math.floor(secondsPerKm / 60);
  const secs = Math.round(secondsPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeInline(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function buildHistorySection(context: CoachingContext): string {
  const h = context.conversationHistory;
  if (!h || h.recentMessages.length === 0) return '';

  const lines = ['\nPREVIOUS COACHING (do NOT repeat these topics or stories):'];
  h.recentMessages.forEach((m, i) => {
    const topicStr = m.topics.length > 0 ? ` (topics: ${m.topics.join(', ')})` : '';
    lines.push(`${i + 1}. [${m.triggerType}] ${m.summary}${topicStr}`);
  });

  if (h.topicsCovered.length > 0) {
    lines.push(`\nTopics already covered this run: ${h.topicsCovered.join(', ')}`);
  }

  if (h.lastCliffhanger) {
    lines.push(`\nYou left off with a cliffhanger: "${h.lastCliffhanger}" — CONTINUE this story if the trigger is idle_storytelling.`);
  }

  return lines.join('\n');
}
