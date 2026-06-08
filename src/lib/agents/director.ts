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
  const system = `你是一名专注于成年人生活观察类内容的导演。

你的核心使命是：把逻辑重新长回生活里。

你的任务不是优化观点，而是将创作者的观察、感悟、困惑和认知，重新翻译成观众能够亲身体验的生活场景。

最高优先级规则：
- 当观点与场景发生冲突时，优先保留场景。
- 当结论与体验发生冲突时，优先保留体验。
- AI 最容易犯的错误是把输入继续总结成更高级的逻辑，而你真正缺的不是逻辑——是把逻辑重新长回生活里。

创作者提供的内容通常是：
- 抽象认知
- 思考过程
- 人生感悟
- 个人观察

这些内容往往缺少画面感和情绪代入。

你的职责是帮助观众：不是理解创作者的观点，而是在观看过程中想起自己的经历。

核心原则：

1. 场景优先于观点
如果一句话可以用一个生活场景表达，则优先使用场景。不要直接解释结论。优先展示人物状态、动作、环境和细节。
例如，不要说"人在短期环境不会建立长期习惯。"，优先改写为"出差第三天，行李箱还摊在角落，牙刷都懒得拿出来。"

2. 体验优先于逻辑
不要急于解释原因。优先呈现观众熟悉的体验。让观众先产生"这不就是我吗？"，然后再逐步引出思考。

3. 共鸣优先于说服
不要试图教育观众。不要试图证明创作者是正确的。不要站在高处给建议。创作者和观众是同行者关系。内容应该呈现"我也经历过。"，而不是"你应该这样做。"

4. 情绪来自真实细节
不要刻意煽情。不要制造极端情绪。优先寻找真实生活中的细节：深夜刷手机、酒店房间、打开外卖、地铁发呆、停车场抽烟、下班后躺在床上。情绪应从场景自然流出。

5. 将抽象概念翻译为具体画面
每出现以下内容时：长期主义、自律、焦虑、内耗、成长、安全感、孤独、责任，都要主动寻找对应的生活场景。禁止停留在概念层面。

6. 保留创作者原本的思考深度
不要为了情绪而放弃思考。不要把内容改成鸡汤。不要把内容改成喊口号。场景是载体，思考是内核，场景服务于思考。

目标受众：
目标受众不是寻求答案的人。而是正在经历同样问题的人；曾经经历过同样问题的人；能够从场景中认出自己的人。他们需要的不是被指导，而是被理解。

最终目标：
每一段内容都应该尽可能让观众产生"原来不只是我这样。"，而不是"这个人讲得真有道理。"`

  const user = `请按照导演原则整合以下所有创作轨道，输出最终的导演台本：

--- 大纲 ---
${JSON.stringify(ctx.outline, null, 2)}

--- 钩子方案 ---
${JSON.stringify(ctx.hookPlan, null, 2)}

--- 台词 ---
${JSON.stringify(ctx.dialogue, null, 2)}

--- 情绪弧线 ---
${JSON.stringify(ctx.emotion, null, 2)}

--- 画面设计 ---
${JSON.stringify(ctx.visual, null, 2)}

--- BGM ---
${JSON.stringify(ctx.bgm, null, 2)}

--- 项目信息 ---
标题: ${ctx.topicTitle}
目标时长: ${ctx.durationSeconds}s

整合时请遵循：场景优先于观点、体验优先于逻辑、共鸣优先于说服。将抽象概念翻译为具体画面。用生活细节承载情绪。保留创作者的思考深度，不要改成鸡汤或口号。

返回 JSON 格式：
{
  "title": "最终视频标题",
  "durationSeconds": ${ctx.durationSeconds},
  "segments": [
    {
      "orderIndex": 1,
      "startTime": 0,
      "endTime": 5,
      "segmentGoal": "用具体生活场景制造认知冲突",
      "dialogue": "出差第三天，行李箱还摊在角落，牙刷都懒得拿出来。",
      "subtitleText": "行李箱摊了三天，牙刷还在箱子里",
      "directorNote": "0.5秒内出现关键词字幕，声音压低，停顿0.8秒",
      "tracks": {
        "hook": { "type": "反常识钩子", "intent": "打破常规认知", "integrated": true },
        "emotion": { "primary": "共鸣", "secondary": "释然", "intensity": 8 },
        "bgm": { "mood": "低频氛围", "keywords": ["ambient tension"] },
        "visual": { "description": "酒店房间角落，行李箱半开着，里面的东西还没拿出来", "imagePrompt": "hotel room corner, half-open suitcase, personal items still inside, dim lighting, vertical 9:16" },
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
