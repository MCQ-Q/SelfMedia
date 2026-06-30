import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { workflowRunner } from "@/lib/workflow-runner"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { sourceMaterials: { orderBy: { createdAt: "desc" } } },
    })

    if (!project) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND", message: "Project not found" }, { status: 404 })
    }

    const sourceMaterials = project.sourceMaterials.filter(sm => sm.contentEncrypted || sm.contentPreview)
    const sourceContent = sourceMaterials
      .map(sm => sm.contentEncrypted || sm.contentPreview)
      .join("\n\n---\n\n")

    if (!sourceContent) {
      return NextResponse.json({ error: "NO_SOURCE_MATERIAL", message: "No source material found" }, { status: 400 })
    }

    const archive = await workflowRunner.runObservationArchive(
      projectId,
      sourceContent,
      sourceMaterials.map(sm => sm.id),
      project.targetPlatform,
      project.videoType,
      project.durationSeconds,
    )

    return NextResponse.json({ archive }, { status: 201 })
  } catch (err) {
    console.error("POST observation-archives/generate error:", err)
    return NextResponse.json(
      { error: "ARCHIVE_GENERATION_ERROR", message: err instanceof Error ? err.message : "Archive generation failed" },
      { status: 500 }
    )
  }
}
