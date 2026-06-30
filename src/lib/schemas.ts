import { z } from "zod"

// ─── Enums ───

export const targetPlatformEnum = z.enum(["douyin", "xiaohongshu", "bilibili", "video_account"])
export const videoTypeEnum = z.enum(["oral", "story", "knowledge", "opinion"])
export const referenceModeEnum = z.enum(["none", "manual", "search"])
export const projectStatusEnum = z.enum([
  "draft", "material_input", "topics_generated", "topic_selected",
  "references_ready", "script_generating", "script_draft", "exported", "archived",
])
export const workflowTypeEnum = z.enum([
  "topic_generation", "reference_collection", "script_generation", "segment_rewrite",
])
export const stepKeyEnum = z.enum([
  "topic", "reference", "outline", "hook", "dialogue",
  "emotion", "visual", "bgm", "director", "segment_rewrite",
])
export const agentTypeEnum = stepKeyEnum
export const trackTypeEnum = z.enum(["hook", "emotion", "visual", "bgm", "edit"])

// ─── Project ───

export const sourceMaterialTypeEnum = z.enum(["chat_log", "reflection", "note", "draft"])

export const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  targetPlatform: targetPlatformEnum.default("douyin"),
  videoType: videoTypeEnum.default("oral"),
  durationSeconds: z.number().int().min(15).max(300).default(60),
  sourceMaterial: z.object({
    content: z.string().trim().min(1),
    type: sourceMaterialTypeEnum.default("note"),
  }).optional(),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>

// ─── Topic Agent ───

export const topicCandidateSchema = z.object({
  id: z.string(),
  title: z.string(),
  targetAudience: z.string(),
  coreConflict: z.string(),
  emotionalTone: z.string(),
  score: z.number().min(0).max(1),
  reason: z.string(),
})

export const topicOutputSchema = z.object({
  themeSummary: z.string(),
  candidates: z.array(topicCandidateSchema).min(1).max(5),
  uncertaintyNotes: z.string().optional(),
})

export type TopicOutput = z.infer<typeof topicOutputSchema>
export type TopicCandidate = z.infer<typeof topicCandidateSchema>

export const generateTopicsSchema = z.object({
  count: z.number().int().min(1).max(5).default(5),
})

// ─── Reference Analysis Agent ───

export const referenceAnalysisSchema = z.object({
  analysis: z.object({
    hookPattern: z.string(),
    narrativeStructure: z.string(),
    emotionalArc: z.array(z.string()),
    visualStyle: z.string(),
    commentInsights: z.array(z.string()),
  }).optional(),
})

export const knowledgeItemSchema = z.object({
  itemType: z.enum(["hook", "structure", "emotion", "visual", "comment_insight", "bgm"]),
  content: z.string(),
  tags: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.8),
})

export const referenceOutputSchema = z.object({
  references: z.array(z.object({
    referenceId: z.string().optional(),
    sourceType: z.string(),
    platform: z.string().optional(),
    title: z.string(),
    url: z.string().optional(),
    transcript: z.string().optional(),
    metrics: z.record(z.string(), z.unknown()).optional(),
    analysis: referenceAnalysisSchema.shape.analysis,
  })),
  knowledgeItems: z.array(knowledgeItemSchema),
})

export type ReferenceOutput = z.infer<typeof referenceOutputSchema>
export type KnowledgeItem = z.infer<typeof knowledgeItemSchema>

// ─── Outline Agent (Video Framework) ───

export const outlineSegmentSchema = z.object({
  segmentKey: z.string(),
  orderIndex: z.number().int(),
  startTime: z.number().min(0),
  endTime: z.number(),
  goal: z.string(),
  coreInfo: z.string(),
  intensityLevel: z.number().int().min(1).max(10),
})

export const outlineSchema = z.object({
  totalDurationSeconds: z.number().int().min(15).max(300),
  summary: z.string(),
  segments: z.array(outlineSegmentSchema).min(3),
  climaxPosition: z.string().optional(),
  endingAction: z.string().optional(),
})

export type OutlineOutput = z.infer<typeof outlineSchema>
export type OutlineSegment = z.infer<typeof outlineSegmentSchema>

// ─── Hook Plan Agent ───

export const hookPlanSegmentSchema = z.object({
  segmentKey: z.string(),
  hookType: z.string(),
  intent: z.string(),
  hookSeed: z.string(),
  placement: z.enum(["first_sentence", "opening_question", "mid_segment", "closing"]),
  strength: z.number().int().min(1).max(10),
})

export const hookPlanSchema = z.object({
  segments: z.array(hookPlanSegmentSchema),
  densityRule: z.string(),
})

