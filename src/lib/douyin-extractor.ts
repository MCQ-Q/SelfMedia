/**
 * Douyin video info extractor.
 *
 * Strategy:
 *   Tier 1 — Resolve short link → extract video ID → call douyin.com web API.
 *   Tier 2 — Optional third-party API (DOUYIN_EXTRACT_API env var).
 *   Tier 3 — Degraded: return what we have with warnings, never throw.
 *
 * The douyin API returns rich text data:
 *   - desc: full caption/description written by the creator
 *   - item_title: clean title (no hashtags)
 *   - text_extra: parsed hashtags with positions
 *   - video_tag: category tags (e.g. "个人管理 > 情感心理 > 励志/鸡汤")
 *   - share_info: share text in various formats
 *   - caption: hashtags only
 */

// ─── Types ───

export interface DouyinExtractResult {
  resolvedUrl: string
  /** Clean title without hashtags (item_title from API) */
  title: string | null
  /** Full caption / description written by the creator */
  description: string | null
  /** Author nickname */
  author: string | null
  /** Author unique ID (handle) */
  authorId: string | null
  /** Cover image URL */
  coverUrl: string | null
  /** Hashtags extracted from the description */
  hashtags: string[]
  /** Category tags (e.g. "个人管理", "励志/鸡汤") */
  tags: string[]
  /** Video duration in milliseconds */
  durationMs: number
  /** Engagement metrics */
  metrics: Record<string, number>
  /** How the data was extracted */
  extractionMethod: "web_api" | "third_party_api"
  /** Pre-formatted content suitable for saving as source material */
  formattedContent: string
  /** Non-blocking warnings */
  warnings: string[]
}

// ─── Constants ───

const DOUYIN_HOSTS = [
  "v.douyin.com", "www.douyin.com", "douyin.com",
  "www.iesdouyin.com", "iesdouyin.com",
]

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"

const FETCH_TIMEOUT_MS = 12_000

// ─── URL validation ───

function validateDouyinUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    const host = url.hostname.replace(/^www\./, "")
    if (DOUYIN_HOSTS.some((h) => host === h || host.endsWith("." + h))) {
      return trimmed
    }
    return null
  } catch {
    return null
  }
}

// ─── Fetch with timeout ───

async function fetchWithTimeout(url: string, opts: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// ─── Extract video ID from various URL formats ───

function extractVideoId(url: string): string | null {
  // Pattern 1: /video/123456789
  let match = url.match(/\/video\/(\d+)/i)
  if (match) return match[1]

  // Pattern 2: /share/video/123456789/
  match = url.match(/\/share\/video\/(\d+)/i)
  if (match) return match[1]

  // Pattern 3: modal_id=123 or aweme_id=123 or item_id=123 in query
  match = url.match(/(?:modal_id|aweme_id|item_id)[=/](\d+)/i)
  if (match) return match[1]

  // Pattern 4: note_id=123 (notes format)
  match = url.match(/note_id[=/](\d+)/i)
  if (match) return match[1]

  return null
}

// ─── Tier 1: Douyin web API ───

interface DyTextExtra {
  hashtag_name?: string
  user_unique_id?: string
  type?: number
}

interface DyVideoTag {
  level?: number
  tag_id?: number
  tag_name?: string
}

interface DouyinApiResponse {
  aweme_detail?: {
    desc?: string
    item_title?: string
    caption?: string
    create_time?: number
    author?: {
      nickname?: string
      unique_id?: string
      uid?: string
    }
    statistics?: {
      digg_count?: number
      comment_count?: number
      share_count?: number
      collect_count?: number
    }
    video?: {
      cover?: { url_list?: string[] }
      duration?: number
    }
    share_info?: {
      share_title?: string
      share_desc?: string
      share_desc_info?: string
      share_link_desc?: string
    }
    text_extra?: DyTextExtra[]
    video_tag?: DyVideoTag[]
  }
}

function formatContent(result: DouyinExtractResult): string {
  const lines: string[] = []

  if (result.title) {
    lines.push(`标题：${result.title}`)
  }
  if (result.author) {
    const handle = result.authorId ? ` (@${result.authorId})` : ""
    lines.push(`作者：${result.author}${handle}`)
  }
  if (result.tags.length > 0) {
    lines.push(`分类：${result.tags.join(" > ")}`)
  }
  if (result.hashtags.length > 0) {
    lines.push(`话题：${result.hashtags.join("  ")}`)
  }
  lines.push("")
  if (result.description) {
    lines.push("【视频文案】")
    lines.push(result.description)
  }
  lines.push("")
  if (result.metrics.likes) {
    const metricsParts: string[] = []
    if (result.metrics.likes) metricsParts.push(`👍 ${formatNumber(result.metrics.likes)}`)
    if (result.metrics.comments) metricsParts.push(`💬 ${formatNumber(result.metrics.comments)}`)
    if (result.metrics.shares) metricsParts.push(`↗ ${formatNumber(result.metrics.shares)}`)
    lines.push(`数据：${metricsParts.join("  ")}`)
  }
  if (result.resolvedUrl) {
    lines.push(`链接：${result.resolvedUrl}`)
  }

  return lines.join("\n")
}

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + "万"
  if (n >= 1000) return (n / 1000).toFixed(1) + "k"
  return String(n)
}

