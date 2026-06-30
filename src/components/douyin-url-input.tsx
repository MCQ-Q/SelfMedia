"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, Link2, CheckCircle2, AlertTriangle, XCircle, Edit3 } from "lucide-react"

// ─── Types ───

export interface DouyinExtractData {
  resolvedUrl: string
  title: string | null
  description: string | null
  author: string | null
  authorId: string | null
  coverUrl: string | null
  hashtags: string[]
  tags: string[]
  durationMs: number
  metrics: Record<string, number>
  formattedContent: string
  extractionMethod: "web_api" | "third_party_api"
  warnings: string[]
}

export interface DouyinExtractResponse {
  success: boolean
  data: DouyinExtractData
  error?: string
  message?: string
}

export interface ConfirmedDouyinData {
  title: string
  description: string
  author: string
  url: string
  metrics: Record<string, number>
  rawData: DouyinExtractData
}

type ExtractState = "idle" | "extracting" | "extracted" | "partial" | "failed"

interface DouyinUrlInputProps {
  onConfirm: (data: ConfirmedDouyinData) => void
  onCancel: () => void
}

// ─── Component ───

function formatMetric(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + "万"
  if (n >= 1000) return (n / 1000).toFixed(1) + "k"
  return String(n)
}

export function DouyinUrlInput({ onConfirm, onCancel }: DouyinUrlInputProps) {
  const [url, setUrl] = useState("")
  const [state, setState] = useState<ExtractState>("idle")
  const [extractData, setExtractData] = useState<DouyinExtractData | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [editedDescription, setEditedDescription] = useState("")

  const handleExtract = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    setState("extracting")
    setErrorMessage("")
    setExtractData(null)

    try {
      const res = await fetch("/api/extract/douyin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      })
      const json: DouyinExtractResponse = await res.json()

      if (!res.ok || (!json.success && !json.data?.title && !json.data?.description)) {
        setState("failed")
        setErrorMessage(json.message || json.data?.warnings?.[0] || "提取失败，请检查链接后重试")
        setExtractData(json.data || null)
        return
      }

      setExtractData(json.data)

      if (json.data.warnings.length > 0 && (!json.data.title || !json.data.description)) {
        setState("partial")
        setEditedDescription(json.data.description || "")
      } else {
        setState("extracted")
      }
    } catch {
      setState("failed")
      setErrorMessage("网络错误，请检查网络后重试")
    }
  }, [url])

  const handleConfirm = useCallback(() => {
    if (!extractData) return
    onConfirm({
      title: extractData.title || "抖音视频",
      description: editedDescription || extractData.formattedContent || extractData.description || "",
      author: extractData.author || "",
      url: extractData.resolvedUrl || url,
      metrics: extractData.metrics || {},
      rawData: extractData,
    })
    // Reset
    setUrl("")
    setState("idle")
    setExtractData(null)
    setEditedDescription("")
  }, [extractData, editedDescription, url, onConfirm])

  const handleRetry = useCallback(() => {
    setState("idle")
    setExtractData(null)
    setErrorMessage("")
    setEditedDescription("")
  }, [])

  // ─── Render: Idle ───

  if (state === "idle") {
    return (
      <div className="space-y-3 p-4 rounded-lg border border-dashed">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link2 className="w-4 h-4" />
          粘贴抖音分享链接，自动提取视频标题和文案
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="https://v.douyin.com/xxxxx/"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={(e) => {
              // Detect douyin URL on paste and auto-extract
              const text = e.clipboardData.getData("text")
              if (/douyin\.com/i.test(text)) {
                // Let the state update, then auto-extract in next tick
                setTimeout(() => {
                  setUrl(text)
                  // We need to trigger extract after state is set
                }, 0)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleExtract()
            }}
            className="flex-1"
          />
          <Button onClick={handleExtract} disabled={!url.trim()} variant="secondary" size="sm">
            提取
          </Button>
          <Button onClick={onCancel} variant="ghost" size="sm">
            取消
          </Button>
        </div>
      </div>
    )
  }

  // ─── Render: Extracting ───

  if (state === "extracting") {
    return (
      <div className="space-y-3 p-4 rounded-lg border border-dashed">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-muted-foreground">正在提取抖音视频信息...</span>
        </div>
        <p className="text-xs text-muted-foreground break-all">链接: {url}</p>
      </div>
    )
  }

  // ─── Render: Extracted (full success) ───

  if (state === "extracted" && extractData) {
    const hasMeta =
      extractData.tags.length > 0 ||
      extractData.hashtags.length > 0 ||
      Object.keys(extractData.metrics).length > 0

    return (
      <div className="space-y-3 p-4 rounded-lg border border-green-200 bg-green-50/30">
        <div className="flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4" />
          提取成功
          <Badge variant="outline" className="text-xs">
            {extractData.extractionMethod === "third_party_api" ? "第三方API" : "抖音API"}
          </Badge>
        </div>

        <div className="space-y-2 text-sm">
          {extractData.title && (
            <div>
              <span className="text-muted-foreground">标题：</span>
              <span className="font-medium">{extractData.title}</span>
            </div>
          )}
          {extractData.author && (
            <div>
              <span className="text-muted-foreground">作者：</span>
              <span>
                @{extractData.author}
                {extractData.authorId ? ` (${extractData.authorId})` : ""}
              </span>
            </div>
          )}
          {hasMeta && (
            <div className="flex flex-wrap gap-1 items-center">
              {extractData.tags.map((t, i) => (
                <Badge key={`tag-${i}`} variant="secondary" className="text-xs bg-blue-50 text-blue-700">
                  {t}
                </Badge>
              ))}
              {extractData.hashtags.slice(0, 5).map((h, i) => (
                <Badge key={`ht-${i}`} variant="outline" className="text-xs">
                  {h}
                </Badge>
              ))}
              {extractData.hashtags.length > 5 && (
                <span className="text-xs text-muted-foreground">+{extractData.hashtags.length - 5}个话题</span>
              )}
            </div>
          )}
          {Object.keys(extractData.metrics).length > 0 && (
            <div className="flex gap-3 text-xs text-muted-foreground">
              {extractData.metrics.likes > 0 && <span>👍 {formatMetric(extractData.metrics.likes)}</span>}
              {extractData.metrics.comments > 0 && <span>💬 {formatMetric(extractData.metrics.comments)}</span>}
              {extractData.metrics.shares > 0 && <span>↗ {formatMetric(extractData.metrics.shares)}</span>}
            </div>
          )}
          {extractData.description && (
            <div>
              <span className="text-muted-foreground">文案预览：</span>
              <p className="mt-1 text-xs bg-white rounded p-2 max-h-24 overflow-y-auto whitespace-pre-wrap">
                {extractData.description.slice(0, 300)}
                {extractData.description.length > 300 ? "..." : ""}
              </p>
            </div>
          )}
          {extractData.formattedContent && (
            <details className="text-xs">
              <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                查看保存格式预览
              </summary>
              <pre className="mt-1 text-xs bg-white rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap font-sans">
                {extractData.formattedContent.slice(0, 500)}
              </pre>
            </details>
          )}
        </div>

        <div className="flex gap-2">
          <Button onClick={handleConfirm} size="sm">
            确认添加
          </Button>
          <Button onClick={handleRetry} variant="outline" size="sm">
            重新提取
          </Button>
          <Button onClick={onCancel} variant="ghost" size="sm">
            取消
          </Button>
        </div>
      </div>
    )
  }

  // ─── Render: Partial ───

  if (state === "partial" && extractData) {
    return (
      <div className="space-y-3 p-4 rounded-lg border border-amber-200 bg-amber-50/30">
        <div className="flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle className="w-4 h-4" />
          部分信息未能自动提取
        </div>

        {extractData.warnings.length > 0 && (
          <ul className="text-xs text-amber-600 space-y-0.5">
            {extractData.warnings.map((w, i) => (
              <li key={i}>· {w}</li>
            ))}
          </ul>
        )}

        <div className="space-y-3">
          {extractData.title && (
            <div className="text-sm">
              <span className="text-muted-foreground">标题：</span>
              <span className="font-medium">{extractData.title}</span>
            </div>
          )}
          {extractData.author && (
            <div className="text-sm">
              <span className="text-muted-foreground">作者：</span>
              <span>@{extractData.author}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Edit3 className="w-3 h-3" />
              文案内容（可编辑补充）
            </label>
            <Textarea
              rows={6}
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              placeholder="请粘贴或编辑视频完整文案..."
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleConfirm} size="sm">
            确认添加
          </Button>
          <Button onClick={handleRetry} variant="outline" size="sm">
            重新提取
          </Button>
          <Button onClick={onCancel} variant="ghost" size="sm">
            取消
          </Button>
        </div>
      </div>
    )
  }

  // ─── Render: Failed ───

  return (
    <div className="space-y-3 p-4 rounded-lg border border-red-200 bg-red-50/30">
      <div className="flex items-center gap-2 text-sm text-red-700">
        <XCircle className="w-4 h-4" />
        提取失败
      </div>

      <p className="text-xs text-red-600">{errorMessage || "无法提取该链接的内容"}</p>

      {extractData?.warnings && extractData.warnings.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-0.5">
          {extractData.warnings.map((w, i) => (
            <li key={i}>· {w}</li>
          ))}
        </ul>
      )}

      <div className="text-xs text-muted-foreground">
        <p>建议：打开抖音APP → 复制视频文案 → 粘贴到下方手动输入区域</p>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleRetry} variant="outline" size="sm">
          重新尝试
        </Button>
        <Button onClick={onCancel} variant="ghost" size="sm">
          切换手动输入
        </Button>
      </div>
    </div>
  )
}
