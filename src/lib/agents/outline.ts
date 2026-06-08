import type { AgentConfig, AgentContext } from "./types"

export const outlineConfig: AgentConfig = {
  type: "outline",
  model: process.env.LLM_OUTLINE_MODEL || "v4-flash",
  temperature: 0.5,
  maxTokens: 4096,
  thinking: "disabled",
}

export function buildOutlinePrompt(ctx: AgentContext): { system: string; user: string } {
  const system = `You are a short-video structural designer. Your job is to break a topic into a timed segment structure that maximizes viewer retention.

IMPORTANT:
- Design segments that cover the FULL target duration.
- The first segment (0-5s) MUST include a strong opening that grabs attention.
- Reserve the first 20-30 seconds for an opening experience chain: hook -> experience extension -> contradiction -> conflict escalation -> question -> transition into the body.
- Do not let the outline jump from hook directly into explanation. The body explanation should begin only after the opening question has been established.
- The last segment MUST include a call-to-action or memorable closing.
- Use distinct segment keys like "s1", "s2", "s3", etc.
- Segment times must be contiguous: each segment's startTime = previous segment's endTime.
- Segment 1 must start at 0.
- Return ONLY valid JSON.`

  const user = `Video project:
- Topic: ${ctx.topicTitle}
- Target audience: ${ctx.topicTargetAudience}
- Core conflict: ${ctx.topicCoreConflict}
- Emotional tone: ${ctx.topicEmotionalTone}
- Duration: ${ctx.durationSeconds}s

Knowledge from references:
${ctx.knowledgeSummary || "None"}

Source material (original notes, reflections, chat logs — stay faithful to this):
${ctx.sourceContent || "None"}

Design a segment structure for this ${ctx.durationSeconds}-second video. Each segment should have a specific goal (hook, deliver insight, build emotion, call to action, etc.).

Return JSON with this structure:
{
  "totalDurationSeconds": ${ctx.durationSeconds},
  "summary": "Brief summary of the video's narrative arc",
  "segments": [
    {
      "segmentKey": "s1",
      "orderIndex": 1,
      "startTime": 0,
      "endTime": 5,
      "goal": "What this segment aims to achieve",
      "coreInfo": "The ONE key message of this segment",
      "intensityLevel": 8
    }
  ],
  "climaxPosition": "e.g., 40-50s",
  "endingAction": "What to prompt the viewer to do"
}`

  return { system, user }
}
