"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { PortalScene } from "@/components/portal/PortalScene"
import type { PortalPhase } from "@/components/portal/types"

export default function Page() {
  const [progress, setProgress] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [phase, setPhase] = useState<PortalPhase>("dormant")
  const [mode, setMode] = useState<"audio" | "slider">("audio")
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animFrameRef = useRef<number>(0)

  // Audio progress loop using useEffect to avoid ref-during-render issues
  useEffect(() => {
    if (!isPlaying) return

    function tick() {
      const audio = audioRef.current
      if (!audio || audio.paused) return
      const dur = audio.duration
      if (dur && !isNaN(dur) && dur > 0) {
        setProgress(Math.min(Math.max(audio.currentTime / dur, 0), 1))
      }
      animFrameRef.current = requestAnimationFrame(tick)
    }

    animFrameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isPlaying])

  const handlePlay = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/audios/sound_effect.m4a")
      audioRef.current.addEventListener("ended", () => {
        setIsPlaying(false)
        setProgress(1)
      })
    }

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      if (audioRef.current.ended || progress >= 0.99) {
        audioRef.current.currentTime = 0
        setProgress(0)
      }
      audioRef.current.play()
      setIsPlaying(true)
    }
  }, [isPlaying, progress])

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current)
      audioRef.current?.pause()
    }
  }, [])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <PortalScene
        progress={progress}
        onPhaseChange={setPhase}
        className="absolute inset-0"
      />

      <div className="absolute right-0 bottom-0 left-0 z-10 flex flex-col items-center gap-4 p-6">
        <div className="rounded-full bg-white/10 px-4 py-1 font-mono text-xs tracking-widest text-white/60 uppercase backdrop-blur-sm">
          {phase} &mdash; {(progress * 100).toFixed(1)}%
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setMode("audio")}
            className={`rounded-lg px-3 py-1 font-mono text-xs transition-colors ${
              mode === "audio"
                ? "bg-violet-600 text-white"
                : "bg-white/10 text-white/50 hover:bg-white/20"
            }`}
          >
            Audio Sync
          </button>
          <button
            onClick={() => setMode("slider")}
            className={`rounded-lg px-3 py-1 font-mono text-xs transition-colors ${
              mode === "slider"
                ? "bg-violet-600 text-white"
                : "bg-white/10 text-white/50 hover:bg-white/20"
            }`}
          >
            Manual Slider
          </button>
        </div>

        {mode === "audio" ? (
          <button
            onClick={handlePlay}
            className="rounded-xl bg-violet-600 px-8 py-3 font-mono text-sm font-bold text-white transition-all hover:scale-105 hover:bg-violet-500 active:scale-95"
          >
            {isPlaying
              ? "PAUSE"
              : progress >= 0.99
                ? "REPLAY"
                : "ENTER THE PORTAL"}
          </button>
        ) : (
          <div className="flex w-full max-w-md items-center gap-4">
            <span className="font-mono text-xs text-white/40">0</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={progress}
              onChange={(e) => setProgress(parseFloat(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-violet-500"
            />
            <span className="font-mono text-xs text-white/40">1</span>
          </div>
        )}
      </div>
    </div>
  )
}
