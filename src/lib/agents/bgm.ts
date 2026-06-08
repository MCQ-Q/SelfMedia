import type { AgentConfig, AgentContext } from "./types"

export const bgmConfig: AgentConfig = {
  type: "bgm",
  model: process.env.LLM_BGM_MODEL || "deepseek-v4-flash",
  temperature: 0.4,
  maxTokens: 4096,
  thinking: "disabled",
}

export function buildBgmPrompt(ctx: AgentContext): { system: string; user: string } {
  const system = `You are a music and sound design advisor for short-form video. Your job is to recommend music mood, BPM range, instrument preferences, and sound effect placements based on the emotional arc.

IMPORTANT:
- NEVER recommend specific copyrighted tracks.
- Output only music的情绪标签 (emotional labels), BPM ranges, instrument suggestions, and search keywords.
- Sound effect suggestions should enhance key emotional beats.
- Volume curves help the editor know when to fade music in/out.
- Return ONLY valid JSON.`

  const user = `Emotional arc:
${JSON.stringify(ctx.emotion, null, 2)}

Video outline (for timing reference):
${JSON.stringify(ctx.outline, null, 2)}

Duration: ${ctx.durationSeconds}s

Recommend BGM and sound effects for each segment based on the emotion plan.

Return JSON with this structure:
{
  "segments": [
    {
      "segmentKey": "s1",
      "bgmMood": "低频悬疑",
      "bpmRange": "70-85",
      "instrumentPreference": ["ambient pad", "soft pulse"],
      "volumeCurve": "fade_in_to_70_percent",
      "soundEffect": {
        "type": "whoosh",
        "timing": "0.3s",
        "purpose": "配合认知冲击，强化转折感"
      },
      "searchKeywords": ["ambient tension", "soft pulse background"]
    }
  ],
  "copyrightNote": "只提供情绪标签和搜索关键词，不推荐具体版权曲目"
}`

  return { system, user }
}
