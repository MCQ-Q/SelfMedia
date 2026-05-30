"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { toast } from "sonner"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"

export default function NewProjectPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    title: "",
    targetPlatform: "douyin",
    videoType: "oral",
    durationSeconds: 60,
    sourceContent: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.title.trim()) {
      toast.error("请输入项目标题")
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        targetPlatform: form.targetPlatform,
        videoType: form.videoType,
        durationSeconds: form.durationSeconds,
      }
      // Only include source material if content is provided
      if (form.sourceContent.trim()) {
        body.sourceMaterial = { content: form.sourceContent, type: "note" }
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.message || "创建失败")
        return
      }

      toast.success("项目创建成功")
      router.push(`/projects/${data.projectId}/workbench`)
    } catch {
      toast.error("网络错误，请重试")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
      <Link href="/projects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-3 h-3 mr-1" />
        返回项目列表
      </Link>

      <h1 className="text-2xl font-bold mb-6">新建项目</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">项目标题</Label>
              <Input
                id="title"
                placeholder="给你的项目起个名字"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="platform">目标平台</Label>
                <Select
                  id="platform"
                  value={form.targetPlatform}
                  onChange={(e) => setForm({ ...form, targetPlatform: e.target.value })}
                >
                  <option value="douyin">抖音</option>
                  <option value="xiaohongshu">小红书</option>
                  <option value="bilibili">B站</option>
                  <option value="video_account">视频号</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="videoType">视频类型</Label>
                <Select
                  id="videoType"
                  value={form.videoType}
                  onChange={(e) => setForm({ ...form, videoType: e.target.value })}
                >
                  <option value="oral">口播</option>
                  <option value="story">故事</option>
                  <option value="knowledge">知识</option>
                  <option value="opinion">观点</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">目标时长 (秒)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={15}
                  max={300}
                  value={form.durationSeconds}
                  onChange={(e) =>
                    setForm({ ...form, durationSeconds: parseInt(e.target.value) || 60 })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">原始素材（可选）</CardTitle>
            <CardDescription>
              粘贴聊天记录、灵感笔记、已有文案等。也可以在创建后随时添加
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="在这里粘贴你的素材..."
              rows={10}
              value={form.sourceContent}
              onChange={(e) => setForm({ ...form, sourceContent: e.target.value })}
            />
          </CardContent>
        </Card>

        <Button type="submit" disabled={submitting} className="w-full" size="lg">
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              创建中...
            </>
          ) : (
            "创建项目"
          )}
        </Button>
      </form>
    </div>
  )
}
