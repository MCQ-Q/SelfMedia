"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  ArrowLeft, Download, Save, Loader2, Clock,
  MessageSquare, Heart, Music, Lock, RefreshCw,
  Sparkles, Monitor,
} from "lucide-react"
import { Teleprompter } from "@/components/teleprompter"

interface TrackObj {
  type?: string
  intent?: string
  integrated?: boolean
  primary?: string
  secondary?: string
  intensity?: number
  mood?: string
  keywords?: string[]
  description?: string
  imagePrompt?: string
  videoPrompt?: string
  bpmRange?: string
  soundEffect?: { type: string; timing: string; purpose: string }
}

interface SegmentTrack {
  id: string
  trackType: string
  content: string // JSON
}

interface Segment {
  id: string
  orderIndex: number
  startTime: number
  endTime: number
  segmentGoal: string
  dialogue: string
  subtitleText: string
  directorNote: string
  isLocked: boolean
  tracks: SegmentTrack[]
  // Parsed track cache
  _hook?: TrackObj | null
  _emotion?: TrackObj | null
  _visual?: TrackObj | null
  _bgm?: TrackObj | null
}

interface ScriptVersion {
  id: string
  projectId: string
  workflowRunId: string | null
  title: string
  summary: string
  totalDurationSeconds: number
  versionNo: number
  status: string
  segments: Segment[]
}

interface AgentRunItem {
  id: string
  agentType: string
  status: string
  model: string
  inputSnapshot: string
  outputSummary: string | null
  durationMs: number
  outputs: Array<{ id: string; outputType: string; content: string }>
}

interface PipelineStep {
  stepKey: string
  status: string
  agentRuns: AgentRunItem[]
}

function formatJson(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2) } catch { return raw }
}

function parseTrack(tracks: SegmentTrack[], type: string): TrackObj | null {
  const t = tracks.find(tr => tr.trackType === type)
  if (!t) return null
  try { return JSON.parse(t.content) } catch { return null }
}

const agentLabels: Record<string, string> = {
  outline: "大纲设计",
  hook: "钩子设计",
  dialogue: "台词生成",
  emotion: "情绪设计",
  visual: "画面设计",
  bgm: "BGM设计",
  director: "导演整合",
}

const agentInputLabels: Record<string, string> = {
  sourceMaterial: "原始素材",
  topic: "选题信息",
  knowledgeItems: "参考知识",
  outline: "大纲结构",
  hookPlan: "钩子方案",
  dialogue: "台词内容",
  emotion: "情绪弧线",
  visual: "画面设计",
  bgm: "BGM方案",
}

const emotionColors: Record<string, string> = {
  "刺痛": "bg-red-50 text-red-700 border-red-200",
  "释然": "bg-green-50 text-green-700 border-green-200",
  "惊讶": "bg-purple-50 text-purple-700 border-purple-200",
  "共鸣": "bg-blue-50 text-blue-700 border-blue-200",
  "紧迫": "bg-orange-50 text-orange-700 border-orange-200",
  "好奇": "bg-cyan-50 text-cyan-700 border-cyan-200",
}

