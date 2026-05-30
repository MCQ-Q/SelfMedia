import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { AppError } from "@/lib/errors"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        sourceMaterials: { orderBy: { createdAt: "desc" } },
        topics: { orderBy: { score: "desc" }, include: { knowledgeItems: true } },
        references: true,
        scriptVersions: { take: 1, orderBy: { createdAt: "desc" }, include: { segments: { include: { tracks: true }, orderBy: { orderIndex: "asc" } } } },
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: "PROJECT_NOT_FOUND", message: "Project not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ project })
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.statusCode })
    }
    console.error("GET /api/projects/[projectId] error:", err)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Failed to get project" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params

    const project = await prisma.project.findUnique({ where: { id: projectId } })

    if (!project) {
      return NextResponse.json(
        { error: "PROJECT_NOT_FOUND", message: "Project not found" },
        { status: 404 }
      )
    }

    // Cancel any running workflows first
    const runningWorkflows = await prisma.workflowRun.findMany({
      where: { projectId, status: "running" },
    })
    for (const wf of runningWorkflows) {
      await prisma.workflowRun.update({
        where: { id: wf.id },
        data: { status: "cancelled", finishedAt: new Date() },
      })
    }

    await prisma.project.delete({ where: { id: projectId } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/projects/[projectId] error:", err)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Failed to delete project" }, { status: 500 })
  }
}
