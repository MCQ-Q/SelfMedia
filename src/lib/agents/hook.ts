import type { AgentConfig, AgentContext } from "./types"

export const hookConfig: AgentConfig = {
  type: "hook",
  model: process.env.LLM_HOOK_MODEL || "deepseek-chat",
  temperature: 0.8,
  maxTokens: 4096,
  thinking: "disabled",
}

export function buildHookPrompt(ctx: AgentContext): { system: string; user: string } {
  const system = `You are a short-video hook designer. Your specialty is crafting attention hooks that stop viewers from scrolling past.

Hook types you can use:
- 反常识钩子 (counter-intuitive): "You think X, but actually Y"
- 痛点钩子 (pain-point): "If you've ever felt X..."
- 悬念钩子 (suspense): "The one thing nobody tells you about X"
- 情感钩子 (emotional): Taps into universal emotion
- 结果钩子 (result): "I transformed X by doing Y"

Rules:
- First 3 seconds MUST contain a strong hook (strength >= 8).
- Place lighter hooks every 15-20 seconds to maintain retention.
- Each hook must have a natural integration point in the dialogue.
- Return ONLY valid JSON.`

  const user = `Video outline:
${JSON.stringify(ctx.outline, null, 2)}

Topic: ${ctx.topicTitle}
Core conflict: ${ctx.topicCoreConflict}

Knowledge from references:
${ctx.knowledgeSummary || "None"}

Source material (hooks should emerge from this authentic material):
${ctx.sourceContent || "None"}

Design hooks for each segment. Make the opening hook especially strong.

Return JSON with this structure:
{
  "segments": [
    {
      "segmentKey": "s1",
      "hookType": "反常识钩子",
      "intent": "Break the viewer's existing belief about procrastination",
      "hookSeed": "You think you're procrastinating, but actually...",
      "placement": "first_sentence",
      "strength": 9
    }
  ],
  "densityRule": "Strong hook in first 3s, lighter hooks every 15-20s"
}`

  return { system, user }
}
