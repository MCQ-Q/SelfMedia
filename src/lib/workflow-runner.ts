import { prisma } from "./prisma"
import { llmClient } from "./llm-client"
import { getAgentDefinition, OBSERVATION_ARCHIVE_STEPS, SCRIPT_PIPELINE_STEPS } from "./agents"
import type { AgentContext } from "./agents/types"
import type { TopicOutput, ObservationArchiveOutput, ReferenceOutput, OutlineOutput, HookPlanOutput, DialogueOutput, EmotionOutput, VisualOutput, BgmOutput, DirectorOutput, RewriteSegmentOutput } from "./schemas"

// ─── Helpers ───

function summarizeError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function computeTokenUsage(usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined) {
  return JSON.stringify(usage || {})
}

// ─── Local Workflow Runner ───

export class LocalWorkflowRunner {
  // ═══════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════

  /** Step 0: Archive source material as reusable life observation assets */
  async runObservationArchive(
    projectId: string,
    sourceContent: string,
    sourceMaterialIds: string[],
    platform: string,
    videoType: string,
    durationSeconds: number,
  ): Promise<ObservationArchiveOutput> {
    const workflowRun = await this.createWorkflowRun(projectId, "observation_archive", OBSERVATION_ARCHIVE_STEPS)
    const step = workflowRun.steps[0]

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    const ctx = {
      ...this.baseContext(projectId, workflowRun.id, sourceContent, platform, videoType, durationSeconds),
      topicTitle: project?.title || "",
    }

    const result = await this.runAgentForStep<ObservationArchiveOutput>(workflowRun.id, step.id, "observation_archive", ctx)

    await prisma.$transaction(async (tx) => {
      await tx.observationArchive.create({
        data: {
          projectId,
          sourceMaterialIds: JSON.stringify(sourceMaterialIds),
          archiveCode: result.archiveCode,
          status: "archived",
          originalLanguage: result.originalLanguage,
          summary: result.summary,
          content: JSON.stringify(result.card),
          tags: JSON.stringify(result.tags),
          futureUse: result.futureUse,
        },
      })
      await tx.workflowRun.update({
        where: { id: workflowRun.id },
        data: {
          status: "success",
          finishedAt: new Date(),
          result: JSON.stringify({ archiveCode: result.archiveCode }),
        },
      })
      await tx.project.update({
        where: { id: projectId },
        data: { currentStep: "observation_archive" },
      })
    })

    await this.emitEvent(projectId, workflowRun.id, "workflow_completed", { result: { archiveCode: result.archiveCode } })
    return result
  }
  /** Step 1: Generate topic candidates from source material */
  async runTopicGeneration(
    projectId: string,
    sourceContent: string,
    platform: string,
    videoType: string,
    durationSeconds: number,
    count: number,
  ): Promise<TopicOutput> {
    const workflowRun = await this.createWorkflowRun(projectId, "topic_generation", [
      { stepKey: "topic", dependsOn: [] },
    ])
    const step = workflowRun.steps[0]

    await prisma.project.update({
      where: { id: projectId },
      data: { status: "script_generating", currentStep: "topics" },
    })

    const ctx = this.baseContext(projectId, workflowRun.id, sourceContent, platform, videoType, durationSeconds)
    const result = await this.runAgentForStep<TopicOutput>(workflowRun.id, step.id, "topic", ctx)

    // Write topics to business table
    await prisma.$transaction(async (tx) => {
      for (const c of result.candidates) {
        await tx.topic.create({
          data: {
            projectId,
            title: c.title,
            themeSummary: result.themeSummary,
            targetAudience: c.targetAudience,
            coreConflict: c.coreConflict,
            emotionalTone: c.emotionalTone,
            score: c.score,
            reason: c.reason,
            selected: false,
          },
        })
      }
      await tx.workflowRun.update({
        where: { id: workflowRun.id },
        data: { status: "success", finishedAt: new Date(), result: JSON.stringify({ topicCount: result.candidates.length }) },
      })
    })

    await prisma.project.update({
      where: { id: projectId },
      data: { status: "topics_generated", currentStep: "topic_selection" },
    })

    await this.emitEvent(projectId, workflowRun.id, "workflow_completed", { result: { topicCount: result.candidates.length } })
    return result
  }

