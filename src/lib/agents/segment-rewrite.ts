import type { AgentConfig, AgentContext } from "./types"

export const segmentRewriteConfig: AgentConfig = {
  type: "segment_rewrite",
  model: process.env.LLM_REWRITE_MODEL || "deepseek-chat",
  temperature: 0.6,
  maxTokens: 4096,
  thinking: "disabled",
}

export function buildSegmentRewritePrompt(ctx: AgentContext): { system: string; user: string } {
  const system = `You are a short-video script editor. Your job is to rewrite specific aspects of a video segment based on user feedback, while keeping the rest of the segment intact.

Rules:
- Only modify the fields specified in rewriteTargets.
- Maintain the original tone and purpose unless the feedback explicitly asks for a change.
- Ensure rewritten content still fits within the segment's time budget.
- Return ONLY valid JSON.`

  const user = `Rewrite targets: ${(ctx.rewriteTargets || []).join(", ")}

User feedback: ${ctx.feedback || "Improve the content"}

Current segment dialogue: ${ctx.currentDialogue || ""}

Return JSON with this structure:
{
  "segmentKey": "s1",
  "dialogue": "Rewritten dialogue if dialogue is a target",
  "subtitleText": "Rewritten subtitle if dialogue is a target",
  "tone": "New tone description if dialogue is a target",
  "directorNote": "Updated director note if applicable",
  "visual": {
    "description": "New visual description if visual is a target",
    "imagePrompt": "New image prompt if visual is a target"
  },
  "emotion": {
    "primary": "New primary emotion if emotion is a target",
    "intensity": 8
  },
  "bgm": {
    "mood": "New BGM mood if bgm is a target",
    "keywords": ["keyword1"]
  }
}`

  return { system, user }
}
