"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  ArrowLeft, Loader2, Sparkles, CheckCircle2, FileText, Plus, Trash2,
  ChevronDown, ChevronRight, Clock, Link2, Pencil, Save, X,
} from "lucide-react"
import { DouyinUrlInput } from "@/components/douyin-url-input"
import type { ConfirmedDouyinData } from "@/components/douyin-url-input"

// ─── Interfaces ───

interface SourceMaterialItem {
  id: string
  type: string
  contentEncrypted: string
  contentPreview: string
  createdAt: string
}

interface ObservationArchiveCard {
  originalEvent?: {
    timeOrStage?: string
    scene?: string
    concreteEvent?: string
    peopleInvolved?: string[]
    keyDetails?: string[]
  }
  originalLanguage?: {
    creatorQuote?: string
    preservedPhrases?: string[]
  }
  currentState?: {
    behavior?: string
    emotion?: string
    bodyFeeling?: string
    thoughts?: string
    perceivedProblemAtThatTime?: string
  }
  laterObservation?: {
    laterChanges?: string
    newView?: string
    newUnderstanding?: string
  }
  hiddenThemes?: string[]
  extensibleMaterials?: {
    similarExperiences?: string[]
    relatedStories?: string[]
    futureQuestions?: string[]
  }
  unresolvedQuestions?: {
    stillConfused?: string[]
    noAnswerYet?: string[]
    worthObserving?: string[]
  }
}

interface ObservationArchive {
  id: string
  archiveCode: string
  status: "archived" | "confirmed" | "ignored"
  originalLanguage: string
  summary: string
  content: string | ObservationArchiveCard
  tags: string | string[]
  futureUse: string
  createdAt: string
}

interface Project {
  id: string
  title: string
  status: string
  selectedTopicId: string | null
  targetPlatform: string
  videoType: string
  durationSeconds: number
  sourceMaterials: SourceMaterialItem[]
  observationArchives: ObservationArchive[]
  topics: Topic[]
  references: Reference[]
  scriptVersions?: { id: string; title: string; status: string }[]
}

interface Topic {
  id: string
  title: string
  targetAudience: string
  coreConflict: string
  emotionalTone: string
  score: number
  reason: string
}

interface Reference {
  id: string
  title: string
  url: string | null
  transcript: string
}

const platformLabels: Record<string, string> = {
  douyin: "抖音", xiaohongshu: "小红书", bilibili: "B站", video_account: "视频号",
}

const materialTypeLabels: Record<string, string> = {
  chat_log: "聊天记录", reflection: "个人感悟", note: "灵感笔记", draft: "已有文案",
}

const materialTypeBadge: Record<string, string> = {
  chat_log: "bg-blue-50 text-blue-700", reflection: "bg-purple-50 text-purple-700",
  note: "bg-amber-50 text-amber-700", draft: "bg-green-50 text-green-700",
}

// ─── Component ───

