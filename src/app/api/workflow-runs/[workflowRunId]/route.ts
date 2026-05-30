import { NextRequest, NextResponse } from "next/server"
import { workflowRunner } from "@/lib/workflow-runner"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workflowRunId: string }> }
) {
  const { workflowRunId } = await params

  const workflow = await workflowRunner.getWorkflowRun(workflowRunId)

  if (!workflow) {
    return NextResponse.json(
      { error: "WORKFLOW_NOT_FOUND", message: "Workflow run not found" },
      { status: 404 }
    )
  }

  return NextResponse.json({ workflow })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workflowRunId: string }> }
) {
  const { workflowRunId } = await params
  const body = await req.json().catch(() => ({}))

  if (body.action === "cancel") {
    await workflowRunner.cancelWorkflow(workflowRunId)
    return NextResponse.json({ status: "cancelled" })
  }

  return NextResponse.json(
    { error: "INVALID_ACTION", message: "Supported actions: cancel" },
    { status: 400 }
  )
}
