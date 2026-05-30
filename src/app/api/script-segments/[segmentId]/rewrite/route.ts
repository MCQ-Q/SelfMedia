import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rewriteSegmentSchema } from "@/lib/schemas"
import { workflowRunner } from "@/lib/workflow-runner"
import { AppError } from "@/lib/errors"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ segmentId: string }> }
) {
  try {
    const { segmentId } = await params
    const body = await req.json()
    const input = rewriteSegmentSchema.parse(body)

    const segment = await prisma.scriptSegment.findUnique({
      where: { id: segmentId },
      include: { scriptVersion: true },
    })

    if (!segment) {
      return NextResponse.json(
        { error: "SEGMENT_NOT_FOUND", message: "Segment not found" },
        { status: 404 }
      )
    }

    if (segment.isLocked) {
      return NextResponse.json(
        { error: "SEGMENT_LOCKED", message: "Segment is locked and cannot be rewritten" },
        { status: 409 }
      )
    }

    const result = await workflowRunner.rewriteSegment(
      segmentId,
      input.rewriteTargets,
      input.feedback || "Improve this segment",
      segment.scriptVersion.projectId,
    )

    return NextResponse.json({ segment: result })
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
    console.error("POST segment rewrite error:", err)
    return NextResponse.json(
      { error: "REWRITE_ERROR", message: err instanceof Error ? err.message : "Rewrite failed" },
      { status: 500 }
    )
  }
}
