import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; topicId: string }> }
) {
  try {
    const { projectId, topicId } = await params

    const topic = await prisma.topic.findFirst({
      where: { id: topicId, projectId },
    })
    if (!topic) {
      return NextResponse.json(
        { error: "TOPIC_NOT_FOUND", message: "Topic not found" },
        { status: 404 }
      )
    }

    const body = await req.json()

    // Whitelist updatable fields
    const allowedFields = [
      "title",
      "targetAudience",
      "coreConflict",
      "emotionalTone",
      "score",
      "reason",
    ] as const

    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field]
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "NO_VALID_FIELDS", message: "No valid fields to update" },
        { status: 400 }
      )
    }

    const updated = await prisma.topic.update({
      where: { id: topicId },
      data,
    })

    return NextResponse.json({ topic: updated })
  } catch (err) {
    console.error("PATCH topics/[topicId] error:", err)
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to update topic" },
      { status: 500 }
    )
  }
}
