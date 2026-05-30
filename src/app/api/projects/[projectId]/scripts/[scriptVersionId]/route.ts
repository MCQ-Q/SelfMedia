import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { AppError } from "@/lib/errors"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; scriptVersionId: string }> }
) {
  try {
    const { projectId, scriptVersionId } = await params

    const scriptVersion = await prisma.scriptVersion.findFirst({
      where: { id: scriptVersionId, projectId },
      include: {
        segments: {
          orderBy: { orderIndex: "asc" },
          include: { tracks: true },
        },
      },
    })

    if (!scriptVersion) {
      return NextResponse.json(
        { error: "SCRIPT_NOT_FOUND", message: "Script version not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ scriptVersion })
  } catch (err) {
    console.error("GET script version error:", err)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Failed to get script" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; scriptVersionId: string }> }
) {
  try {
    const { projectId, scriptVersionId } = await params
    const body = await req.json()

    const scriptVersion = await prisma.scriptVersion.findFirst({
      where: { id: scriptVersionId, projectId },
    })

    if (!scriptVersion) {
      return NextResponse.json(
        { error: "SCRIPT_NOT_FOUND", message: "Script version not found" },
        { status: 404 }
      )
    }

    // Update segments if provided
    if (body.segments && Array.isArray(body.segments)) {
      await prisma.$transaction(async (tx) => {
        for (const seg of body.segments) {
          await tx.scriptSegment.update({
            where: { id: seg.id },
            data: {
              dialogue: seg.dialogue,
              subtitleText: seg.subtitleText,
              directorNote: seg.directorNote,
              segmentGoal: seg.segmentGoal,
              isLocked: seg.isLocked,
            },
          })
          // Update tracks if provided
          if (seg.tracks && Array.isArray(seg.tracks)) {
            for (const track of seg.tracks) {
              await tx.segmentTrack.upsert({
                where: { id: track.id || `${seg.id}-${track.trackType}` },
                update: { content: typeof track.content === "string" ? track.content : JSON.stringify(track.content) },
                create: {
                  segmentId: seg.id,
                  trackType: track.trackType,
                  content: typeof track.content === "string" ? track.content : JSON.stringify(track.content),
                },
              })
            }
          }
        }
      })
    }

    // Update script version metadata
    const updateData: Record<string, unknown> = {}
    if (body.title) updateData.title = body.title
    if (body.summary) updateData.summary = body.summary
    if (body.totalDurationSeconds) updateData.totalDurationSeconds = body.totalDurationSeconds
    if (body.status) updateData.status = body.status

    if (Object.keys(updateData).length > 0) {
      await prisma.scriptVersion.update({
        where: { id: scriptVersionId },
        data: updateData,
      })
    }

    // Return updated
    const updated = await prisma.scriptVersion.findUnique({
      where: { id: scriptVersionId },
      include: {
        segments: {
          orderBy: { orderIndex: "asc" },
          include: { tracks: true },
        },
      },
    })

    return NextResponse.json({ scriptVersion: updated })
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
    console.error("PATCH script version error:", err)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Failed to update script" }, { status: 500 })
  }
}