export type HookPlanOutput = z.infer<typeof hookPlanSchema>

// ─── Dialogue Agent ───

export const dialogueSegmentSchema = z.object({
  segmentKey: z.string(),
  dialogue: z.string(),
  tone: z.string(),
  pauseAfter: z.number().min(0).default(0.5),
  emphasisWords: z.array(z.string()).default([]),
  subtitleText: z.string(),
  colloquialScore: z.number().min(0).max(1).optional(),
})

export const dialogueOutputSchema = z.object({
  segments: z.array(dialogueSegmentSchema),
  globalNotes: z.object({
    averageSentenceLength: z.number().optional(),
    hookIntegrationQuality: z.string().optional(),
  }).optional(),
})

export type DialogueOutput = z.infer<typeof dialogueOutputSchema>

// ─── Emotion Agent ───

export const emotionSegmentSchema = z.object({
  segmentKey: z.string(),
  primaryEmotion: z.string(),
  secondaryEmotion: z.string().optional(),
  intensity: z.number().int().min(1).max(10),
  direction: z.enum(["up", "down", "steady"]),
  viewerReaction: z.string(),
  valence: z.enum(["positive", "negative", "neutral"]),
  arousal: z.enum(["high", "medium", "low"]),
})

export const emotionOutputSchema = z.object({
  emotionalArc: z.string(),
  segments: z.array(emotionSegmentSchema),
})

export type EmotionOutput = z.infer<typeof emotionOutputSchema>

// ─── Visual Agent ───

export const visualSegmentSchema = z.object({
  segmentKey: z.string(),
  visualDescription: z.string(),
  shotType: z.string(),
  cameraMovement: z.string(),
  imagePrompt: z.string(),
  videoPrompt: z.string().optional(),
  subtitleLayout: z.string(),
  transitionTo: z.string(),
})

export const visualOutputSchema = z.object({
  segments: z.array(visualSegmentSchema),
  visualStyle: z.string(),
})

export type VisualOutput = z.infer<typeof visualOutputSchema>

// ─── BGM Agent ───

export const bgmSegmentSchema = z.object({
  segmentKey: z.string(),
  bgmMood: z.string(),
  bpmRange: z.string(),
  instrumentPreference: z.array(z.string()).default([]),
  volumeCurve: z.string(),
  soundEffect: z.object({
    type: z.string(),
    timing: z.string(),
    purpose: z.string(),
  }).optional(),
  searchKeywords: z.array(z.string()).default([]),
})

export const bgmOutputSchema = z.object({
  segments: z.array(bgmSegmentSchema),
  copyrightNote: z.string(),
})

export type BgmOutput = z.infer<typeof bgmOutputSchema>

// ─── Director Agent ───

export const directorTrackSchema = z.object({
  hook: z.object({
    type: z.string(),
    intent: z.string(),
    integrated: z.boolean(),
  }).optional(),
  emotion: z.object({
    primary: z.string(),
    secondary: z.string().optional(),
    intensity: z.number().int().min(1).max(10),
  }).optional(),
  bgm: z.object({
    mood: z.string(),
    keywords: z.array(z.string()).default([]),
  }).optional(),
  visual: z.object({
    description: z.string(),
    imagePrompt: z.string(),
    videoPrompt: z.string().optional(),
  }).optional(),
  edit: z.object({
    transitionIn: z.string(),
    transitionOut: z.string(),
    subtitleStyle: z.string(),
  }).optional(),
})

export const directorSegmentSchema = z.object({
  orderIndex: z.number().int(),
  startTime: z.number().min(0),
  endTime: z.number(),
  segmentGoal: z.string(),
  dialogue: z.string(),
  subtitleText: z.string(),
  directorNote: z.string(),
  contentValueReview: z.object({
    zone: z.enum(["A_甜点区", "B_中性区", "C_无效区"]),
    reason: z.string(),
    handling: z.string(),
  }).optional(),
  revisionRecords: z.array(z.object({
    action: z.string(),
    original: z.string().optional(),
    revised: z.string().optional(),
    originalPosition: z.string().optional(),
    newPosition: z.string().optional(),
    reason: z.string(),
  })).default([]),
  tracks: directorTrackSchema,
})

export const directorOutputSchema = z.object({
  title: z.string(),
  durationSeconds: z.number().int(),
  segments: z.array(directorSegmentSchema),
  qualityChecklist: z.object({
    openingHook: z.string(),
    hookDialogueIntegration: z.string(),
    openingEscalation: z.string().optional(),
    sweetSpotReview: z.string().optional(),
    resonancePriority: z.string().optional(),
    emotionVariety: z.string(),
    visualExecutable: z.string(),
    bgmEmotionMatch: z.string(),
  }).optional(),
})

