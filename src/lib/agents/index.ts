import type { AgentConfig, AgentContext } from "./types"
import type { z, ZodSchema } from "zod"
import {
  topicOutputSchema, referenceOutputSchema, outlineSchema, hookPlanSchema,
  dialogueOutputSchema, emotionOutputSchema, visualOutputSchema, bgmOutputSchema,
  directorOutputSchema, rewriteSegmentOutputSchema,
} from "../schemas"

export type { AgentConfig, AgentContext } from "./types"

export interface AgentDefinition {
  config: AgentConfig
  buildPrompt: (ctx: AgentContext) => { system: string; user: string }
  schema: ZodSchema  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}

// Lazy imports to avoid circular deps
const agentModules: Record<string, () => Promise<{ config: AgentConfig; buildPrompt: (ctx: AgentContext) => { system: string; user: string } }>> = {
  topic:       () => import("./topic").then(m => ({ config: m.topicConfig, buildPrompt: m.buildTopicPrompt })),
  reference:   () => import("./reference").then(m => ({ config: m.referenceConfig, buildPrompt: m.buildReferencePrompt })),
  outline:     () => import("./outline").then(m => ({ config: m.outlineConfig, buildPrompt: m.buildOutlinePrompt })),
  hook:        () => import("./hook").then(m => ({ config: m.hookConfig, buildPrompt: m.buildHookPrompt })),
  dialogue:    () => import("./dialogue").then(m => ({ config: m.dialogueConfig, buildPrompt: m.buildDialoguePrompt })),
  emotion:     () => import("./emotion").then(m => ({ config: m.emotionConfig, buildPrompt: m.buildEmotionPrompt })),
  visual:      () => import("./visual").then(m => ({ config: m.visualConfig, buildPrompt: m.buildVisualPrompt })),
  bgm:         () => import("./bgm").then(m => ({ config: m.bgmConfig, buildPrompt: m.buildBgmPrompt })),
  director:    () => import("./director").then(m => ({ config: m.directorConfig, buildPrompt: m.buildDirectorPrompt })),
  segment_rewrite: () => import("./segment-rewrite").then(m => ({ config: m.segmentRewriteConfig, buildPrompt: m.buildSegmentRewritePrompt })),
}

const agentSchemas: Record<string, ZodSchema> = {
  topic:            topicOutputSchema,
  reference:        referenceOutputSchema,
  outline:          outlineSchema,
  hook:             hookPlanSchema,
  dialogue:         dialogueOutputSchema,
  emotion:          emotionOutputSchema,
  visual:           visualOutputSchema,
  bgm:              bgmOutputSchema,
  director:         directorOutputSchema,
  segment_rewrite:  rewriteSegmentOutputSchema,
}

export async function getAgentDefinition(agentType: string): Promise<AgentDefinition> {
  const loader = agentModules[agentType]
  if (!loader) {
    throw new Error(`Unknown agent type: ${agentType}`)
  }
  const { config, buildPrompt } = await loader()
  const schema = agentSchemas[agentType]
  if (!schema) {
    throw new Error(`No schema registered for agent type: ${agentType}`)
  }
  return { config, buildPrompt, schema }
}

export function getAgentSchema(agentType: string): ZodSchema {
  const schema = agentSchemas[agentType]
  if (!schema) throw new Error(`No schema registered for agent type: ${agentType}`)
  return schema
}

export function listAgentTypes(): string[] {
  return Object.keys(agentModules)
}

// ─── Pipeline step definitions ───

export const SCRIPT_PIPELINE_STEPS = [
  { stepKey: "outline",  dependsOn: [] as string[] },
  { stepKey: "hook",     dependsOn: ["outline"] },
  { stepKey: "dialogue", dependsOn: ["hook"] },
  { stepKey: "emotion",  dependsOn: ["outline"] },
  { stepKey: "visual",   dependsOn: ["dialogue"] },
  { stepKey: "bgm",      dependsOn: ["emotion"] },
  { stepKey: "director", dependsOn: ["outline", "hook", "dialogue", "emotion", "visual", "bgm"] },
]

export const TOPIC_PIPELINE_STEPS = [
  { stepKey: "topic", dependsOn: [] as string[] },
]

export const REFERENCE_PIPELINE_STEPS = [
  { stepKey: "reference", dependsOn: [] as string[] },
]

export const REWRITE_PIPELINE_STEPS = [
  { stepKey: "segment_rewrite", dependsOn: [] as string[] },
]
