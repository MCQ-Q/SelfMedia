import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateTopicsSchema } from "@/lib/schemas"
import { workflowRunner } from "@/lib/workflow-runner"
import { AppError } from "@/lib/errors"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const body = await req.json().catch(() => ({}))
    const { count } = generateTopicsSchema.parse(body)

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { sourceMaterials: { orderBy: { createdAt: "desc" } } },
    })

    if (!project) {
      return NextResponse.json(
        { error: "PROJECT_NOT_FOUND", message: "Project not found" },
        { status: 404 }
      )
    }

    // Concatenate all source materials, newest first
    const sourceContent = project.sourceMaterials
      .map(sm => sm.contentEncrypted || sm.contentPreview)
      .filter(Boolean)
      .join("\n\n---\n\n")
    if (!sourceContent) {
      return NextResponse.json(
        { error: "NO_SOURCE_MATERIAL", message: "No source material found" },
        { status: 400 }
      )
    }
    if (!sourceContent) {
      return NextResponse.json(
        { error: "NO_SOURCE_MATERIAL", message: "No source material found" },
        { status: 400 }
      )
    }

    // Delete old unselected candidate topics
    await prisma.topic.deleteMany({
      where: {
        projectId,
        id: project.selectedTopicId ? { not: project.selectedTopicId } : undefined,
      },
    })

    // Run topic generation (creates workflow_run, agent_run, agent_output, and writes topics)
    const result = await workflowRunner.runTopicGeneration(
      projectId,
      sourceContent,
      project.targetPlatform,
      project.videoType,
      project.durationSeconds,
      count
    )

    // Fetch saved topics for response
    const topics = await prisma.topic.findMany({
      where: { projectId, selected: false },
      orderBy: { score: "desc" },
      take: count,
    })

    return NextResponse.json({ topics })
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
    console.error("POST topics/generate error:", err)
    return NextResponse.json(
      { error: "GENERATION_ERROR", message: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    )
  }
}