  /** Step 2: Analyze reference content and extract knowledge items */
  async runReferenceAnalysis(
    projectId: string,
    topicId: string,
    topicTitle: string,
    topicTargetAudience: string,
    topicCoreConflict: string,
    topicEmotionalTone: string,
    knowledgeSummary: string,
  ): Promise<ReferenceOutput> {
    const workflowRun = await this.createWorkflowRun(projectId, "reference_collection", [
      { stepKey: "reference", dependsOn: [] },
    ])
    const step = workflowRun.steps[0]

    await prisma.project.update({
      where: { id: projectId },
      data: { status: "script_generating", currentStep: "references" },
    })

    const ctx: AgentContext = {
      ...this.baseContext(projectId, workflowRun.id, "", "douyin", "oral", 60),
      topicId,
      topicTitle,
      topicTargetAudience,
      topicCoreConflict,
      topicEmotionalTone,
      knowledgeSummary,
    }

    const result = await this.runAgentForStep<ReferenceOutput>(workflowRun.id, step.id, "reference", ctx)

    // Save knowledge items
    await prisma.$transaction(async (tx) => {
      for (const item of result.knowledgeItems) {
        // Knowledge items need a referenceId; assign to first reference or create placeholder
        const refId = result.references[0]?.referenceId
        if (refId) {
          await tx.knowledgeItem.create({
            data: {
              referenceId: refId,
              topicId,
              itemType: item.itemType,
              content: item.content,
              tags: JSON.stringify(item.tags),
              confidence: item.confidence,
            },
          })
        }
      }
      await tx.workflowRun.update({
        where: { id: workflowRun.id },
        data: {
          status: "success",
          finishedAt: new Date(),
          result: JSON.stringify({ knowledgeItemCount: result.knowledgeItems.length }),
        },
      })
    })

    await prisma.project.update({
      where: { id: projectId },
      data: { status: "references_ready", currentStep: "script" },
    })

    await this.emitEvent(projectId, workflowRun.id, "workflow_completed", {
      result: { knowledgeItemCount: result.knowledgeItems.length },
    })
    return result
  }