export default function ScriptPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id

  const [script, setScript] = useState<ScriptVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rewriting, setRewriting] = useState<number | null>(null)
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([])
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
  const [loadingPipeline, setLoadingPipeline] = useState(false)
  const [teleprompterOpen, setTeleprompterOpen] = useState(false)

  const loadScript = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/scripts/latest`)
      const data = await res.json()
      if (!res.ok) {
        if (data.error === "SCRIPT_NOT_FOUND") { setScript(null); return }
        toast.error(data.message || "加载失败")
        return
      }
      // Enrich segments with parsed tracks
      const sv = data.scriptVersion as ScriptVersion
      if (sv.segments) {
        sv.segments = sv.segments.map(seg => ({
          ...seg,
          _hook: parseTrack(seg.tracks, "hook"),
          _emotion: parseTrack(seg.tracks, "emotion"),
          _visual: parseTrack(seg.tracks, "visual"),
          _bgm: parseTrack(seg.tracks, "bgm"),
        }))
      }
      setScript(sv)
    } catch {
      toast.error("加载台本失败")
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { loadScript() }, [loadScript])

  useEffect(() => {
    if (!script?.workflowRunId) return
    setLoadingPipeline(true)
    fetch(`/api/workflow-runs/${script.workflowRunId}`)
      .then(r => r.json())
      .then(data => {
        if (data.workflow?.steps) {
          setPipelineSteps(data.workflow.steps)
        }
      })
      .catch(console.error)
      .finally(() => setLoadingPipeline(false))
  }, [script?.workflowRunId])

  const handleExport = async () => {
    if (!script) return
    try {
      const res = await fetch(`/api/projects/${projectId}/scripts/${script.id}/export.md`)
      if (!res.ok) { toast.error("导出失败"); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${script.title || "台本"}.md`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("导出成功")
    } catch {
      toast.error("导出失败")
    }
  }

  const handleSegmentEdit = async (segId: string, fields: Record<string, string>) => {
    if (!script) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/scripts/${script.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments: [{ id: segId, ...fields }],
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message || "保存失败"); return }
      toast.success("已保存")
      loadScript()
    } catch {
      toast.error("保存失败")
    } finally {
      setSaving(false)
    }
  }

  const handleRewriteSegment = async (segId: string, segIdx: number) => {
    if (!script) return
    setRewriting(segIdx)
    try {
      const res = await fetch(`/api/script-segments/${segId}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewriteTargets: ["dialogue", "visual"], feedback: "Make it more emotional" }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message || "重写失败"); return }
      toast.success("段落已重写")
      loadScript()
    } catch {
      toast.error("重写失败")
    } finally {
      setRewriting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full" />)}
      </div>
    )
  }

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/projects/${projectId}/workbench`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-1"
          >
            <ArrowLeft className="w-3 h-3 mr-1" /> 返回工作台
          </Link>
          <h1 className="text-2xl font-bold">{script?.title || "台本详情"}</h1>
        </div>
        <div className="flex items-center gap-2">
          {script && script.segments.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setTeleprompterOpen(true)}>
              <Monitor className="w-3 h-3 mr-1" /> 提词器
            </Button>
          )}
          {script && (
            <Button size="sm" onClick={handleExport}>
              <Download className="w-3 h-3 mr-1" /> 导出 Markdown
            </Button>
          )}
        </div>
      </div>

      {/* No Script */}
      {!script && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-lg font-medium mb-1">还没有台本</h3>
            <p className="text-muted-foreground text-sm mb-4">请先在项目中生成台本</p>
            <Link href={`/projects/${projectId}/workbench`}>
              <Button variant="outline">前往工作台</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Script Summary */}
      {script && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-4 h-4" /> 基本信息
              </CardTitle>
              <CardDescription>
                时长 {script.totalDurationSeconds}秒 · {script.segments.length} 个段落 · V{script.versionNo}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{script.summary}</p>
            </CardContent>
          </Card>

          {/* ═══ Pipeline Trace ═══ */}
          {script.workflowRunId && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> 多智能体协作过程
                  </CardTitle>
                  <Badge variant="secondary">{pipelineSteps.length} 个 Agent</Badge>
                </div>
                <CardDescription>
                  数据流: 大纲 → 钩子 → 台词 → 情绪 → 画面 → BGM → 导演整合
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPipeline ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : pipelineSteps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无过程数据</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="py-2 pr-2 w-8">#</th>
                          <th className="py-2 pr-3">Agent</th>
                          <th className="py-2 pr-3">输入源</th>
                          <th className="py-2 pr-3">产出概要</th>
                          <th className="py-2 pr-2 text-right w-16">耗时</th>
                          <th className="py-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pipelineSteps.map((step, idx) => {
                          const run = step.agentRuns?.[0]
                          const snapshot = run ? (() => { try { return JSON.parse(run.inputSnapshot) } catch { return {} } })() : {}
                          const inputData: string[] = snapshot.inputData || []
                          const isExpanded = expandedStep === step.stepKey
                          const output = run?.outputs?.[0]

                          const rows = [
                            <tr key={step.stepKey} className="border-b last:border-0 hover:bg-muted/30">
                                <td className="py-2 pr-2 text-muted-foreground">{idx + 1}</td>
                                <td className="py-2 pr-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className={step.status === "success" ? "text-green-600" : step.status === "failed" ? "text-red-600" : "text-muted-foreground"}>
                                      {step.status === "success" ? "✓" : step.status === "failed" ? "✗" : "○"}
                                    </span>
                                    <span className="font-medium">{agentLabels[step.stepKey] || step.stepKey}</span>
                                  </div>
                                </td>
                                <td className="py-2 pr-3">
                                  <div className="flex flex-wrap gap-1">
                                    {inputData.length === 0 ? (
                                      <span className="text-muted-foreground text-xs">—</span>
                                    ) : (
                                      inputData.map((k: string) => (
                                        <Badge key={k} variant="outline" className="text-[10px] px-1 py-0">
                                          {agentInputLabels[k] || k}
                                        </Badge>
                                      ))
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 pr-3 text-muted-foreground max-w-48 truncate">
                                  {run?.outputSummary || "—"}
                                </td>
                                <td className="py-2 pr-2 text-right text-xs text-muted-foreground">
                                  {run ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}
                                </td>
                                <td className="py-2">
                                  {output && (
                                    <button
                                      className="text-xs text-primary hover:underline"
                                      onClick={() => setExpandedStep(isExpanded ? null : step.stepKey)}
                                    >
                                      {isExpanded ? "收起" : "详情"}
                                    </button>
                                  )}
                                </td>
                              </tr>
                          ]
                          if (isExpanded && output) {
                            rows.push(
                              <tr key={`${step.stepKey}-detail`}>
                                <td colSpan={6} className="p-0">
                                  <div className="bg-muted/20 rounded m-2 p-3 space-y-3">
                                    <div>
                                      <div className="text-xs font-semibold text-muted-foreground mb-1">输入上下文</div>
                                      <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/50 rounded p-2 max-h-40 overflow-auto">
                                        {JSON.stringify(snapshot, null, 2)}
                                      </pre>
                                    </div>
                                    <div>
                                      <div className="text-xs font-semibold text-muted-foreground mb-1">Agent 产出 (JSON)</div>
                                      <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/50 rounded p-2 max-h-80 overflow-auto">
                                        {formatJson(output.content)}
                                      </pre>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )
                          }
                          return rows
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">时间轴分段</h2>

            {script.segments.map((seg, idx) => (
              <Card key={seg.id} className={`relative border-l-4 ${seg.isLocked ? "border-l-yellow-500" : "border-l-primary"}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Badge variant="outline">{seg.startTime}-{seg.endTime}s</Badge>
                      第 {seg.orderIndex} 段 · {seg.segmentGoal}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      {seg.isLocked && <Lock className="w-3 h-3 text-yellow-600" />}
                      {seg._emotion && (
                        <Badge variant="outline" className={emotionColors[seg._emotion.primary || ""] || ""}>
                          <Heart className="w-3 h-3 mr-1" />
                          {seg._emotion.primary} {seg._emotion.intensity}/10
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Dialogue */}
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> 台词
                    </Label>
                    <Textarea
                      className="mt-1 text-sm font-medium min-h-[60px]"
                      value={seg.dialogue}
                      onChange={e => handleSegmentEdit(seg.id, { dialogue: e.target.value })}
                      disabled={seg.isLocked}
                    />
                  </div>

                  {/* Subtitle */}
                  <div>
                    <Label className="text-xs text-muted-foreground">字幕</Label>
                    <Textarea
                      className="mt-1 text-sm min-h-[36px]"
                      value={seg.subtitleText}
                      onChange={e => handleSegmentEdit(seg.id, { subtitleText: e.target.value })}
                      disabled={seg.isLocked}
                    />
                  </div>

                  {/* Tracks in a grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {seg._hook && (
                      <div className="p-2 rounded bg-amber-50 border border-amber-200">
                        <span className="font-semibold text-amber-800">钩子:</span>{" "}
                        {seg._hook.type} — {seg._hook.intent}
                      </div>
                    )}
                    {seg._visual && (
                      <div className="p-2 rounded bg-sky-50 border border-sky-200">
                        <span className="font-semibold text-sky-800">画面:</span>{" "}
                        {seg._visual.description?.slice(0, 60)}
                        {seg._visual.imagePrompt && (
                          <div className="text-sky-600 mt-0.5 truncate">Prompt: {seg._visual.imagePrompt.slice(0, 80)}</div>
                        )}
                      </div>
                    )}
                    {seg._bgm && (
                      <div className="p-2 rounded bg-violet-50 border border-violet-200">
                        <span className="font-semibold text-violet-800">BGM:</span>{" "}
                        <Music className="w-3 h-3 inline" /> {seg._bgm.mood} ({seg._bgm.bpmRange})
                      </div>
                    )}
                  </div>

                  {/* Director note */}
                  <div>
                    <Label className="text-xs text-muted-foreground">导演备注 / 内容审查 / 修改记录</Label>
                    <Textarea
                      className="mt-1 text-xs min-h-[140px]"
                      value={seg.directorNote}
                      onChange={e => handleSegmentEdit(seg.id, { directorNote: e.target.value })}
                      disabled={seg.isLocked}
                    />
                  </div>

                  {/* Rewrite button */}
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={seg.isLocked || rewriting === idx}
                      onClick={() => handleRewriteSegment(seg.id, idx)}
                    >
                      {rewriting === idx ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3 mr-1" />
                      )}
                      AI 重写本段
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ═══ Teleprompter ═══ */}
          <Teleprompter
            segments={script.segments.map((s) => ({
              id: s.id,
              orderIndex: s.orderIndex,
              startTime: s.startTime,
              endTime: s.endTime,
              dialogue: s.dialogue,
              subtitleText: s.subtitleText,
              segmentGoal: s.segmentGoal,
            }))}
            title={script.title}
            open={teleprompterOpen}
            onClose={() => setTeleprompterOpen(false)}
          />
        </>
      )}
    </div>
  )
}