export default function WorkbenchPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const router = useRouter()

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingTopics, setGeneratingTopics] = useState(false)
  const [generatingArchive, setGeneratingArchive] = useState(false)
  const [generatingScript, setGeneratingScript] = useState(false)
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null)
  const [savingTopic, setSavingTopic] = useState(false)
  // Editable fields for a topic when in edit mode
  const [topicEditForm, setTopicEditForm] = useState<{
    title: string
    targetAudience: string
    coreConflict: string
    emotionalTone: string
    score: number
    reason: string
  }>({ title: "", targetAudience: "", coreConflict: "", emotionalTone: "", score: 0, reason: "" })
  const [showReference, setShowReference] = useState(false)
  const [refItems, setRefItems] = useState<{
    title: string
    transcript: string
    url?: string
    author?: string
    metrics?: Record<string, unknown>
    rawData?: Record<string, unknown>
    inputMode?: "manual" | "douyin"
  }[]>([{ title: "", transcript: "", inputMode: "manual" }])
  const [savedRefIds, setSavedRefIds] = useState<string[]>([])

  // Source material state
  const [showAddMaterial, setShowAddMaterial] = useState(false)
  const [materialInputMode, setMaterialInputMode] = useState<"manual" | "douyin">("manual")
  const [newMaterialType, setNewMaterialType] = useState("note")
  const [newMaterialContent, setNewMaterialContent] = useState("")
  const [savingMaterial, setSavingMaterial] = useState(false)
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set())
  const [expandedArchives, setExpandedArchives] = useState<Set<string>>(new Set())
  const [fullMaterials, setFullMaterials] = useState<Record<string, string>>({})
  const [loadingFullMaterial, setLoadingFullMaterial] = useState<Set<string>>(new Set())
  const [materialMetadata, setMaterialMetadata] = useState<Record<string, unknown>>({})

  const loadProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.message || "加载失败"); return }
      setProject(data.project)
    } catch {
      toast.error("加载项目失败")
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { loadProject() }, [loadProject])

  // ─── Source Material: add, view, delete ───

  const handleAddMaterial = async () => {
    if (!newMaterialContent.trim()) { toast.error("请输入素材内容"); return }
    setSavingMaterial(true)
    try {
      const body: Record<string, unknown> = {
        content: newMaterialContent,
        type: newMaterialType,
        metadata: materialMetadata,
      }
      const res = await fetch(`/api/projects/${projectId}/source-materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message || "保存失败"); return }
      toast.success("素材已保存")
      setNewMaterialContent("")
      setMaterialMetadata({})
      setShowAddMaterial(false)
      setMaterialInputMode("manual")
      loadProject()
    } catch {
      toast.error("网络错误")
    } finally {
      setSavingMaterial(false)
    }
  }

  const handleDouyinMaterialExtracted = (data: ConfirmedDouyinData) => {
    // Use the pre-formatted content from the extractor, or build a simple version
    const content = data.description || [
      data.title ? `标题：${data.title}` : "",
      data.author ? `作者：@${data.author}` : "",
      data.url ? `\n链接：${data.url}` : "",
    ].filter(Boolean).join("\n")

    setNewMaterialContent(content)
    setNewMaterialType("note")
    setMaterialMetadata({
      sourceUrl: data.url,
      sourcePlatform: "douyin",
      sourceAuthor: data.author,
      douyinRawData: data.rawData as unknown as Record<string, unknown>,
    })
    setMaterialInputMode("manual")

    toast.success("抖音内容已提取，可编辑后保存")
  }

  const toggleMaterialExpand = async (materialId: string) => {
    const newSet = new Set(expandedMaterials)
    if (newSet.has(materialId)) {
      newSet.delete(materialId)
      setExpandedMaterials(newSet)
      return
    }
    newSet.add(materialId)
    setExpandedMaterials(newSet)

    // Fetch full content if not cached
    if (!fullMaterials[materialId]) {
      const loadingSet = new Set(loadingFullMaterial)
      loadingSet.add(materialId)
      setLoadingFullMaterial(loadingSet)
      try {
        const res = await fetch(`/api/source-materials/${materialId}`)
        const data = await res.json()
        if (res.ok) {
          setFullMaterials(prev => ({ ...prev, [materialId]: data.sourceMaterial.contentEncrypted }))
        }
      } catch { /* ignore */ }
      finally {
        const doneSet = new Set(loadingFullMaterial)
        doneSet.delete(materialId)
        setLoadingFullMaterial(doneSet)
      }
    }
  }

  const handleDeleteMaterial = async (materialId: string) => {
    try {
      const res = await fetch(`/api/source-materials/${materialId}`, { method: "DELETE" })
      if (!res.ok) { toast.error("删除失败"); return }
      toast.success("素材已删除")
      setExpandedMaterials(prev => { const s = new Set(prev); s.delete(materialId); return s })
      setFullMaterials(prev => { const next = { ...prev }; delete next[materialId]; return next })
      loadProject()
    } catch {
      toast.error("网络错误")
    }
  }

  // ─── Observation Archives ───

  const parseArchiveCard = (archive: ObservationArchive): ObservationArchiveCard => {
    if (typeof archive.content !== "string") return archive.content
    try { return JSON.parse(archive.content) } catch { return {} }
  }

  const parseArchiveTags = (archive: ObservationArchive): string[] => {
    if (Array.isArray(archive.tags)) return archive.tags
    try { return JSON.parse(archive.tags || "[]") } catch { return [] }
  }

  const toggleArchiveExpand = (archiveId: string) => {
    setExpandedArchives(prev => {
      const next = new Set(prev)
      if (next.has(archiveId)) next.delete(archiveId)
      else next.add(archiveId)
      return next
    })
  }

  const handleGenerateObservationArchive = async () => {
    setGeneratingArchive(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/observation-archives/generate`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message || "观察档案生成失败"); return }
      toast.success("观察档案已生成")
      loadProject()
    } catch {
      toast.error("网络错误")
    } finally { setGeneratingArchive(false) }
  }

  const handleUpdateArchiveStatus = async (archiveId: string, status: ObservationArchive["status"]) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/observation-archives/${archiveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message || "更新档案失败"); return }
      toast.success(status === "confirmed" ? "已确认用于选题" : status === "ignored" ? "已暂不使用" : "已恢复为归档")
      loadProject()
    } catch { toast.error("网络错误") }
  }
  // ─── Topics ───

  const handleGenerateTopics = async () => {
    setGeneratingTopics(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/topics/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 5 }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message || "选题生成失败"); return }
      toast.success("选题生成成功")
      loadProject()
    } catch {
      toast.error("网络错误")
    } finally { setGeneratingTopics(false) }
  }

  const handleSelectTopic = async (topicId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/topics/${topicId}/select`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message || "选择失败"); return }
      toast.success("已选择选题")
      loadProject()
      setShowReference(true)
    } catch { toast.error("网络错误") }
  }

  const handleStartEditTopic = (topic: Topic) => {
    setEditingTopicId(topic.id)
    setTopicEditForm({
      title: topic.title,
      targetAudience: topic.targetAudience,
      coreConflict: topic.coreConflict,
      emotionalTone: topic.emotionalTone,
      score: topic.score,
      reason: topic.reason,
    })
  }

  const handleCancelEditTopic = () => {
    setEditingTopicId(null)
  }

  const handleSaveTopic = async () => {
    if (!editingTopicId) return
    setSavingTopic(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/topics/${editingTopicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(topicEditForm),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message || "保存失败"); return }
      toast.success("选题已更新")
      setEditingTopicId(null)
      loadProject()
    } catch {
      toast.error("网络错误")
    } finally { setSavingTopic(false) }
  }

  // ─── References ───

  const handleSaveReferences = async () => {
    const valid = refItems.filter(r => r.transcript.trim())
    if (valid.length === 0) { toast.error("至少填写一个参考内容"); return }
    try {
      const res = await fetch(`/api/projects/${projectId}/references/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: valid.map(r => ({
            title: r.title,
            url: r.url || "",
            author: r.author || "",
            transcript: r.transcript,
            metrics: r.metrics || {},
            rawData: r.rawData || {},
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message || "保存参考失败"); return }
      setSavedRefIds(data.referenceIds)
      toast.success(`已保存 ${valid.length} 条参考`)
      loadProject()
    } catch { toast.error("网络错误") }
  }

  // ─── Script ───

  const handleGenerateScript = async () => {
    if (!project?.selectedTopicId) { toast.error("请先选择选题"); return }
    setGeneratingScript(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/scripts/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: project.selectedTopicId,
          durationSeconds: project.durationSeconds,
          referenceMode: savedRefIds.length > 0 ? "manual" : "none",
          referenceIds: savedRefIds.length > 0 ? savedRefIds : undefined,
          style: "sharp_emotional_oral",
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message || "台本生成失败"); return }
      toast.success("台本生成成功")
      loadProject()
      router.push(`/projects/${projectId}/script`)
    } catch { toast.error("网络错误") }
    finally { setGeneratingScript(false) }
  }

  // ─── Render helpers ───

  const formatDate = (d: string) => {
    const date = new Date(d)
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
  }

  if (loading) {
    return (
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-4">
        <Skeleton className="h-6 w-32" /><Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" /><Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!project) {
    return <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8"><p>项目未找到</p></div>
  }

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/projects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-1">
            <ArrowLeft className="w-3 h-3 mr-1" /> 项目列表
          </Link>
          <h1 className="text-2xl font-bold">{project.title}</h1>
        </div>
        <Badge variant="outline">{platformLabels[project.targetPlatform]} · {project.durationSeconds}秒</Badge>
      </div>

      {/* ═══ Source Materials ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" /> 原始素材
              {project.sourceMaterials.length > 0 && (
                <Badge variant="secondary" className="text-xs">{project.sourceMaterials.length} 条</Badge>
              )}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowAddMaterial(!showAddMaterial)}>
              <Plus className="w-3 h-3 mr-1" />
              {showAddMaterial ? "取消" : "添加素材"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Add form */}
          {showAddMaterial && (
            <div className="p-4 rounded-lg border border-dashed space-y-3">
              {/* Input mode toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Label className="text-sm whitespace-nowrap">素材类型</Label>
                  <div className="flex gap-1">
                    {(["chat_log", "reflection", "note", "draft"] as const).map(t => (
                      <Badge
                        key={t}
                        variant={newMaterialType === t ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => setNewMaterialType(t)}
                      >
                        {materialTypeLabels[t]}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Badge
                    variant={materialInputMode === "manual" ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => setMaterialInputMode("manual")}
                  >
                    <Pencil className="w-3 h-3 mr-0.5" />
                    手动输入
                  </Badge>
                  <Badge
                    variant={materialInputMode === "douyin" ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => setMaterialInputMode("douyin")}
                  >
                    <Link2 className="w-3 h-3 mr-0.5" />
                    抖音链接
                  </Badge>
                </div>
              </div>

              {/* Douyin mode */}
              {materialInputMode === "douyin" && (
                <DouyinUrlInput
                  onConfirm={handleDouyinMaterialExtracted}
                  onCancel={() => setMaterialInputMode("manual")}
                />
              )}

              {/* Manual mode */}
              {materialInputMode === "manual" && (
                <>
                  {Object.keys(materialMetadata).length > 0 && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Link2 className="w-3 h-3" />
                      来源: {materialMetadata.sourceUrl as string || "抖音链接"}
                      <button
                        className="text-primary hover:underline ml-2"
                        onClick={() => { setMaterialMetadata({}); setNewMaterialContent("") }}
                      >
                        清除
                      </button>
                    </div>
                  )}
                  <Textarea
                    placeholder="粘贴聊天记录、个人感悟、灵感片段或已有文案..."
                    rows={6}
                    value={newMaterialContent}
                    onChange={e => setNewMaterialContent(e.target.value)}
                  />
                </>
              )}
              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={handleAddMaterial} disabled={savingMaterial || !newMaterialContent.trim()}>
                  {savingMaterial ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> 保存中...</> : "保存素材"}
                </Button>
              </div>
            </div>
          )}

          {/* Material list */}
          {project.sourceMaterials.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">还没有添加素材，点击"添加素材"开始</p>
          ) : (
            <div className="space-y-2">
              {project.sourceMaterials.map(m => {
                const isExpanded = expandedMaterials.has(m.id)
                const isLoading = loadingFullMaterial.has(m.id)
                return (
                  <div key={m.id} className="border rounded-lg">
                    <div
                      className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleMaterialExpand(m.id)}
                    >
                      {isLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                      ) : isExpanded ? (
                        <ChevronDown className="w-3 h-3 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 shrink-0" />
                      )}
                      <Badge variant="outline" className={`text-xs shrink-0 ${materialTypeBadge[m.type] || ""}`}>
                        {materialTypeLabels[m.type] || m.type}
                      </Badge>
                      <span className="text-sm truncate flex-1">{m.contentPreview || m.contentEncrypted?.slice(0, 100)}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" /> {formatDate(m.createdAt)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0"
                        onClick={e => { e.stopPropagation(); handleDeleteMaterial(m.id) }}
                      >
                        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500" />
                      </Button>
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-3 pt-0">
                        <div className="bg-muted/30 rounded p-3">
                          <pre className="text-sm whitespace-pre-wrap font-sans break-words">
                            {fullMaterials[m.id] || m.contentEncrypted}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Observation Archives ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" /> 生活观察档案
              {(project.observationArchives?.length || 0) > 0 && (
                <Badge variant="secondary" className="text-xs">{project.observationArchives.length} 张</Badge>
              )}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateObservationArchive}
              disabled={generatingArchive || project.sourceMaterials.length === 0}
            >
              {generatingArchive ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> 归档中...</> : "生成观察档案"}
            </Button>
          </div>
          <CardDescription>
            先把原始素材整理成长期可调用的生活观察资产。确认后的档案会优先进入选题 Agent。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(project.observationArchives?.length || 0) === 0 ? (
            <p className="text-sm text-muted-foreground">还没有观察档案。建议先归档，再主观确认哪些素材进入选题。</p>
          ) : (
            <div className="space-y-3">
              {project.observationArchives.map(archive => {
                const isExpanded = expandedArchives.has(archive.id)
                const card = parseArchiveCard(archive)
                const tags = parseArchiveTags(archive)
                return (
                  <div key={archive.id} className="border rounded-lg overflow-hidden">
                    <div className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{archive.archiveCode}</Badge>
                            <Badge
                              variant={archive.status === "confirmed" ? "default" : "outline"}
                              className="text-xs"
                            >
                              {archive.status === "confirmed" ? "已确认" : archive.status === "ignored" ? "暂不使用" : "已归档"}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium mt-2">{archive.summary}</p>
                          {archive.originalLanguage && (
                            <p className="text-xs text-muted-foreground mt-1">原始语言：{archive.originalLanguage}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => toggleArchiveExpand(archive.id)}>
                            {isExpanded ? "收起" : "查看"}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleUpdateArchiveStatus(archive.id, "confirmed")}>
                            确认
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleUpdateArchiveStatus(archive.id, "ignored")}>
                            忽略
                          </Button>
                        </div>
                      </div>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tags.map(tag => <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>)}
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-muted/20 p-4 space-y-4 text-sm">
                        <section>
                          <h4 className="font-semibold mb-1">1. 原始事件</h4>
                          <p>发生时间/阶段：{card.originalEvent?.timeOrStage || "-"}</p>
                          <p>发生场景：{card.originalEvent?.scene || "-"}</p>
                          <p>具体事件：{card.originalEvent?.concreteEvent || "-"}</p>
                          {(card.originalEvent?.peopleInvolved?.length || 0) > 0 && <p>涉及人物：{card.originalEvent?.peopleInvolved?.join("、")}</p>}
                          {(card.originalEvent?.keyDetails?.length || 0) > 0 && <p>关键细节：{card.originalEvent?.keyDetails?.join("；")}</p>}
                        </section>

                        <section>
                          <h4 className="font-semibold mb-1">2. 原始语言</h4>
                          <p>{card.originalLanguage?.creatorQuote || archive.originalLanguage || "-"}</p>
                          {(card.originalLanguage?.preservedPhrases?.length || 0) > 0 && (
                            <p className="text-muted-foreground">保留片段：{card.originalLanguage?.preservedPhrases?.join("；")}</p>
                          )}
                        </section>

                        <section>
                          <h4 className="font-semibold mb-1">3. 当时状态</h4>
                          <p>行为：{card.currentState?.behavior || "-"}</p>
                          <p>情绪：{card.currentState?.emotion || "-"}</p>
                          <p>身体感受：{card.currentState?.bodyFeeling || "-"}</p>
                          <p>脑中的想法：{card.currentState?.thoughts || "-"}</p>
                          <p>当时认为的问题：{card.currentState?.perceivedProblemAtThatTime || "-"}</p>
                        </section>

                        <section>
                          <h4 className="font-semibold mb-1">4. 后续观察</h4>
                          <p>后来变化：{card.laterObservation?.laterChanges || "-"}</p>
                          <p>重新怎么看：{card.laterObservation?.newView || "-"}</p>
                          <p>新的理解：{card.laterObservation?.newUnderstanding || "-"}</p>
                        </section>

                        <section>
                          <h4 className="font-semibold mb-1">5. 隐藏主题</h4>
                          <p>{card.hiddenThemes?.join("、") || "-"}</p>
                        </section>

                        <section>
                          <h4 className="font-semibold mb-1">6. 可延展素材</h4>
                          <p>类似经历：{card.extensibleMaterials?.similarExperiences?.join("；") || "-"}</p>
                          <p>相关故事：{card.extensibleMaterials?.relatedStories?.join("；") || "-"}</p>
                          <p>未来问题：{card.extensibleMaterials?.futureQuestions?.join("；") || "-"}</p>
                          {archive.futureUse && <p className="text-muted-foreground mt-1">未来调用：{archive.futureUse}</p>}
                        </section>

                        <section>
                          <h4 className="font-semibold mb-1">7. 未解决的问题</h4>
                          <p>仍然困惑：{card.unresolvedQuestions?.stillConfused?.join("；") || "-"}</p>
                          <p>还没有答案：{card.unresolvedQuestions?.noAnswerYet?.join("；") || "-"}</p>
                          <p>值得继续观察：{card.unresolvedQuestions?.worthObserving?.join("；") || "-"}</p>
                        </section>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      {/* ═══ Topics ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> 候选选题
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleGenerateTopics} disabled={generatingTopics}>
              {generatingTopics ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> 生成中...</>
                : project.topics.length > 0 ? "重新生成" : "生成选题"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {project.topics.length === 0 ? (
            <p className="text-sm text-muted-foreground">点击生成候选选题，基于原始素材分析潜在的视频方向</p>
          ) : (
            <div className="grid gap-3">
              {project.topics.map(topic => {
                const isSelected = topic.id === project.selectedTopicId
                const isEditing = editingTopicId === topic.id
                return (
                  <Card
                    key={topic.id}
                    className={`transition-colors ${isSelected ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"}`}
                  >
                    {isEditing ? (
                      /* ═══ Edit mode ═══ */
                      <>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">编辑选题</CardTitle>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost" size="sm" className="h-7 w-7 p-0"
                                onClick={handleSaveTopic} disabled={savingTopic}
                              >
                                {savingTopic ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-green-600" />}
                              </Button>
                              <Button
                                variant="ghost" size="sm" className="h-7 w-7 p-0"
                                onClick={handleCancelEditTopic} disabled={savingTopic}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">标题</Label>
                            <Input
                              value={topicEditForm.title}
                              onChange={e => setTopicEditForm(prev => ({ ...prev, title: e.target.value }))}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">核心冲突</Label>
                            <Input
                              value={topicEditForm.coreConflict}
                              onChange={e => setTopicEditForm(prev => ({ ...prev, coreConflict: e.target.value }))}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">情感基调</Label>
                              <Input
                                value={topicEditForm.emotionalTone}
                                onChange={e => setTopicEditForm(prev => ({ ...prev, emotionalTone: e.target.value }))}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">目标受众</Label>
                              <Input
                                value={topicEditForm.targetAudience}
                                onChange={e => setTopicEditForm(prev => ({ ...prev, targetAudience: e.target.value }))}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">评分 (0-1)</Label>
                            <Input
                              type="number"
                              min={0} max={1} step={0.01}
                              value={topicEditForm.score}
                              onChange={e => setTopicEditForm(prev => ({ ...prev, score: parseFloat(e.target.value) || 0 }))}
                              className="h-8 text-sm w-24"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">推荐理由</Label>
                            <Textarea
                              value={topicEditForm.reason}
                              onChange={e => setTopicEditForm(prev => ({ ...prev, reason: e.target.value }))}
                              rows={3}
                              className="text-sm"
                            />
                          </div>
                        </CardContent>
                      </>
                    ) : (
                      /* ═══ View mode ═══ */
                      <>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => handleSelectTopic(topic.id)}
                            >
                              <CardTitle className="text-sm flex items-center gap-2">
                                {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                                {topic.title}
                              </CardTitle>
                              <CardDescription className="mt-1">
                                {topic.coreConflict} · {topic.emotionalTone} · 受众: {topic.targetAudience}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost" size="sm" className="h-7 w-7 p-0"
                                onClick={(e) => { e.stopPropagation(); handleStartEditTopic(topic) }}
                              >
                                <Pencil className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                              </Button>
                              <Badge variant="secondary">{(topic.score * 100).toFixed(0)}分</Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-xs text-muted-foreground">{topic.reason}</p>
                        </CardContent>
                      </>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ References ═══ */}
      {project.selectedTopicId && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> 参考内容
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowReference(!showReference)}>
                {showReference ? "收起" : "展开"}
              </Button>
            </div>
            <CardDescription>添加同类爆款视频的文案或字幕，系统会分析其结构和钩子</CardDescription>
          </CardHeader>
          {showReference && (
            <CardContent className="space-y-3">
              {refItems.map((item, idx) => (
                <div key={idx} className="space-y-2 p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">参考 {idx + 1}</Label>
                      <div className="flex gap-1">
                        <Badge
                          variant={item.inputMode !== "douyin" ? "default" : "outline"}
                          className="cursor-pointer text-xs"
                          onClick={() => {
                            const next = [...refItems]
                            next[idx] = { ...next[idx], inputMode: "manual" }
                            setRefItems(next)
                          }}
                        >
                          <Pencil className="w-2.5 h-2.5 mr-0.5" />
                          手动
                        </Badge>
                        <Badge
                          variant={item.inputMode === "douyin" ? "default" : "outline"}
                          className="cursor-pointer text-xs"
                          onClick={() => {
                            const next = [...refItems]
                            next[idx] = { ...next[idx], inputMode: "douyin" }
                            setRefItems(next)
                          }}
                        >
                          <Link2 className="w-2.5 h-2.5 mr-0.5" />
                          抖音链接
                        </Badge>
                      </div>
                    </div>
                    {refItems.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setRefItems(refItems.filter((_, i) => i !== idx))}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>

                  {/* Douyin link mode */}
                  {item.inputMode === "douyin" ? (
                    <DouyinUrlInput
                      onConfirm={(data: ConfirmedDouyinData) => {
                        const next = [...refItems]
                        next[idx] = {
                          ...next[idx],
                          title: data.title,
                          transcript: data.description,
                          url: data.url,
                          author: data.author,
                          metrics: data.metrics,
                          rawData: data.rawData as unknown as Record<string, unknown>,
                          inputMode: "manual", // switch back after extraction
                        }
                        setRefItems(next)
                        toast.success("抖音内容已提取到参考")
                      }}
                      onCancel={() => {
                        const next = [...refItems]
                        next[idx] = { ...next[idx], inputMode: "manual" }
                        setRefItems(next)
                      }}
                    />
                  ) : (
                    <>
                      {item.url && (
                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Link2 className="w-3 h-3 shrink-0" />
                          {item.url}
                        </div>
                      )}
                      <Input
                        placeholder="参考视频标题"
                        value={item.title}
                        onChange={e => {
                          const next = [...refItems]
                          next[idx] = { ...next[idx], title: e.target.value }
                          setRefItems(next)
                        }}
                      />
                      <Textarea
                        placeholder="粘贴视频文案或字幕"
                        rows={3}
                        value={item.transcript}
                        onChange={e => {
                          const next = [...refItems]
                          next[idx] = { ...next[idx], transcript: e.target.value }
                          setRefItems(next)
                        }}
                      />
                    </>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setRefItems([...refItems, { title: "", transcript: "" }])}>
                  <Plus className="w-3 h-3 mr-1" /> 添加参考
                </Button>
                <Button size="sm" onClick={handleSaveReferences}>保存参考</Button>
              </div>
              {savedRefIds.length > 0 && (
                <p className="text-xs text-muted-foreground">已保存 {savedRefIds.length} 条参考</p>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* ═══ Script Generation ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" /> 台本生成
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {project.selectedTopicId
              ? "基于已选择的选题和参考内容，通过多 Agent 协作生成完整台本（包含台词、钩子、情绪、画面和 BGM 建议）"
              : "请先选择选题"}
          </p>
          {project.scriptVersions && project.scriptVersions.length > 0 && (
            <Link href={`/projects/${projectId}/script`} className="text-sm text-primary hover:underline mt-2 block">
              查看已有台本 →
            </Link>
          )}
          <Button onClick={handleGenerateScript} disabled={!project.selectedTopicId || generatingScript} size="sm">
            {generatingScript ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> 多 Agent 生成中...</> : "生成完整台本"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}