export type DirectorOutput = z.infer<typeof directorOutputSchema>

// ─── Segment Rewrite Agent ───

export const rewriteSegmentOutputSchema = z.object({
  segmentKey: z.string().optional(),
  dialogue: z.string().optional(),
  subtitleText: z.string().optional(),
  tone: z.string().optional(),
  directorNote: z.string().optional(),
  visual: z.object({
    description: z.string().optional(),
    imagePrompt: z.string().optional(),
    videoPrompt: z.string().optional(),
  }).optional(),
  emotion: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    intensity: z.number().int().min(1).max(10).optional(),
  }).optional(),
  bgm: z.object({
    mood: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  }).optional(),
})

export type RewriteSegmentOutput = z.infer<typeof rewriteSegmentOutputSchema>

// ─── API Input Schemas ───

export const manualReferenceItemSchema = z.object({
  title: z.string().optional(),
  url: z.string().url().optional().or(z.literal("")),
  author: z.string().optional(),
  transcript: z.string().trim().min(1),
  metrics: z.record(z.string(), z.unknown()).optional(),
  rawData: z.record(z.string(), z.unknown()).optional(),
})

// ─── Douyin Extract ───

export const douyinExtractRequestSchema = z.object({
  url: z.string().trim().min(1, "请提供抖音链接"),
})

export type DouyinExtractRequest = z.infer<typeof douyinExtractRequestSchema>

export const manualReferenceSchema = z.object({
  topicId: z.string().optional(),
  items: z.array(manualReferenceItemSchema).min(1),
})

export const generateScriptSchema = z.object({
  topicId: z.string().optional(),
  referenceMode: referenceModeEnum.default("none"),
  referenceIds: z.array(z.string()).optional(),
  durationSeconds: z.number().int().min(15).max(300).default(60),
  style: z.string().default("sharp_emotional_oral"),
})

export const addSourceMaterialSchema = z.object({
  content: z.string().trim().min(1, "Source material content is required"),
  type: sourceMaterialTypeEnum.default("note"),
  metadata: z.object({
    sourceUrl: z.string().url().optional(),
    sourcePlatform: z.string().optional(),
    sourceAuthor: z.string().optional(),
    douyinRawData: z.record(z.string(), z.unknown()).optional(),
  }).optional().default({}),
})

export const rewriteSegmentSchema = z.object({
  rewriteTargets: z.array(
    z.enum(["dialogue", "visual", "emotion", "bgm"])
  ).min(1),
  feedback: z.string().optional(),
})

// ─── Export schemas (for backward compat) ───

export const hookSchema = z.object({
  type: z.string(),
  intent: z.string(),
})

export const emotionSchema = z.object({
  primary: z.string(),
  intensity: z.number().int().min(1).max(10),
})

export const visualSchema = z.object({
  description: z.string(),
  imagePrompt: z.string().optional(),
})

export const bgmSchema = z.object({
  mood: z.string(),
  keywords: z.array(z.string()).optional(),
})

export const segmentSchema = z.object({
  orderIndex: z.number().int().min(1),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  segmentGoal: z.string(),
  dialogue: z.string().min(1),
  subtitleText: z.string(),
  hook: hookSchema.optional(),
  emotion: emotionSchema,
  visual: visualSchema,
  bgm: bgmSchema.optional(),
  directorNote: z.string(),
})

export const scriptContentSchema = z.object({
  title: z.string().min(1),
  durationSeconds: z.number().int().min(15).max(300),
  summary: z.string(),
  segments: z.array(segmentSchema),
})

export type ScriptContent = z.infer<typeof scriptContentSchema>

// ─── Validation ───

export function validateScriptContent(content: unknown): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  const parsed = scriptContentSchema.safeParse(content)
  if (!parsed.success) {
    return { valid: false, errors: parsed.error.issues.map((e: { message: string }) => e.message) }
  }
  const script = parsed.data
  const segments = script.segments
  if (segments.length < 3) {
    errors.push(`Expected at least 3 segments, got ${segments.length}`)
  }
  if (segments[0] && segments[0].startTime !== 0) {
    errors.push("First segment must start at 0")
  }
  let lastEnd = 0
  for (const seg of segments) {
    if (seg.endTime <= seg.startTime) {
      errors.push(`Segment ${seg.orderIndex}: endTime must be > startTime`)
    }
    if (seg.startTime < lastEnd) {
      errors.push(`Segment ${seg.orderIndex}: overlaps previous`)
    }
    lastEnd = seg.endTime
  }
  return { valid: errors.length === 0, errors }
}