  /** Step 3: Full script generation pipeline — 7 agents in sequence */
  async runScriptGeneration(
    projectId: string,
    sourceContent: string,
    topic: { id: string; title: string; targetAudience: string; coreConflict: string; emotionalTone: string },
    knowledgeSummary: string,
    durationSeconds: number,
    style: string,
  ): Promise<{ scriptVersionId: string; workflowRunId: string }> {
    const workflowRun = await this.createWorkflowRun(projectId, "script_generation", SCRIPT_PIPELINE_STEPS)

    const projectBefore = await prisma.project.findUnique({ where: { id: projectId } })
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "script_generating", currentStep: "script" },
    })
    await prisma.workflowRun.update({
      where: { id: workflowRun.id },
      data: {
        projectStatusBefore: projectBefore?.status || "",
        currentStepBefore: projectBefore?.currentStep || "",
      },
    })

    const ctx: AgentContext = {
      ...this.baseContext(projectId, workflowRun.id, sourceContent, "douyin", "oral", durationSeconds),
      topicId: topic.id,
      topicTitle: topic.title,
      topicTargetAudience: topic.targetAudience,
      topicCoreConflict: topic.coreConflict,
      topicEmotionalTone: topic.emotionalTone,
      knowledgeSummary,
    }

    try {
      // Run pipeline sequentially, accumulating context
      const pipelineOrder = ["outline", "hook", "dialogue", "emotion", "visual", "bgm", "director"]
      let scriptVersionId = ""

      for (const agentType of pipelineOrder) {
        const step = workflowRun.steps.find(s => s.stepKey === agentType)!
        const output = await this.runAgentForStep<Record<string, unknown>>(workflowRun.id, step.id, agentType, ctx)

        // Store output in context for downstream agents
        const key = agentType === "hook" ? "hookPlan" : agentType === "director" ? "director" : agentType
        ;(ctx as unknown as Record<string, unknown>)[key] = output

        if (agentType === "director") {
          const directorOutput = output as unknown as DirectorOutput
          scriptVersionId = await this.saveFinalScript(projectId, workflowRun.id, topic.id, directorOutput)
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.workflowRun.update({
          where: { id: workflowRun.id },
          data: {
            status: "success",
            finishedAt: new Date(),
            result: JSON.stringify({ scriptVersionId }),
          },
        })
        await tx.project.update({
          where: { id: projectId },
          data: { status: "script_draft", currentStep: "script" },
        })
      })

      await this.emitEvent(projectId, workflowRun.id, "workflow_completed", { result: { scriptVersionId } })
      return { scriptVersionId, workflowRunId: workflowRun.id }

    } catch (err) {
      await this.failWorkflow(workflowRun.id, projectId, summarizeError(err))
      throw err
    }
  }

  /** Single segment rewrite */
  async rewriteSegment(
    segmentId: string,
    rewriteTargets: string[],
    feedback: string,
    projectId: string,
  ): Promise<RewriteSegmentOutput> {
    const segment = await prisma.scriptSegment.findUnique({
      where: { id: segmentId },
      include: { scriptVersion: true },
    })
    if (!segment) throw new Error("SEGMENT_NOT_FOUND")
    if (segment.isLocked) throw new Error("SEGMENT_LOCKED")

    const workflowRun = await this.createWorkflowRun(projectId, "segment_rewrite", [
      { stepKey: "segment_rewrite", dependsOn: [] },
    ])
    const step = workflowRun.steps[0]

    const ctx: AgentContext = {
      ...this.baseContext(projectId, workflowRun.id, "", "douyin", "oral", 60),
      segmentId,
      currentDialogue: segment.dialogue,
      rewriteTargets,
      feedback,
    }

    const result = await this.runAgentForStep<RewriteSegmentOutput>(workflowRun.id, step.id, "segment_rewrite", ctx)

    // Apply rewrite to segment and tracks
    await prisma.$transaction(async (tx) => {
      const updates: Record<string, unknown> = {}
      if (result.dialogue) updates.dialogue = result.dialogue
      if (result.subtitleText) updates.subtitleText = result.subtitleText
      if (result.directorNote) updates.directorNote = result.directorNote

      if (Object.keys(updates).length > 0) {
        await tx.scriptSegment.update({ where: { id: segmentId }, data: updates })
      }

      // Update tracks
      if (result.visual) {
        await tx.segmentTrack.upsert({
          where: { id: `${segmentId}-visual` },
          update: { content: JSON.stringify(result.visual) },
          create: { id: `${segmentId}-visual`, segmentId, trackType: "visual", content: JSON.stringify(result.visual) },
        })
      }
      if (result.emotion) {
        await tx.segmentTrack.upsert({
          where: { id: `${segmentId}-emotion` },
          update: { content: JSON.stringify(result.emotion) },
          create: { id: `${segmentId}-emotion`, segmentId, trackType: "emotion", content: JSON.stringify(result.emotion) },
        })
      }
      if (result.bgm) {
        await tx.segmentTrack.upsert({
          where: { id: `${segmentId}-bgm` },
          update: { content: JSON.stringify(result.bgm) },
          create: { id: `${segmentId}-bgm`, segmentId, trackType: "bgm", content: JSON.stringify(result.bgm) },
        })
      }

      await tx.workflowRun.update({
        where: { id: workflowRun.id },
        data: { status: "success", finishedAt: new Date(), result: JSON.stringify({ segmentId }) },
      })
    })

    await this.emitEvent(projectId, workflowRun.id, "workflow_completed", { result: { segmentId } })
    return result
  }

  // ═══════════════════════════════════════════════════════════
  // Internal: Agent Execution
  // ═══════════════════════════════════════════════════════════

  private async runAgentForStep<T>(
    workflowRunId: string,
    workflowStepId: string,
    agentType: string,
    ctx: AgentContext,
  ): Promise<T> {
    const definition = await getAgentDefinition(agentType)

    // Mark step as running
    const step = await prisma.workflowStep.update({
      where: { id: workflowStepId },
      data: { status: "running", startedAt: new Date() },
    })

    // Create agent run
    const agentRun = await prisma.agentRun.create({
      data: {
        projectId: ctx.projectId,
        workflowRunId,
        workflowStepId,
        agentType,
        status: "running",
        model: definition.config.model,
        inputSnapshot: JSON.stringify(this.sanitizeContext(ctx, agentType)),
        startedAt: new Date(),
      },
    })

    await this.emitEvent(ctx.projectId, workflowRunId, "agent_started", {
      agentType,
      workflowRunId,
      runId: agentRun.id,
    })

    const startedAt = Date.now()

    try {
      const { system, user } = definition.buildPrompt(ctx)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await llmClient.generateStructured<any>({
        model: definition.config.model,
        systemPrompt: system,
        userPrompt: user,
        schema: definition.schema,
        temperature: definition.config.temperature,
      })

      const durationMs = Date.now() - startedAt

      // Save output + mark success atomically
      await prisma.$transaction(async (tx) => {
        await tx.agentOutput.create({
          data: {
            agentRunId: agentRun.id,
            outputType: this.mapOutputType(agentType),
            content: JSON.stringify(result),
            schemaVersion: "1.0",
          },
        })
        await tx.agentRun.update({
          where: { id: agentRun.id },
          data: {
            status: "success",
            finishedAt: new Date(),
            durationMs,
            outputSummary: this.makeSummary(agentType, result),
          },
        })
        await tx.workflowStep.update({
          where: { id: workflowStepId },
          data: { status: "success", finishedAt: new Date() },
        })
      })

      await this.emitEvent(ctx.projectId, workflowRunId, "agent_completed", {
        agentType,
        runId: agentRun.id,
        durationMs,
      })

      return result

    } catch (err) {
      const durationMs = Date.now() - startedAt
      const errorMsg = summarizeError(err)

      await prisma.$transaction(async (tx) => {
        await tx.agentRun.update({
          where: { id: agentRun.id },
          data: { status: "failed", finishedAt: new Date(), durationMs, errorMessage: errorMsg },
        })
        await tx.workflowStep.update({
          where: { id: workflowStepId },
          data: { status: "failed", errorMessage: errorMsg, finishedAt: new Date() },
        })
      })

      await this.emitEvent(ctx.projectId, workflowRunId, "agent_failed", {
        agentType,
        runId: agentRun.id,
        error: errorMsg,
      })

      throw err
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Internal: Persistence helpers
  // ═══════════════════════════════════════════════════════════

  private async createWorkflowRun(
    projectId: string,
    workflowType: string,
    steps: { stepKey: string; dependsOn: string[] }[],
  ) {
    return prisma.workflowRun.create({
      data: {
        projectId,
        workflowType,
        status: "running",
        startedAt: new Date(),
        input: JSON.stringify({}),
        steps: {
          create: steps.map(s => ({
            stepKey: s.stepKey,
            dependsOn: JSON.stringify(s.dependsOn),
            status: "pending",
          })),
        },
      },
      include: { steps: true },
    })
  }

  private async saveFinalScript(
    projectId: string,
    workflowRunId: string,
    topicId: string,
    output: DirectorOutput,
  ): Promise<string> {
    let scriptVersionId = ""

    await prisma.$transaction(async (tx) => {
      // Find max version number
      const latest = await tx.scriptVersion.findFirst({
        where: { projectId },
        orderBy: { versionNo: "desc" },
      })
      const versionNo = (latest?.versionNo || 0) + 1

      const sv = await tx.scriptVersion.create({
        data: {
          projectId,
          workflowRunId,
          topicId,
          versionNo,
          title: output.title,
          summary: output.segments.map(s => s.segmentGoal).join(" → "),
          totalDurationSeconds: output.durationSeconds,
          status: "draft",
          content: JSON.stringify(output),
        },
      })
      scriptVersionId = sv.id

      // Create segments and tracks
      for (const seg of output.segments) {
        const segment = await tx.scriptSegment.create({
          data: {
            scriptVersionId: sv.id,
            segmentKey: `s${seg.orderIndex}`,
            orderIndex: seg.orderIndex,
            startTime: seg.startTime,
            endTime: seg.endTime,
            segmentGoal: seg.segmentGoal,
            dialogue: seg.dialogue,
            subtitleText: seg.subtitleText,
            directorNote: this.buildDirectorNote(seg),
            isLocked: false,
          },
        })

        // Create tracks
        const tracks = seg.tracks || {}
        const trackEntries: Array<{ trackType: string; content: Record<string, unknown> }> = []
        if (tracks.hook)   trackEntries.push({ trackType: "hook", content: tracks.hook as Record<string, unknown> })
        if (tracks.emotion) trackEntries.push({ trackType: "emotion", content: tracks.emotion as Record<string, unknown> })
        if (tracks.visual)  trackEntries.push({ trackType: "visual", content: tracks.visual as Record<string, unknown> })
        if (tracks.bgm)     trackEntries.push({ trackType: "bgm", content: tracks.bgm as Record<string, unknown> })
        if (tracks.edit)    trackEntries.push({ trackType: "edit", content: tracks.edit as Record<string, unknown> })

        for (const t of trackEntries) {
          await tx.segmentTrack.create({
            data: {
              segmentId: segment.id,
              trackType: t.trackType,
              content: JSON.stringify(t.content),
            },
          })
        }
      }
    })

    return scriptVersionId
  }

  private buildDirectorNote(seg: DirectorOutput["segments"][number]): string {
    const sections: string[] = []
    const note = seg.directorNote.trim()
    if (note) sections.push(note)

    if (seg.contentValueReview) {
      sections.push([
        "内容价值审查：",
        `分区：${seg.contentValueReview.zone}`,
        `原因：${seg.contentValueReview.reason}`,
        `处理：${seg.contentValueReview.handling}`,
      ].join("\n"))
    }

    if (seg.revisionRecords.length > 0) {
      sections.push([
        "导演修改记录：",
        ...seg.revisionRecords.map(record => this.formatRevisionRecord(record)),
      ].join("\n\n"))
    }

    return sections.join("\n\n")
  }

  private formatRevisionRecord(record: DirectorOutput["segments"][number]["revisionRecords"][number]): string {
    const lines = [`【${record.action}】`]
    if (record.originalPosition) lines.push(`原位置：${record.originalPosition}`)
    if (record.newPosition) lines.push(`新位置：${record.newPosition}`)
    if (record.original) lines.push(`原台词：${record.original}`)
    if (record.revised) lines.push(`修改：${record.revised}`)
    lines.push(`原因：${record.reason}`)
    return lines.join("\n")
  }

  private async failWorkflow(workflowRunId: string, projectId: string, error: string) {
    const run = await prisma.workflowRun.findUnique({ where: { id: workflowRunId } })
    await prisma.$transaction(async (tx) => {
      await tx.workflowRun.update({
        where: { id: workflowRunId },
        data: { status: "failed", finishedAt: new Date(), errorMessage: error },
      })
      if (run?.projectStatusBefore) {
        await tx.project.update({
          where: { id: projectId },
          data: { status: run.projectStatusBefore, currentStep: run.currentStepBefore },
        })
      }
    })
    await this.emitEvent(projectId, workflowRunId, "workflow_failed", { error })
  }

  // ═══════════════════════════════════════════════════════════
  // Internal: SSE Events
  // ═══════════════════════════════════════════════════════════

  private async emitEvent(projectId: string, workflowRunId: string, eventType: string, payload: Record<string, unknown>) {
    try {
      await prisma.projectEvent.create({
        data: {
          projectId,
          workflowRunId,
          eventType,
          payload: JSON.stringify(payload),
        },
      })
    } catch (err) {
      console.error("Failed to emit event:", err)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Internal: Utilities
  // ═══════════════════════════════════════════════════════════

  private baseContext(
    projectId: string, workflowRunId: string,
    sourceContent: string, platform: string,
    videoType: string, durationSeconds: number,
  ): AgentContext {
    return {
      projectId, workflowRunId, sourceContent, platform, videoType, durationSeconds,
      topicTitle: "", topicTargetAudience: "", topicCoreConflict: "", topicEmotionalTone: "",
    }
  }

  private sanitizeContext(ctx: AgentContext, agentType: string): Record<string, unknown> {
    // Return a summary of what data feeds into this agent — useful for pipeline trace
    const inputs: string[] = []
    let sourceMaterialLen = 0

    if (ctx.sourceContent) { inputs.push("sourceMaterial"); sourceMaterialLen = ctx.sourceContent.length }
    if (ctx.topicTitle) inputs.push("topic")
    if (ctx.knowledgeSummary) inputs.push("knowledgeItems")
    if (ctx.outline) inputs.push("outline")
    if (ctx.hookPlan) inputs.push("hookPlan")
    if (ctx.dialogue) inputs.push("dialogue")
    if (ctx.emotion) inputs.push("emotion")
    if (ctx.visual) inputs.push("visual")
    if (ctx.bgm) inputs.push("bgm")

    return {
      projectId: ctx.projectId,
      agentType,
      topicTitle: ctx.topicTitle,
      platform: ctx.platform,
      durationSeconds: ctx.durationSeconds,
      inputData: inputs,
      sourceMaterialChars: sourceMaterialLen,
    }
  }

  private makeSummary(agentType: string, output: unknown): string {
    if (agentType === "observation_archive") {
      const o = output as ObservationArchiveOutput
      return `Observation archive ${o.archiveCode}: ${o.summary}`
    }
    if (agentType === "topic") {
      const o = output as TopicOutput
      return `${o.candidates.length} candidates: ${o.candidates.map(c => c.title).join("; ")}`
    }
    if (agentType === "director") {
      const o = output as DirectorOutput
      return `Script "${o.title}": ${o.segments.length} segments, ${o.durationSeconds}s`
    }
    if (agentType === "outline") {
      const o = output as OutlineOutput
      return `${o.segments.length} segments, ${o.totalDurationSeconds}s`
    }
    if (agentType === "dialogue") {
      const o = output as DialogueOutput
      return `${o.segments.length} dialogue segments`
    }
    if (agentType === "hook") {
      const o = output as HookPlanOutput
      return `${o.segments.length} hook assignments`
    }
    if (agentType === "emotion") {
      const o = output as EmotionOutput
      return `Emotional arc: ${o.emotionalArc}`
    }
    if (agentType === "visual") {
      const o = output as VisualOutput
      return `${o.segments.length} visual segments, style: ${o.visualStyle}`
    }
    if (agentType === "bgm") {
      const o = output as BgmOutput
      return `${o.segments.length} BGM assignments`
    }
    if (agentType === "reference") {
      const o = output as ReferenceOutput
      return `${o.references.length} refs analyzed, ${o.knowledgeItems.length} knowledge items`
    }
    return "OK"
  }

  private mapOutputType(agentType: string): string {
    const map: Record<string, string> = {
      topic: "topic_list",
      observation_archive: "observation_archive",
      reference: "reference_analysis",
      outline: "outline",
      hook: "hook_plan",
      dialogue: "dialogue_track",
      emotion: "emotion_track",
      visual: "visual_track",
      bgm: "bgm_track",
      director: "final_script",
      segment_rewrite: "segment_rewrite",
    }
    return map[agentType] || agentType
  }

  // ═══════════════════════════════════════════════════════════
  // Public: Query helpers for API layer
  // ═══════════════════════════════════════════════════════════

  async getWorkflowRun(workflowRunId: string) {
    return prisma.workflowRun.findUnique({
      where: { id: workflowRunId },
      include: {
        steps: {
          include: { agentRuns: { include: { outputs: true } } },
        },
      },
    })
  }

  async getCurrentWorkflow(projectId: string, workflowType: string) {
    return prisma.workflowRun.findFirst({
      where: { projectId, workflowType, status: "running" },
      include: {
        steps: {
          include: { agentRuns: { include: { outputs: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    })
  }

  async getProjectEvents(projectId: string, afterEventId?: number) {
    return prisma.projectEvent.findMany({
      where: {
        projectId,
        ...(afterEventId ? { id: { gt: afterEventId } } : {}),
      },
      orderBy: { id: "asc" },
    })
  }

  async cancelWorkflow(workflowRunId: string) {
    await prisma.$transaction(async (tx) => {
      await tx.workflowRun.update({ where: { id: workflowRunId }, data: { status: "cancelled", finishedAt: new Date() } })
      await tx.workflowStep.updateMany({
        where: { workflowRunId, status: "pending" },
        data: { status: "skipped" },
      })
      await tx.agentRun.updateMany({
        where: { workflowRunId, status: "running" },
        data: { status: "cancelled", finishedAt: new Date(), errorMessage: "Workflow cancelled" },
      })
    })
  }

  async retryWorkflowStep(workflowStepId: string) {
    const step = await prisma.workflowStep.findUnique({ where: { id: workflowStepId } })
    if (!step || step.status !== "failed") {
      throw new Error("Step is not in failed state")
    }
    return prisma.workflowStep.update({
      where: { id: workflowStepId },
      data: { status: "pending", errorMessage: null, retryCount: { increment: 1 } },
    })
  }

  async getScriptVersion(scriptVersionId: string) {
    return prisma.scriptVersion.findUnique({
      where: { id: scriptVersionId },
      include: {
        segments: {
          orderBy: { orderIndex: "asc" },
          include: { tracks: true },
        },
      },
    })
  }
}

export const workflowRunner = new LocalWorkflowRunner()


