import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateScriptSchema } from "@/lib/schemas"
import { workflowRunner } from "@/lib/workflow-runner"
import { AppError } from "@/lib/errors"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const body = await req.json()
    const input = generateScriptSchema.parse(body)

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        sourceMaterials: { orderBy: { createdAt: "desc" } },
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: "PROJECT_NOT_FOUND", message: "Project not found" },
        { status: 404 }
      )
    }

    const topicId = input.topicId || project.selectedTopicId
    if (!topicId) {
      throw AppError.topicRequired()
    }

    const topic = await prisma.topic.findFirst({
      where: { id: topicId, projectId },
    })
    if (!topic) {
      return NextResponse.json(
        { error: "TOPIC_NOT_FOUND", message: "Topic not found" },
        { status: 404 }
      )
    }

    const sourceContent = project.sourceMaterials
      .map(sm => sm.contentEncrypted || sm.contentPreview)
      .filter(Boolean)
      .join("\n\n---\n\n")

    // Load knowledge items for the selected topic
    const knowledgeItems = await prisma.knowledgeItem.findMany({
      where: { topicId },
    })

    // Build knowledge summary from knowledge_items
    let knowledgeSummary = ""
    if (knowledgeItems.length > 0) {
      const grouped: Record<string, string[]> = {}
      for (const ki of knowledgeItems) {
        if (!grouped[ki.itemType]) grouped[ki.itemType] = []
        grouped[ki.itemType].push(ki.content)
      }
      knowledgeSummary = Object.entries(grouped)
        .map(([type, items]) => `[${type}]\n${items.map(i => `- ${i}`).join("\n")}`)
        .join("\n\n")
    }

    // Also collect manual references if no knowledge items yet
    if (input.referenceMode === "manual" && input.referenceIds?.length) {
      const refs = await prisma.reference.findMany({
        where: { id: { in: input.referenceIds }, projectId },
      })
      if (refs.length > 0 && !knowledgeSummary) {
        knowledgeSummary = refs.map(r =>
          `Reference "${r.title}": ${r.transcript.slice(0, 500)}`
        ).join("\n\n")
      }
    }

    // Launch multi-agent script generation pipeline
    const { scriptVersionId, workflowRunId } = await workflowRunner.runScriptGeneration(
      projectId,
      sourceContent,
      {
        id: topic.id,
        title: topic.title,
        targetAudience: topic.targetAudience,
        coreConflict: topic.coreConflict,
        emotionalTone: topic.emotionalTone,
      },
      knowledgeSummary,
      input.durationSeconds,
      input.style,
    )

    return NextResponse.json({
      scriptVersionId,
      workflowRunId,
      status: "script_draft",
    })
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.statusCode })
    }
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: err.message },
        { status: 400 }
      )
    }
    console.error("POST scripts/generate error:", err)
    return NextResponse.json(
      { error: "GENERATION_ERROR", message: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    )
  }
}