async function fetchFromDouyinApi(videoId: string): Promise<DouyinExtractResult | null> {
  const warnings: string[] = []
  const canonicalUrl = `https://www.douyin.com/video/${videoId}`

  try {
    const apiUrl = `https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${videoId}`
    const res = await fetchWithTimeout(apiUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Referer: canonicalUrl,
        Accept: "application/json",
      },
    })

    if (!res.ok) {
      warnings.push(`API 返回状态码 ${res.status}`)
      return null
    }

    const data: DouyinApiResponse = await res.json()
    const aweme = data.aweme_detail
    if (!aweme) {
      warnings.push("API 未返回视频数据")
      return null
    }

    // ─── Extract all text fields ───

    // title: prefer item_title (clean), fall back to desc
    const title = aweme.item_title || aweme.desc?.replace(/#\S+/g, "").trim() || null
    const description = aweme.desc || null
    const author = aweme.author?.nickname || null
    const authorId = aweme.author?.unique_id || null
    const coverUrl = aweme.video?.cover?.url_list?.[0] || null
    const durationMs = aweme.video?.duration || 0

    // Hashtags from text_extra (parsed by douyin)
    const hashtags: string[] = []
    if (aweme.text_extra) {
      for (const item of aweme.text_extra) {
        if (item.hashtag_name && !hashtags.includes(item.hashtag_name)) {
          hashtags.push(`#${item.hashtag_name}`)
        }
      }
    }
    // Fallback: extract from description
    if (hashtags.length === 0 && description) {
      const rawTags = description.match(/#[^\s#]+/g)
      if (rawTags) hashtags.push(...rawTags)
    }

    // Category tags
    const tags: string[] = []
    if (aweme.video_tag) {
      for (const t of aweme.video_tag) {
        if (t.tag_name) tags.push(t.tag_name)
      }
    }

    // Metrics
    const metrics: Record<string, number> = {}
    if (aweme.statistics) {
      if (aweme.statistics.digg_count) metrics.likes = aweme.statistics.digg_count
      if (aweme.statistics.comment_count) metrics.comments = aweme.statistics.comment_count
      if (aweme.statistics.share_count) metrics.shares = aweme.statistics.share_count
    }

    // Warnings
    if (!description) warnings.push("未能提取视频文案")
    if (!author) warnings.push("未能提取作者信息")

    // Build result first, then format content
    const result: DouyinExtractResult = {
      resolvedUrl: canonicalUrl,
      title,
      description,
      author,
      authorId,
      coverUrl,
      hashtags,
      tags,
      durationMs,
      metrics,
      extractionMethod: "web_api",
      formattedContent: "", // filled below
      warnings,
    }
    result.formattedContent = formatContent(result)

    return result
  } catch (err) {
    warnings.push(`API 请求失败: ${err instanceof Error ? err.message : "网络错误"}`)
    return null
  }
}

// ─── Tier 1 helper: resolve short link to get video ID ───

