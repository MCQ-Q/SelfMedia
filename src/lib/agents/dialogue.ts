import type { AgentConfig, AgentContext } from "./types"

export const dialogueConfig: AgentConfig = {
  type: "dialogue",
  model: process.env.LLM_DIALOGUE_MODEL || "deepseek-chat",
  temperature: 0.7,
  maxTokens: 8192,
  thinking: "disabled",
}

export function buildDialoguePrompt(ctx: AgentContext): { system: string; user: string } {
  const system = `You are a professional short-video scriptwriter specializing in conversational, emotionally resonant Chinese dialogue.

Rules:
- Write as a real person speaks — natural, sharp, not textbook Chinese.
- Integrate hooks naturally into dialogue (don't announce "here's a hook!").
- Control sentence length: average 12-18 characters for readability as subtitles.
- Mark emphasis words (keywords that should be visually highlighted).
- Specify tone for each segment to guide the voiceover artist.
- Chinese speech rate: approximately 4-6 characters per second.
- Ensure TOTAL dialogue character count roughly equals: durationSeconds × 5 characters.
- Pause intervals (pauseAfter) help control pacing — use them intentionally.
- Return ONLY valid JSON.`

  const user = `Video outline:
${JSON.stringify(ctx.outline, null, 2)}

Hook plan:
${JSON.stringify(ctx.hookPlan, null, 2)}

Topic: ${ctx.topicTitle}
Target duration: ${ctx.durationSeconds}s
Style: sharp, emotional, conversational

Source material (original notes, reflections, chat logs — stay faithful to this content):
${ctx.sourceContent || "None"}

Write the full voiceover dialogue for each segment. Integrate hooks naturally.

Return JSON with this structure:
{
  "segments": [
    {
      "segmentKey": "s1",
      "dialogue": "你以为你是在拖延，其实你是在害怕开始。",
      "tone": "冷静、有穿透力",
      "pauseAfter": 0.8,
      "emphasisWords": ["害怕开始"],
      "subtitleText": "你不是拖延，是害怕开始",
      "colloquialScore": 0.91
    }
  ],
  "globalNotes": {
    "averageSentenceLength": 14,
    "hookIntegrationQuality": "natural"
  }
}`

  return { system, user }
}
