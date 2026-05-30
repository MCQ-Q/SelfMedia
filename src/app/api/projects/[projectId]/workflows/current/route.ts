import { NextRequest, NextResponse } from "next/server"
import { workflowRunner } from "@/lib/workflow-runner"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params
  const workflowType = req.nextUrl.searchParams.get("type") || "script_generation"

  const workflow = await workflowRunner.getCurrentWorkflow(projectId, workflowType)

  if (!workflow) {
    return NextResponse.json({ workflow: null })
  }

  return NextResponse.json({ workflow })
}