async function resolveShortLink(shortUrl: string): Promise<{
  videoId: string | null
  canonicalUrl: string
  warnings: string[]
}> {
  const warnings: string[] = []

  // If it's already a douyin.com/video/... URL, extract ID directly
  const directId = extractVideoId(shortUrl)
  if (directId) {
    return {
      videoId: directId,
      canonicalUrl: `https://www.douyin.com/video/${directId}`,
      warnings,
    }
  }

  // Follow redirect to get the canonical URL
  try {
    const redirectRes = await fetchWithTimeout(shortUrl, {
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
    })

    const location = redirectRes.headers.get("location")
    let resolvedUrl = shortUrl

    if (location) {
      resolvedUrl = location.startsWith("http") ? location : `https:${location}`
    }

    const videoId = extractVideoId(resolvedUrl)

    if (!videoId) {
      warnings.push("未能从链接中解析出视频 ID")
    }

    return { videoId, canonicalUrl: resolvedUrl, warnings }
  } catch {
    warnings.push("无法解析短链重定向，尝试从原始链接提取")
    const videoId = extractVideoId(shortUrl)
    return { videoId, canonicalUrl: shortUrl, warnings }
  }
}

// ─── Tier 2: Third-party API ───

async function fetchFromThirdParty(rawUrl: string): Promise<Partial<DouyinExtractResult> | null> {
  const apiBase = process.env.DOUYIN_EXTRACT_API
  if (!apiBase) return null

  try {
    const res = await fetchWithTimeout(`${apiBase}?url=${encodeURIComponent(rawUrl)}`, {
      headers: { "User-Agent": USER_AGENT },
    })
    if (!res.ok) return null
    const data = await res.json()

    return {
      title: data.title || data.video_title || null,
      description: data.description || data.caption || data.desc || null,
      author: data.author || data.nickname || data.owner?.nickname || null,
      coverUrl: data.cover || data.cover_url || data.video_cover || null,
      metrics: data.statistics || data.stats || {},
    }
  } catch {
    return null
  }
}

// ─── Main export ───

export async function extractDouyinInfo(rawUrl: string): Promise<DouyinExtractResult> {
  const validUrl = validateDouyinUrl(rawUrl)
  if (!validUrl) {
    return buildErrorResult(
      rawUrl,
      ["无效的抖音链接，请输入 v.douyin.com 或 douyin.com 域名下的链接"]
    )
  }

  // Step 1: Resolve short link to get video ID
  const { videoId, canonicalUrl, warnings } = await resolveShortLink(validUrl)

  if (videoId) {
    // Tier 1: Use douyin web API
    const apiResult = await fetchFromDouyinApi(videoId)
    if (apiResult && apiResult.description) {
      apiResult.warnings = [...warnings, ...apiResult.warnings]
      return apiResult
    }

    if (apiResult) {
      apiResult.warnings = [...warnings, ...apiResult.warnings]
      apiResult.formattedContent = formatContent(apiResult)
      return apiResult
    }
  }

  // Tier 2: Try third-party API
  const tier2Data = await fetchFromThirdParty(validUrl)
  if (tier2Data) {
    const result: DouyinExtractResult = {
      resolvedUrl: canonicalUrl,
      title: tier2Data.title || null,
      description: tier2Data.description || null,
      author: tier2Data.author || null,
      authorId: null,
      coverUrl: tier2Data.coverUrl || null,
      hashtags: [],
      tags: [],
      durationMs: 0,
      metrics: (tier2Data.metrics as Record<string, number>) || {},
      extractionMethod: "third_party_api",
      formattedContent: "",
      warnings: warnings.length > 0 ? warnings : [],
    }
    result.formattedContent = formatContent(result)
    return result
  }

  // Tier 3: Degraded
  return buildErrorResult(canonicalUrl, [
    ...warnings,
    "未能提取视频信息，请确认链接有效并手动粘贴内容",
  ])
}

function buildErrorResult(url: string, warnings: string[]): DouyinExtractResult {
  return {
    resolvedUrl: url,
    title: null,
    description: null,
    author: null,
    authorId: null,
    coverUrl: null,
    hashtags: [],
    tags: [],
    durationMs: 0,
    metrics: {},
    extractionMethod: "web_api",
    formattedContent: "",
    warnings,
  }
}
