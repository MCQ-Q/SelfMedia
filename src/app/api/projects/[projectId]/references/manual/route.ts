import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { manualReferenceSchema } from "@/lib/schemas"
import { AppError } from "@/lib/errors"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const body = await req.json()
    const input = manualReferenceSchema.parse(body)

    const project = await prisma.project.findUnique({ where: { id: projectId } })
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

    const referenceIds: string[] = []
    for (const item of input.items) {
      const ref = await prisma.reference.create({
        data: {
          projectId,
          topicId,
          title: item.title || `手动参考 ${referenceIds.length + 1}`,
          url: item.url || null,
          transcript: item.transcript,
        },
      })
      referenceIds.push(ref.id)
    }

    return NextResponse.json({ referenceIds })
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
    console.error("POST references/manual error:", err)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Failed to save references" }, { status: 500 })
  }
}
