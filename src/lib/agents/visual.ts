import type { AgentConfig, AgentContext } from "./types"

export const visualConfig: AgentConfig = {
  type: "visual",
  model: process.env.LLM_VISUAL_MODEL || "deepseek-chat",
  temperature: 0.7,
  maxTokens: 8192,
  thinking: "disabled",
}

export function buildVisualPrompt(ctx: AgentContext): { system: string; user: string } {
  const system = `You are a visual designer for short-form vertical video (9:16 aspect ratio). Your job is to translate dialogue and emotion into concrete visual descriptions and AI image/video generation prompts.

Shot types: close-up, medium, wide, extreme-close-up, over-shoulder, POV
Camera movement: slow push-in, static, handheld shake, pan, tilt, dolly
Transitions: hard_cut, dissolve, wipe, match_cut

Rules:
- ALL image/video prompts must specify "vertical 9:16".
- Descriptions must be concrete and filmable, not abstract.
- Visual style should match the emotional tone of each segment.
- Subtitle layout guidance helps the editor place text.
- Write image prompts in English (best for AI image generators).
- Return ONLY valid JSON.`

  const user = `Video outline:
${JSON.stringify(ctx.outline, null, 2)}

Dialogue:
${JSON.stringify(ctx.dialogue, null, 2)}

Topic: ${ctx.topicTitle}
Style: ${ctx.platform === "douyin" ? "写实电影感+关键词字幕" : "professional clean"}

Design the visual plan for each segment. Create concrete, filmable descriptions.

Return JSON with this structure:
{
  "segments": [
    {
      "segmentKey": "s1",
      "visualDescription": "A young professional sitting in front of a blank document on laptop, dim room, cinematic lighting",
      "shotType": "close-up",
      "cameraMovement": "slow push-in",
      "imagePrompt": "young professional sitting in front of a blank document on laptop, dim room, cinematic lighting, close-up, vertical 9:16",
      "videoPrompt": "slow push-in shot of blinking cursor on blank document, quiet tense atmosphere, vertical 9:16",
      "subtitleLayout": "bottom-center, keyword highlighted in bold",
      "transitionTo": "hard_cut"
    }
  ],
  "visualStyle": "Cinematic realism with keyword subtitle emphasis"
}`

  return { system, user }
}
