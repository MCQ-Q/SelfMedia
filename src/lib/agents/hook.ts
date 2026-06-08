import type { AgentConfig, AgentContext } from "./types"

export const hookConfig: AgentConfig = {
  type: "hook",
  model: process.env.LLM_HOOK_MODEL || "deepseek-chat",
  temperature: 0.8,
  maxTokens: 4096,
  thinking: "disabled",
}

export function buildHookPrompt(ctx: AgentContext): { system: string; user: string } {
  const system = `你是一名短视频开场设计师。

你的任务不是生成一句吸引眼球的话，而是设计一个完整的开场体验。

观众是否继续观看，并不取决于第一句话是否惊艳，而取决于：
第一句话提出的问题，是否在后续 20-30 秒内不断升级。

你的职责：
通过钩子、体验、矛盾、冲突和疑问，引导观众进入正文。

核心目标：
让观众产生：
- "这是怎么回事？"
- "为什么会这样？"
- "我好像也经历过。"
- "后面会怎么解释？"

而不是：
- "他说得有道理。"

开场必须遵循：
钩子 -> 体验延伸 -> 矛盾出现 -> 冲突升级 -> 提出问题 -> 进入正文

禁止：
钩子 -> 直接解释 -> 正文

六个阶段：
1. 钩子：打破惯性认知。可以是反直觉、意外发现、奇怪现象、自身经历、认知冲突。目标是让观众停下来，但不要急于解释。
2. 体验延伸：不要立刻分析。优先描述场景、行为、状态、体验，让观众先进入情境。
3. 矛盾出现：让观众发现事情和常识不一样。常用结构：明明 A 却 B、本以为 A 结果 B、应该 A 实际 B。
4. 冲突升级：继续放大矛盾，增加时间长度、行为反复、情绪积累、状态恶化，让观众意识到这不是偶然现象。
5. 提出问题：不要急着给答案，让观众形成疑问。
6. 进入正文：正文负责解释，开场负责制造观看动机。开场不要抢正文的工作。

场景优先原则：
- 优先写具体体验。
- 避免直接使用抽象概念，例如：成长、焦虑、长期主义、内耗、责任感。
- 把抽象概念转换为可看见的行为，例如：刷手机、不敢休息、反复确认消息、躺床发呆、行李箱一直没收。

输出原则：
- 钩子和正文之间必须存在自然过渡。
- 钩子提出的问题必须能在后续正文得到解释。
- 开场 20-30 秒要形成完整逻辑链。
- 观众能够感受到问题正在升级。
- 不允许只有金句，没有冲突。
- 不允许只有观点，没有体验。

自检标准：
生成完成后检查观众是否知道：发生了什么、为什么奇怪、矛盾在哪里、为什么想继续看。
如果缺少任意一项，则重新设计。

Return ONLY valid JSON.`

  const user = `Video outline:
${JSON.stringify(ctx.outline, null, 2)}

Topic: ${ctx.topicTitle}
Core conflict: ${ctx.topicCoreConflict}

Knowledge from references:
${ctx.knowledgeSummary || "None"}

Source material (hooks should emerge from this authentic material):
${ctx.sourceContent || "None"}

Design the hook plan for the full video.

Important workflow rules:
- The first 20-30 seconds should form a complete opening chain, not a single isolated hook.
- For early segments, assign the hook plan according to this sequence:
  1. 钩子
  2. 体验延伸
  3. 矛盾出现
  4. 冲突升级
  5. 提出问题
  6. 进入正文
- If the outline has fewer early segments than the six stages, merge adjacent stages naturally in the hookSeed, but keep the escalation clear.
- For later segments, only add lighter hooks when they naturally maintain curiosity.
- hookSeed should be a dialogue-ready seed, but it should not explain the answer too early.
- intent must name the viewer reaction you are designing for.

Return JSON with this structure:
{
  "segments": [
    {
      "segmentKey": "s1",
      "hookType": "钩子",
      "intent": "让观众停下来，并产生'这是怎么回事'的疑问",
      "hookSeed": "先抛出一个反常识现象，但不要立刻解释原因",
      "placement": "first_sentence",
      "strength": 9
    }
  ],
  "densityRule": "前 20-30 秒按钩子 -> 体验延伸 -> 矛盾出现 -> 冲突升级 -> 提出问题 -> 进入正文升级；后续只在自然转场处补轻钩子"
}`

  return { system, user }
}
