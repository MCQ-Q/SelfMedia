import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })
    if (!project) {
      return NextResponse.json(
        { error: "PROJECT_NOT_FOUND", message: "Project not found" },
        { status: 404 }
      )
    }

    const topics = await prisma.topic.findMany({
      where: { projectId },
      orderBy: { score: "desc" },
    })

    return NextResponse.json({ topics })
  } catch (err) {
    console.error("GET /api/projects/[projectId]/topics error:", err)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Failed to get topics" }, { status: 500 })
  }
}
