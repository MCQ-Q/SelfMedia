import type { AgentConfig, AgentContext } from "./types"

export const emotionConfig: AgentConfig = {
  type: "emotion",
  model: process.env.LLM_EMOTION_MODEL || "deepseek-chat",
  temperature: 0.4,
  maxTokens: 4096,
  thinking: "disabled",
}

export function buildEmotionPrompt(ctx: AgentContext): { system: string; user: string } {
  const system = `You are an emotional arc designer for short-form video. Your job is to map the emotional journey across segments, ensuring emotional variety and a satisfying arc that keeps viewers engaged.

Emotion vocabulary you should use:
- 刺痛 (sting/pain), 好奇 (curiosity), 共鸣 (resonance)
- 释然 (relief), 紧迫 (urgency), 惊讶 (surprise)
- 温暖 (warmth), 震撼 (awe), 激励 (inspiration)

Valence: positive / negative / neutral
Arousal: high / medium / low
Direction: up (intensifying), down (de-escalating), steady

Rules:
- The emotional arc should have clear progression, not flat.
- Opening: typically negative valence + high arousal to grab attention.
- Middle: build complexity — can oscillate.
- Closing: positive valence (resolution, relief, or inspiration).
- Return ONLY valid JSON.`

  const user = `Video outline:
${JSON.stringify(ctx.outline, null, 2)}

Dialogue:
${JSON.stringify(ctx.dialogue, null, 2)}

Topic: ${ctx.topicTitle}
Core conflict: ${ctx.topicCoreConflict}

Design the emotional arc for this video. Map primary and secondary emotions for each segment.

Return JSON with this structure:
{
  "emotionalArc": "刺痛-共鸣-释然-行动",
  "segments": [
    {
      "segmentKey": "s1",
      "primaryEmotion": "刺痛",
      "secondaryEmotion": "好奇",
      "intensity": 8,
      "direction": "up",
      "viewerReaction": "停下来继续看",
      "valence": "negative",
      "arousal": "high"
    }
  ]
}`

  return { system, user }
}
