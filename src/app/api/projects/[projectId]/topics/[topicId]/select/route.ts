import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; topicId: string }> }
) {
  try {
    const { projectId, topicId } = await params

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json(
        { error: "PROJECT_NOT_FOUND", message: "Project not found" },
        { status: 404 }
      )
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

    // Clear previous selection and set new one
    await prisma.$transaction(async (tx) => {
      await tx.topic.updateMany({
        where: { projectId, selected: true },
        data: { selected: false },
      })
      await tx.topic.update({
        where: { id: topicId },
        data: { selected: true },
      })
      await tx.project.update({
        where: { id: projectId },
        data: { selectedTopicId: topicId, status: "topic_selected", currentStep: "references" },
      })
    })

    return NextResponse.json({
      projectId,
      selectedTopicId: topicId,
      status: "topic_selected",
    })
  } catch (err) {
    console.error("POST topics/select error:", err)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Failed to select topic" }, { status: 500 })
  }
}
