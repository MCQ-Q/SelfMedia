import { NextRequest, NextResponse } from "next/server"
import { extractDouyinInfo } from "@/lib/douyin-extractor"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const url = typeof body.url === "string" ? body.url.trim() : ""

    if (!url) {
      return NextResponse.json(
        { success: false, error: "MISSING_URL", message: "请提供抖音链接" },
        { status: 400 }
      )
    }

    const data = await extractDouyinInfo(url)

    const hasEssentialData = !!(data.title || data.description)
    return NextResponse.json({
      success: hasEssentialData,
      data,
    })
  } catch (err) {
    console.error("POST /api/extract/douyin error:", err)
    return NextResponse.json(
      {
        success: false,
        error: "EXTRACTION_ERROR",
        message: err instanceof Error ? err.message : "提取失败",
        data: {
          resolvedUrl: "",
          title: null,
          description: null,
          author: null,
          authorId: null,
          coverUrl: null,
          hashtags: [],
          tags: [],
          durationMs: 0,
          metrics: {},
          formattedContent: "",
          extractionMethod: "web_api",
          warnings: ["服务器内部错误，请稍后重试"],
        } as const,
      },
      { status: 500 }
    )
  }
}
