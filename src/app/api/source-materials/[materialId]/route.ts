import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ materialId: string }> }
) {
  try {
    const { materialId } = await params

    const material = await prisma.sourceMaterial.findUnique({
      where: { id: materialId },
      select: {
        id: true,
        projectId: true,
        type: true,
        contentEncrypted: true,
        contentPreview: true,
        createdAt: true,
      },
    })

    if (!material) {
      return NextResponse.json(
        { error: "MATERIAL_NOT_FOUND", message: "Source material not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ sourceMaterial: material })
  } catch (err) {
    console.error("GET source-material error:", err)
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to get source material" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ materialId: string }> }
) {
  try {
    const { materialId } = await params

    const material = await prisma.sourceMaterial.findUnique({
      where: { id: materialId },
    })

    if (!material) {
      return NextResponse.json(
        { error: "MATERIAL_NOT_FOUND", message: "Source material not found" },
        { status: 404 }
      )
    }

    await prisma.sourceMaterial.delete({ where: { id: materialId } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE source-material error:", err)
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to delete source material" },
      { status: 500 }
    )
  }
}
