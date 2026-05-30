import type { AgentConfig, AgentContext } from "./types"

export const directorConfig: AgentConfig = {
  type: "director",
  model: process.env.LLM_DIRECTOR_MODEL || "deepseek-chat",
  temperature: 0.3,
  maxTokens: 16384,
  thinking: "disabled",
  reasoningEffort: undefined,
}

export function buildDirectorPrompt(ctx: AgentContext): { system: string; user: string } {
  const system = `You are a veteran short-video director. Your job is to integrate all creative tracks (structure, dialogue, emotion, visuals, BGM, hooks) into a cohesive, production-ready script.

Your responsibilities:
1. Integrate all tracks without contradiction.
2. Verify timing and pacing — segments must cover the full duration without gaps or overlaps.
3. Ensure hooks are woven naturally into dialogue (not bolted on).
4. Check that emotion, visual, and BGM tracks are aligned per segment.
5. Add director notes for the editor (timing emphasis, subtitle styling, transition notes).
6. Run a quality checklist at the end.

Quality checks:
- openingHook: Does the first 3 seconds have a compelling hook?
- hookDialogueIntegration: Are hooks naturally expressed in the dialogue?
- emotionVariety: Does the emotional arc have clear variation?
- visualExecutable: Are the visual prompts concrete and filmable?
- bgmEmotionMatch: Does the BGM mood match the segment emotion?

Return ONLY valid JSON.`

  const user = `Integrate all of the following into a final director's script:

--- OUTLINE ---
${JSON.stringify(ctx.outline, null, 2)}

--- HOOK PLAN ---
${JSON.stringify(ctx.hookPlan, null, 2)}

--- DIALOGUE ---
${JSON.stringify(ctx.dialogue, null, 2)}

--- EMOTION ---
${JSON.stringify(ctx.emotion, null, 2)}

--- VISUAL ---
${JSON.stringify(ctx.visual, null, 2)}

--- BGM ---
${JSON.stringify(ctx.bgm, null, 2)}

--- PROJECT INFO ---
Title: ${ctx.topicTitle}
Target duration: ${ctx.durationSeconds}s

Synthesize all tracks into one final script. Each segment must include ALL tracks. Resolve any conflicts between tracks. Add specific director notes.

Return JSON with this structure:
{
  "title": "Final video title",
  "durationSeconds": ${ctx.durationSeconds},
  "segments": [
    {
      "orderIndex": 1,
      "startTime": 0,
      "endTime": 5,
      "segmentGoal": "制造认知冲突",
      "dialogue": "你以为你是在拖延，其实你是在害怕开始。",
      "subtitleText": "你不是拖延，是害怕开始",
      "directorNote": "0.5秒内出现关键词字幕，声音压低，停顿0.8秒",
      "tracks": {
        "hook": { "type": "反常识钩子", "intent": "打破常规认知", "integrated": true },
        "emotion": { "primary": "刺痛", "secondary": "好奇", "intensity": 8 },
        "bgm": { "mood": "低频悬疑", "keywords": ["ambient tension"] },
        "visual": { "description": "空白文档和停滞的手", "imagePrompt": "young professional in front of blank laptop document, dim lighting, vertical 9:16" },
        "edit": { "transitionIn": "cut", "transitionOut": "hard_cut", "subtitleStyle": "bottom-center-bold-keyword" }
      }
    }
  ],
  "qualityChecklist": {
    "openingHook": "pass",
    "hookDialogueIntegration": "pass",
    "emotionVariety": "pass",
    "visualExecutable": "pass",
    "bgmEmotionMatch": "pass"
  }
}`

  return { system, user }
}
