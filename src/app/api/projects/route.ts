import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createProjectSchema } from "@/lib/schemas"
import { AppError } from "@/lib/errors"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = createProjectSchema.parse(body)

    const hasSourceMaterial = input.sourceMaterial?.content?.trim()

    const project = await prisma.project.create({
      data: {
        title: input.title,
        targetPlatform: input.targetPlatform,
        videoType: input.videoType,
        durationSeconds: input.durationSeconds,
        status: hasSourceMaterial ? "material_input" : "draft",
        currentStep: hasSourceMaterial ? "topics" : "input",
        ...(hasSourceMaterial
          ? {
              sourceMaterials: {
                create: {
                  type: input.sourceMaterial!.type || "note",
                  contentEncrypted: input.sourceMaterial!.content,
                  contentPreview: input.sourceMaterial!.content.slice(0, 200) + (input.sourceMaterial!.content.length > 200 ? "..." : ""),
                },
              },
            }
          : {}),
      },
      include: { sourceMaterials: true },
    })

    return NextResponse.json({
      projectId: project.id,
      status: project.status,
    })
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
    console.error("POST /api/projects error:", err)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Failed to create project" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        currentStep: true,
        targetPlatform: true,
        videoType: true,
        durationSeconds: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ projects })
  } catch (err) {
    console.error("GET /api/projects error:", err)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Failed to list projects" }, { status: 500 })
  }
}
