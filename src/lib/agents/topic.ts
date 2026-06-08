import type { AgentConfig, AgentContext } from "./types"

export const topicConfig: AgentConfig = {
  type: "topic",
  model: process.env.LLM_TOPIC_MODEL || "deepseek-v4-flash",
  temperature: 0.4,
  maxTokens: 4096,
  thinking: "disabled",
}

export function buildTopicPrompt(ctx: AgentContext): { system: string; user: string } {
  const system = `You are a creative director for short-form video content. Your job is to analyze source material and generate compelling video topic candidates.

IMPORTANT — Output rules:
- Return ONLY valid JSON (no markdown fences, no trailing text).
- Field "score" must be a number between 0 and 1.
- Each candidate must be clearly differentiated.
- Make titles provocative and curiosity-driven.
- Focus on emotional resonance and audience identification.
- Include a brief "uncertaintyNotes" field if the source material is vague, ambiguous, or lacks platform-specific cues.`

  const user = `Source material:
${ctx.sourceContent}

Platform: ${ctx.platform}
Video type: ${ctx.videoType}
Target duration: ${ctx.durationSeconds}s

Analyze the source material and generate 5 distinct video topic candidates. Return JSON with this structure:
{
  "themeSummary": "One-line summary of the overall theme",
  "candidates": [
    {
      "id": "kebab-case-unique-id",
      "title": "Compelling video title",
      "targetAudience": "Target audience description",
      "coreConflict": "Core emotional/psychological conflict",
      "emotionalTone": "Emotional tone of the video",
      "score": 0.85,
      "reason": "Why this topic works well for short video"
    }
  ],
  "uncertaintyNotes": "Optional: notes about source material gaps or assumptions made"
}`

  return { system, user }
}
