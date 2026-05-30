import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { renderMarkdownFromSegments, renderMarkdown } from "@/lib/markdown-exporter"
import type { ScriptVersionWithSegments, SegmentWithTracks } from "@/lib/markdown-exporter"

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

    let markdown: string

    // Use segment-based export if segments exist, otherwise fall back to content JSON
    if (scriptVersion.segments.length > 0) {
      const sv: ScriptVersionWithSegments = {
        id: scriptVersion.id,
        title: scriptVersion.title,
        summary: scriptVersion.summary,
        totalDurationSeconds: scriptVersion.totalDurationSeconds,
        versionNo: scriptVersion.versionNo,
        status: scriptVersion.status,
        createdAt: scriptVersion.createdAt,
        segments: scriptVersion.segments.map(seg => ({
          id: seg.id,
          orderIndex: seg.orderIndex,
          startTime: seg.startTime,
          endTime: seg.endTime,
          segmentGoal: seg.segmentGoal,
          dialogue: seg.dialogue,
          subtitleText: seg.subtitleText,
          directorNote: seg.directorNote,
          isLocked: seg.isLocked,
          tracks: seg.tracks.map(t => ({
            trackType: t.trackType,
            content: t.content,
          })),
        })),
      }
      markdown = renderMarkdownFromSegments(sv)
    } else {
      // Fallback: parse content JSON
      const content = JSON.parse(scriptVersion.content)
      markdown = renderMarkdown(content)
    }

    // Mark as exported
    if (scriptVersion.status !== "exported") {
      await prisma.$transaction(async (tx) => {
        await tx.scriptVersion.update({
          where: { id: scriptVersionId },
          data: { status: "exported" },
        })
        const project = await tx.project.findUnique({ where: { id: projectId } })
        if (project && project.status !== "exported") {
          await tx.project.update({
            where: { id: projectId },
            data: { status: "exported", currentStep: "exported" },
          })
        }
      })
    }

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(scriptVersion.title)}.md"`,
      },
    })
  } catch (err) {
    console.error("GET export.md error:", err)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Failed to export markdown" }, { status: 500 })
  }
}
