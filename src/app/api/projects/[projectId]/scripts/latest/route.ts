import { NextRequest, NextResponse } from "next/server"
import { workflowRunner } from "@/lib/workflow-runner"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params

    // Use raw query to find latest then load with segments
    const { prisma } = await import("@/lib/prisma")
    const scriptVersion = await prisma.scriptVersion.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        segments: {
          orderBy: { orderIndex: "asc" },
          include: { tracks: true },
        },
      },
    })

    if (!scriptVersion) {
      return NextResponse.json(
        { error: "SCRIPT_NOT_FOUND", message: "No script version found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ scriptVersion })
  } catch (err) {
    console.error("GET scripts/latest error:", err)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Failed to get script" }, { status: 500 })
  }
}
