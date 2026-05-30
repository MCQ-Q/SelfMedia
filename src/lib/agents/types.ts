import type { ZodSchema } from "zod"

export interface AgentConfig {
  type: string
  model: string
  temperature: number
  maxTokens: number
  thinking: "enabled" | "disabled"
  reasoningEffort?: "high" | "max"
}

export interface AgentContext {
  projectId: string
  workflowRunId: string
  sourceContent: string
  platform: string
  videoType: string
  durationSeconds: number
  topicTitle: string
  topicTargetAudience: string
  topicCoreConflict: string
  topicEmotionalTone: string
  // Populated progressively during the pipeline
  topicId?: string
  referenceIds?: string[]
  knowledgeSummary?: string
  outline?: Record<string, unknown>
  hookPlan?: Record<string, unknown>
  dialogue?: Record<string, unknown>
  emotion?: Record<string, unknown>
  visual?: Record<string, unknown>
  bgm?: Record<string, unknown>
  // For segment rewrite
  segmentId?: string
  currentDialogue?: string
  rewriteTargets?: string[]
  feedback?: string
  // Model override
  model?: string
}

export function defaultAgentContext(): Partial<AgentContext> {
  return {
    sourceContent: "",
    platform: "douyin",
    videoType: "oral",
    durationSeconds: 60,
    topicTitle: "",
    topicTargetAudience: "",
    topicCoreConflict: "",
    topicEmotionalTone: "",
  }
}
