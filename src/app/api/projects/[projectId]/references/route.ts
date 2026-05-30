import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params

    const references = await prisma.reference.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ references })
  } catch (err) {
    console.error("GET references error:", err)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Failed to get references" }, { status: 500 })
  }
}
