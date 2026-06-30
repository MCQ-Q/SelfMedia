"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  X, ChevronLeft, ChevronRight, Play, Pause,
  Maximize2, Minimize2, Monitor,
} from "lucide-react"

// ─── Types ───

export interface TeleprompterSegment {
  id: string
  orderIndex: number
  startTime: number
  endTime: number
  dialogue: string
  subtitleText: string
  segmentGoal: string
}

interface TeleprompterProps {
  segments: TeleprompterSegment[]
  title?: string
  open: boolean
  onClose: () => void
}

// ─── Component ───

export function Teleprompter({ segments, title, open, onClose }: TeleprompterProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [fontSize, setFontSize] = useState(48) // starting font size in px
  const [contentWidth, setContentWidth] = useState(50) // percentage of screen width, 30-90
  const [speedStep, setSpeedStep] = useState(9) // 0-29, step 9 = 1.0x
  const speedMultiplier = 0.1 + speedStep * 0.1 // 0.1x – 3.0x
  const [autoPlay, setAutoPlay] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const animFrameRef = useRef<number | null>(null)
  const scrollPosRef = useRef(0) // precise float scroll position for sub-pixel accumulation
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const totalSegments = segments.length
  const currentSegment = segments[currentIndex]

  // ─── Keyboard controls ───

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault()
          if (currentIndex < totalSegments - 1) setCurrentIndex((i) => i + 1)
          break
        case " ":
          e.preventDefault()
          setAutoPlay((prev) => !prev)
          break
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault()
          if (currentIndex > 0) setCurrentIndex((i) => i - 1)
          break
        case "Escape":
          onClose()
          break
        case "+":
        case "=":
          setFontSize((s) => Math.min(s + 4, 120))
          break
        case "-":
          setFontSize((s) => Math.max(s - 4, 16))
          break
        case "0":
          setFontSize(48) // reset
          break
        case ",":
          setSpeedStep((s) => Math.max(s - 1, 0))
          break
        case ".":
          setSpeedStep((s) => Math.min(s + 1, 29))
          break
        case "[":
          setContentWidth((w) => Math.max(w - 5, 30))
          break
        case "]":
          setContentWidth((w) => Math.min(w + 5, 90))
          break
        case "f":
        case "F":
          if (document.fullscreenElement) {
            document.exitFullscreen()
          } else {
            containerRef.current?.requestFullscreen()
          }
          break
      }
    },
    [currentIndex, totalSegments, onClose]
  )

  useEffect(() => {
    if (open) {
      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }
  }, [open, handleKeyDown])

  // ─── Auto-play: smooth scroll ───

  // Reset scroll when segment changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
      scrollPosRef.current = 0
    }
  }, [currentIndex])

  useEffect(() => {
    if (!autoPlay || !open || !currentSegment) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      return
    }

    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const duration = currentSegment.endTime - currentSegment.startTime
    const segmentDurationMs = Math.max(duration * 1000, 2000)
    let lastTick = performance.now()

    // Sync float ref with current DOM position on start/resume
    scrollPosRef.current = scrollEl.scrollTop

    const tick = () => {
      const now = performance.now()
      const delta = now - lastTick
      lastTick = now

      const maxScroll = Math.max(scrollEl.scrollHeight - scrollEl.clientHeight, 0)
      if (maxScroll <= 0) {
        animFrameRef.current = requestAnimationFrame(tick)
        return
      }

      const scrollSpeed = (maxScroll / segmentDurationMs) * speedMultiplier
      scrollPosRef.current += delta * scrollSpeed

      if (scrollPosRef.current >= maxScroll) {
        // Segment finished — advance to next
        if (currentIndex < totalSegments - 1) {
          setCurrentIndex((i) => i + 1)
        } else {
          setAutoPlay(false)
          scrollEl.scrollTop = 0
          scrollPosRef.current = 0
          return
        }
      } else {
        scrollEl.scrollTop = scrollPosRef.current
        animFrameRef.current = requestAnimationFrame(tick)
      }
    }

    animFrameRef.current = requestAnimationFrame(tick)
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [autoPlay, open, currentIndex, totalSegments, currentSegment, speedMultiplier])

  // ─── Auto-hide controls ───

  const handleMouseMove = useCallback(() => {
    setShowControls(true)
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current)
    hideControlsTimer.current = setTimeout(() => setShowControls(false), 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  // ─── Reset index on open ───

  useEffect(() => {
    if (open) setCurrentIndex(0)
  }, [open])

  if (!open || !currentSegment) return null

  const progressPercent = ((currentIndex + 1) / totalSegments) * 100

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center select-none"
      onMouseMove={handleMouseMove}
    >
      {/* ─── Top bar (auto-hide) ─── */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 flex items-center justify-between transition-opacity duration-500 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.85), transparent)" }}
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-900 hover:bg-gray-100"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
          {title && (
            <span className="text-gray-400 text-sm hidden sm:inline">{title}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Progress dots */}
          <div className="hidden sm:flex items-center gap-1.5 mr-3">
            {segments.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === currentIndex ? "bg-gray-800" : "bg-gray-300"
                }`}
              />
            ))}
          </div>

          <Badge variant="outline" className="text-gray-600 border-gray-300 bg-transparent text-xs">
            {currentIndex + 1} / {totalSegments}
          </Badge>

          {/* Font size controls */}
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-900 hover:bg-gray-100 text-xs"
            onClick={(e) => { e.stopPropagation(); setFontSize((s) => Math.max(s - 4, 16)) }}
            title="缩小字体 (-)"
          >
            A-
          </Button>
          <span className="text-gray-400 text-xs w-8 text-center">{fontSize}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-900 hover:bg-gray-100 text-xs"
            onClick={(e) => { e.stopPropagation(); setFontSize((s) => Math.min(s + 4, 120)) }}
            title="放大字体 (+)"
          >
            A+
          </Button>

          {/* Content width controls */}
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-900 hover:bg-gray-100 text-xs"
            onClick={(e) => { e.stopPropagation(); setContentWidth((w) => Math.max(w - 5, 30)) }}
            title="缩窄行宽 ([)"
          >
            ↔-
          </Button>
          <span className="text-gray-400 text-xs w-10 text-center">{contentWidth}%</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-900 hover:bg-gray-100 text-xs"
            onClick={(e) => { e.stopPropagation(); setContentWidth((w) => Math.min(w + 5, 90)) }}
            title="加宽行宽 (])"
          >
            ↔+
          </Button>

          {/* Scroll speed controls */}
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-900 hover:bg-gray-100 text-xs"
            onClick={(e) => { e.stopPropagation(); setSpeedStep((s) => Math.max(s - 1, 0)) }}
            title="减速 (,) — 滚动变慢"
          >
            🐢
          </Button>
          <span className="text-gray-400 text-xs w-10 text-center">{speedMultiplier.toFixed(2)}x</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-900 hover:bg-gray-100 text-xs"
            onClick={(e) => { e.stopPropagation(); setSpeedStep((s) => Math.min(s + 1, 29)) }}
            title="加速 (.) — 滚动变快"
          >
            🐇
          </Button>

          {/* Fullscreen toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-900 hover:bg-gray-100"
            onClick={(e) => {
              e.stopPropagation()
              if (document.fullscreenElement) {
                document.exitFullscreen()
              } else {
                containerRef.current?.requestFullscreen()
              }
            }}
          >
            <Maximize2 className="w-4 h-4" />
          </Button>

          {/* Auto-play toggle */}
          <Button
            variant={autoPlay ? "default" : "ghost"}
            size="sm"
            className={autoPlay ? "" : "text-gray-400 hover:text-gray-900 hover:bg-gray-100"}
            onClick={(e) => { e.stopPropagation(); setAutoPlay(!autoPlay) }}
          >
            {autoPlay ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
            {autoPlay ? "暂停" : "自动"}
          </Button>
        </div>
      </div>

      {/* ─── Main content (scrollable) ─── */}
      <div
        ref={scrollRef}
        className="flex-1 w-full overflow-y-auto px-4"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#d1d5db transparent" }}
      >
        <div
          className="flex flex-col items-center mx-auto"
          style={{ maxWidth: `${contentWidth}%`, paddingTop: "35vh", paddingBottom: "80vh" }}
        >
          {/* Segment meta */}
          <div className="mb-6 text-gray-400 text-sm flex items-center gap-3 flex-wrap justify-center">
            <span>第 {currentSegment.orderIndex} 段</span>
            <span>·</span>
            <span>{currentSegment.startTime}s – {currentSegment.endTime}s</span>
            <span>·</span>
            <span>{currentSegment.segmentGoal}</span>
          </div>

          {/* Dialogue */}
          <div
            className="text-center w-full leading-relaxed transition-all duration-200"
            style={{
              fontSize: `${fontSize}px`,
              color: "#111827",
              fontWeight: 600,
              lineHeight: 1.6,
              letterSpacing: "0.02em",
              wordBreak: "break-word",
            }}
          >
            {currentSegment.dialogue || currentSegment.subtitleText || (
              <span className="text-gray-300">（无台词内容）</span>
            )}
          </div>

          {/* Subtitle preview (if dialogue exists and subtitle is different) */}
          {currentSegment.subtitleText && currentSegment.dialogue !== currentSegment.subtitleText && (
            <div
              className="mt-8 text-gray-400 text-center"
              style={{ fontSize: `${Math.max(fontSize * 0.5, 14)}px` }}
            >
              {currentSegment.subtitleText}
            </div>
          )}
        </div>
      </div>

      {/* ─── Bottom bar ─── */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between transition-opacity duration-500 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ background: "linear-gradient(to top, rgba(255,255,255,0.85), transparent)" }}
      >
        <div className="text-gray-400 text-xs hidden sm:block">
          快捷键: ← → 进退 · 空格 暂停/播放 · , . 调速 · +/- 字号 · [ ] 行宽 · 滚轮 滚动 · F 全屏
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-900 hover:bg-gray-100"
            disabled={currentIndex === 0}
            onClick={(e) => { e.stopPropagation(); setCurrentIndex((i) => i - 1) }}
          >
            <ChevronLeft className="w-5 h-5 mr-1" /> 上一段
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-900 hover:bg-gray-100"
            disabled={currentIndex >= totalSegments - 1}
            onClick={(e) => { e.stopPropagation(); setCurrentIndex((i) => i + 1) }}
          >
            下一段 <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>
      </div>

      {/* ─── Progress bar ─── */}
      <div className="absolute bottom-0 left-0 h-0.5 bg-gray-200 w-full">
        <div
          className="h-full bg-gray-400 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  )
}
