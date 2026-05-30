import { NextRequest, NextResponse } from "next/server"
import { workflowRunner } from "@/lib/workflow-runner"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params

  const lastEventId = req.headers.get("Last-Event-ID")
    ? parseInt(req.headers.get("Last-Event-ID")!, 10)
    : undefined

  const events = await workflowRunner.getProjectEvents(projectId, lastEventId)

  // Build SSE response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      // Send catch-up events
      for (const event of events) {
        const line = `id: ${event.id}\nevent: ${event.eventType}\ndata: ${event.payload}\n\n`
        controller.enqueue(encoder.encode(line))
      }

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"))
      }, 15000)

      // Poll for new events (SQLite doesn't support LISTEN/NOTIFY)
      let lastId = events.length > 0 ? events[events.length - 1].id : (lastEventId || 0)
      const poll = setInterval(async () => {
        try {
          const newEvents = await workflowRunner.getProjectEvents(projectId, lastId)
          for (const event of newEvents) {
            const line = `id: ${event.id}\nevent: ${event.eventType}\ndata: ${event.payload}\n\n`
            controller.enqueue(encoder.encode(line))
            lastId = event.id
          }
        } catch {
          // Silently ignore poll errors
        }
      }, 2000)

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat)
        clearInterval(poll)
        controller.close()
      })
    },
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
