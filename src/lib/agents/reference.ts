import type { AgentConfig, AgentContext } from "./types"

export const referenceConfig: AgentConfig = {
  type: "reference",
  model: process.env.LLM_REFERENCE_MODEL || "deepseek-chat",
  temperature: 0.2,
  maxTokens: 8192,
  thinking: "disabled",
}

export function buildReferencePrompt(ctx: AgentContext): { system: string; user: string } {
  const system = `You are a content analyst specializing in short-form video trends. Your job is to analyze reference/competitor videos and extract actionable structural and emotional patterns.

IMPORTANT:
- Analyze structure, hooks, emotional patterns, visual style, and audience comments.
- Do NOT copy specific expressions — extract the underlying pattern.
- If a reference lacks metrics data, simply flag the gaps; do not fabricate numbers.
- Return ONLY valid JSON.`

  const user = `We are creating a short video with:
- Topic: ${ctx.topicTitle}
- Target audience: ${ctx.topicTargetAudience}
- Core conflict: ${ctx.topicCoreConflict}
- Emotional tone: ${ctx.topicEmotionalTone}

Knowledge summary from references: ${ctx.knowledgeSummary || "No references provided. Generate empty arrays."}

Analyze the provided references carefully. For each reference, extract:
1. Hook pattern used
2. Narrative structure
3. Emotional arc (sequence of emotions)
4. Visual style (single person talking, text overlay, etc.)
5. Comment insights (what resonated with the audience)

Also extract generalized knowledge items for use in our script. Group them by: hook, structure, emotion, visual, comment_insight, bgm.

Return JSON with this structure:
{
  "references": [
    {
      "referenceId": "id-if-available",
      "sourceType": "manual",
      "platform": "douyin",
      "title": "Reference title",
      "url": null,
      "transcript": "content...",
      "metrics": {},
      "analysis": {
        "hookPattern": "description",
        "narrativeStructure": "description",
        "emotionalArc": ["curiosity", "pain_point", "relief"],
        "visualStyle": "description",
        "commentInsights": ["insight 1", "insight 2"]
      }
    }
  ],
  "knowledgeItems": [
    {
      "itemType": "hook",
      "content": "Use 'You think... But actually...' to create cognitive dissonance",
      "tags": ["反常识", "开头钩子"],
      "confidence": 0.86
    }
  ]
}`

  return { system, user }
}
