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
  ChevronDown, ChevronRight, Clock,
} from "lucide-react"

// ─── Interfaces ───

interface SourceMaterialItem {
  id: string
  type: string
  contentEncrypted: string
  contentPreview: string
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
  const [generatingScript, setGeneratingScript] = useState(false)
  const [showReference, setShowReference] = useState(false)
  const [refItems, setRefItems] = useState<{ title: string; transcript: string }[]>([{ title: "", transcript: "" }])
  const [savedRefIds, setSavedRefIds] = useState<string[]>([])

  // Source material state
  const [showAddMaterial, setShowAddMaterial] = useState(false)
  const [newMaterialType, setNewMaterialType] = useState("note")
  const [newMaterialContent, setNewMaterialContent] = useState("")
  const [savingMaterial, setSavingMaterial] = useState(false)
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set())
  const [fullMaterials, setFullMaterials] = useState<Record<string, string>>({})
  const [loadingFullMaterial, setLoadingFullMaterial] = useState<Set<string>>(new Set())

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
      const res = await fetch(`/api/projects/${projectId}/source-materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMaterialContent, type: newMaterialType }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.message || "保存失败"); return }
      toast.success("素材已保存")
      setNewMaterialContent("")
      setShowAddMaterial(false)
      loadProject()
    } catch {
      toast.error("网络错误")
    } finally {
      setSavingMaterial(false)
    }
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

  // ─── References ───

  const handleSaveReferences = async () => {
    const valid = refItems.filter(r => r.transcript.trim())
    if (valid.length === 0) { toast.error("至少填写一个参考内容"); return }
    try {
      const res = await fetch(`/api/projects/${projectId}/references/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: valid }),
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
              <Textarea
                placeholder="粘贴聊天记录、个人感悟、灵感片段或已有文案..."
                rows={6}
                value={newMaterialContent}
                onChange={e => setNewMaterialContent(e.target.value)}
              />
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
                return (
                  <Card
                    key={topic.id}
                    className={`cursor-pointer transition-colors ${isSelected ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"}`}
                    onClick={() => handleSelectTopic(topic.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm flex items-center gap-2">
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                            {topic.title}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {topic.coreConflict} · {topic.emotionalTone} · 受众: {topic.targetAudience}
                          </CardDescription>
                        </div>
                        <Badge variant="secondary" className="shrink-0">{(topic.score * 100).toFixed(0)}分</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground">{topic.reason}</p>
                    </CardContent>
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
                    <Label className="text-xs">参考 {idx + 1}</Label>
                    {refItems.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setRefItems(refItems.filter((_, i) => i !== idx))}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
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
