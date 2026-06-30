import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { addSourceMaterialSchema } from "@/lib/schemas"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const body = await req.json()
    const input = addSourceMaterialSchema.parse(body)

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json(
        { error: "PROJECT_NOT_FOUND", message: "Project not found" },
        { status: 404 }
      )
    }

    const preview = input.content.slice(0, 200) + (input.content.length > 200 ? "..." : "")

    const material = await prisma.sourceMaterial.create({
      data: {
        projectId,
        type: input.type,
        contentEncrypted: input.content,
        contentPreview: preview,
        metadata: JSON.stringify(input.metadata || {}),
      },
    })

    // Update project status if still draft
    if (project.status === "draft") {
      await prisma.project.update({
        where: { id: projectId },
        data: { status: "material_input", currentStep: "topics" },
      })
    }

    return NextResponse.json({ sourceMaterial: material }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: err.message },
        { status: 400 }
      )
    }
    console.error("POST source-materials error:", err)
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to add source material" },
      { status: 500 }
    )
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params

    const materials = await prisma.sourceMaterial.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        contentPreview: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ sourceMaterials: materials })
  } catch (err) {
    console.error("GET source-materials error:", err)
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to get source materials" },
      { status: 500 }
    )
  }
}
