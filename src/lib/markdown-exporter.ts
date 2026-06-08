import type { ScriptContent } from "./schemas"

export interface SegmentWithTracks {
  id: string
  orderIndex: number
  startTime: number
  endTime: number
  segmentGoal: string
  dialogue: string
  subtitleText: string
  directorNote: string
  isLocked: boolean
  tracks: {
    trackType: string
    content: string // JSON string
  }[]
}

export interface ScriptVersionWithSegments {
  id: string
  title: string
  summary: string
  totalDurationSeconds: number
  versionNo: number
  status: string
  createdAt: Date
  segments: SegmentWithTracks[]
}

function parseTrack(tracks: SegmentWithTracks["tracks"], type: string): Record<string, unknown> | null {
  const track = tracks.find(t => t.trackType === type)
  if (!track) return null
  try {
    return JSON.parse(track.content)
  } catch {
    return null
  }
}

function escapeTableCell(value: string | undefined): string {
  return (value || "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>")
}

function renderMultilineNote(note: string): string {
  return note.split(/\r?\n/).map(line => `  ${line}`).join("\n")
}

export function renderMarkdownFromSegments(script: ScriptVersionWithSegments): string {
  const { title, totalDurationSeconds, summary, segments } = script

  let md = `# ${title}\n\n`
  md += `## 基本信息\n\n`
  md += `- 时长：${totalDurationSeconds} 秒\n`
  md += `- 版本：V${script.versionNo}\n`
  md += `- 创建时间：${script.createdAt.toISOString()}\n\n`
  md += `## 台本摘要\n\n${summary}\n\n`
  md += `## 分段台本\n\n`

  md += `| 时间 | 台词 | 字幕 | 画面 | 情绪 | BGM | 钩子 | 导演备注 |\n`
  md += `|---|---|---|---|---|---|---|---|\n`

  for (const seg of segments) {
    const time = `${seg.startTime}-${seg.endTime}s`
    const dialogue = escapeTableCell(seg.dialogue)
    const subtitle = escapeTableCell(seg.subtitleText)

    const visual = parseTrack(seg.tracks, "visual")
    const visualText = escapeTableCell(visual?.description?.toString())

    const emotion = parseTrack(seg.tracks, "emotion")
    const emotionText = emotion
      ? `${emotion.primary} (${emotion.intensity}/10)`
      : ""

    const bgm = parseTrack(seg.tracks, "bgm")
    const bgmText = escapeTableCell(bgm?.mood?.toString())

    const hook = parseTrack(seg.tracks, "hook")
    const hookText = escapeTableCell(hook?.type?.toString())

    const note = escapeTableCell(seg.directorNote)

    md += `| ${time} | ${dialogue} | ${subtitle} | ${visualText} | ${emotionText} | ${bgmText} | ${hookText} | ${note} |\n`
  }

  // Image/video prompts
  md += `\n## 图片/视频提示词\n\n`
  for (const seg of segments) {
    const visual = parseTrack(seg.tracks, "visual")
    if (visual?.imagePrompt) {
      md += `${seg.orderIndex}. [${seg.startTime}-${seg.endTime}s] ${visual.imagePrompt}\n`
    }
    if (visual?.videoPrompt) {
      md += `   Video: ${visual.videoPrompt}\n`
    }
  }

  // Hooks summary
  md += `\n## 剪辑备注\n\n`
  const hooks = segments
    .map(s => ({ seg: s, hook: parseTrack(s.tracks, "hook") }))
    .filter(h => h.hook)

  if (hooks.length > 0) {
    md += `### 钩子设计\n\n`
    for (const { seg, hook } of hooks) {
      md += `- **${hook!.type}** (${seg.startTime}-${seg.endTime}s): ${hook!.intent}\n`
    }
    md += `\n`
  }

  // BGM summary
  md += `### BGM/音效\n\n`
  for (const seg of segments) {
    const bgm = parseTrack(seg.tracks, "bgm")
    if (bgm) {
      const keywords = Array.isArray(bgm.keywords) ? bgm.keywords.join(", ") : ""
      const sfx = bgm.soundEffect
        ? ` | SFX: ${(bgm.soundEffect as Record<string, string>).type} @ ${(bgm.soundEffect as Record<string, string>).timing}`
        : ""
      md += `- [${seg.startTime}-${seg.endTime}s] ${bgm.mood} (${bgm.bpmRange})${sfx}${keywords ? ` — ${keywords}` : ""}\n`
    }
  }

  md += `\n### 导演备注汇总\n\n`
  for (const seg of segments) {
    if (seg.directorNote) {
      md += `- [${seg.startTime}-${seg.endTime}s]\n${renderMultilineNote(seg.directorNote)}\n`
    }
  }

  return md
}

// Backward compat: render from old ScriptContent format
export function renderMarkdown(script: ScriptContent): string {
  const { title, durationSeconds, summary, segments } = script

  let md = `# ${title}\n\n`
  md += `## 基本信息\n\n`
  md += `- 时长：${durationSeconds} 秒\n\n`
  md += `## 台本摘要\n\n${summary}\n\n`
  md += `## 分段台本\n\n`

  md += `| 时间 | 台词 | 字幕 | 画面 | 情绪 | BGM | 导演备注 |\n`
  md += `|---|---|---|---|---|---|---|\n`

  for (const seg of segments) {
    const time = `${seg.startTime}-${seg.endTime}s`
    const dialogue = escapeTableCell(seg.dialogue)
    const subtitle = escapeTableCell(seg.subtitleText)
    const visual = escapeTableCell(seg.visual?.description)
    const emotion = seg.emotion
      ? `${seg.emotion.primary} (${seg.emotion.intensity}/10)`
      : ""
    const bgm = escapeTableCell(seg.bgm?.mood)
    const note = escapeTableCell(seg.directorNote)

    md += `| ${time} | ${dialogue} | ${subtitle} | ${visual} | ${emotion} | ${bgm} | ${note} |\n`
  }

  md += `\n## 图片/视频提示词\n\n`
  for (const seg of segments) {
    if (seg.visual?.imagePrompt) {
      md += `${seg.orderIndex}. [${seg.startTime}-${seg.endTime}s] ${seg.visual.imagePrompt}\n`
    }
  }

  md += `\n## 剪辑备注\n\n`
  const hooks = segments.filter((s) => s.hook)
  if (hooks.length > 0) {
    md += `### 钩子设计\n\n`
    for (const h of hooks) {
      md += `- **${h.hook!.type}** (${h.startTime}-${h.endTime}s): ${h.hook!.intent}\n`
    }
    md += `\n`
  }

  md += `### 导演备注汇总\n\n`
  for (const seg of segments) {
    if (seg.directorNote) {
      md += `- [${seg.startTime}-${seg.endTime}s]\n${renderMultilineNote(seg.directorNote)}\n`
    }
  }

  return md
}
