import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const archives = await prisma.observationArchive.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      archives: archives.map(archive => ({
        ...archive,
        sourceMaterialIds: JSON.parse(archive.sourceMaterialIds || "[]"),
        tags: JSON.parse(archive.tags || "[]"),
        content: JSON.parse(archive.content || "{}"),
      })),
    })
  } catch (err) {
    console.error("GET observation-archives error:", err)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Failed to get observation archives" }, { status: 500 })
  }
}
