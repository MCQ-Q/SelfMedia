import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

const updateArchiveSchema = z.object({
  status: z.enum(["archived", "confirmed", "ignored"]),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; archiveId: string }> }
) {
  try {
    const { projectId, archiveId } = await params
    const { status } = updateArchiveSchema.parse(await req.json())

    const existing = await prisma.observationArchive.findFirst({
      where: { id: archiveId, projectId },
    })

    if (!existing) {
      return NextResponse.json({ error: "ARCHIVE_NOT_FOUND", message: "Archive not found" }, { status: 404 })
    }

    const archive = await prisma.observationArchive.update({
      where: { id: archiveId },
      data: { status },
    })

    return NextResponse.json({ archive })
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: err.message }, { status: 400 })
    }
    console.error("PATCH observation archive error:", err)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Failed to update archive" }, { status: 500 })
  }
}

