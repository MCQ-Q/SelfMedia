"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Plus, FolderOpen, Trash2, Loader2 } from "lucide-react"

interface ProjectSummary {
  id: string
  title: string
  status: string
  targetPlatform: string
  videoType: string
  durationSeconds: number
  createdAt: string
}

const platformLabels: Record<string, string> = {
  douyin: "抖音",
  xiaohongshu: "小红书",
  bilibili: "B站",
  video_account: "视频号",
}

const statusLabels: Record<string, string> = {
  draft: "草稿",
  material_input: "素材录入",
  topic_ready: "已选选题",
  script_ready: "台本就绪",
  exported: "已导出",
}

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  material_input: "outline",
  topic_ready: "secondary",
  script_ready: "default",
  exported: "default",
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadProjects = useCallback(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => setProjects(data.projects || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleDelete = async (e: React.MouseEvent, projectId: string, title: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!window.confirm(`确定要删除项目「${title}」吗？\n\n此操作不可撤销，所有关联的素材、选题、台本都会被删除。`)) return

    setDeletingId(projectId)
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.message || "删除失败")
        return
      }
      toast.success("已删除")
      setProjects((prev) => prev.filter((p) => p.id !== projectId))
    } catch (err) {
      console.error("Delete failed:", err)
      toast.error("网络错误，请重试")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">我的项目</h1>
          <p className="text-muted-foreground text-sm mt-1">AI 视频台本生成</p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="w-4 h-4 mr-1" />
            新建项目
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-32" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">还没有项目</h3>
            <p className="text-muted-foreground text-sm mb-4">
              创建你的第一个视频台本项目
            </p>
            <Link href="/projects/new">
              <Button>
                <Plus className="w-4 h-4 mr-1" />
                新建项目
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => (
            <div key={p.id} className="relative group">
              <Link href={`/projects/${p.id}/workbench`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{p.title}</CardTitle>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={statusVariant[p.status] || "outline"}>
                          {statusLabels[p.status] || p.status}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription>
                      {platformLabels[p.targetPlatform]} · {p.durationSeconds}秒
                      · {new Date(p.createdAt).toLocaleDateString("zh-CN")}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
              {(
                <button
                  onClick={(e) => handleDelete(e, p.id, p.title)}
                  disabled={deletingId === p.id}
                  className="absolute top-2 right-2 z-10 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  title="删除草稿"
                >
                  {deletingId === p.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
