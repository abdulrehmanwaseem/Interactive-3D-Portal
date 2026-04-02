"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import gsap from "gsap"
import { PortalScene } from "@/components/portal/PortalScene"
import { Globe } from "@/components/portal/Globe"
import type { PortalPhase } from "@/components/portal/types"

// Space image for the "new world" after portal transition
const SPACE_BG =
  "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&q=80"

export default function Page() {
  const [progress, setProgress] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [phase, setPhase] = useState<PortalPhase>("dormant")
  const [mode, setMode] = useState<"audio" | "slider">("audio")
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animFrameRef = useRef<number>(0)
  const hasTriggeredRef = useRef(false)
  const portalRef = useRef<HTMLDivElement>(null)
  const newWorldRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)

  // Audio progress loop
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

  // GSAP transition at flash peak: portal → new world (no CSS scale — shader handles depth)
  useEffect(() => {
    if (progress >= 0.96 && !hasTriggeredRef.current && isPlaying) {
      hasTriggeredRef.current = true

      const tl = gsap.timeline()

      // Fade out controls
      if (controlsRef.current) {
        tl.to(controlsRef.current, { opacity: 0, duration: 0.15 })
      }

      // Portal fades to white (shader flash handles the visual, GSAP handles the crossfade)
      if (portalRef.current) {
        tl.to(portalRef.current, {
          filter: "brightness(4)",
          opacity: 0,
          duration: 0.6,
          ease: "power2.in",
        }, "-=0.1")
      }

      // New world emerges from the white
      if (newWorldRef.current) {
        tl.fromTo(
          newWorldRef.current,
          { opacity: 0, scale: 1.1, filter: "brightness(3) blur(6px)" },
          {
            opacity: 1,
            scale: 1,
            filter: "brightness(1) blur(0px)",
            duration: 1.8,
            ease: "power3.out",
          },
          "-=0.3"
        )
      }
    }
  }, [progress, isPlaying])

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
      if (audioRef.current.ended || progress >= 0.49) {
        audioRef.current.currentTime = 0
        setProgress(0)
        hasTriggeredRef.current = false
        // Reset styles
        if (portalRef.current) {
          gsap.killTweensOf(portalRef.current)
          gsap.set(portalRef.current, { opacity: 1, filter: "none" })
        }
        if (newWorldRef.current) {
          gsap.set(newWorldRef.current, {
            opacity: 0,
            scale: 1,
            filter: "none",
          })
        }
        if (controlsRef.current) controlsRef.current.style.opacity = "1"
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
      {/* Portal */}
      <div ref={portalRef} className="absolute inset-0">
        <PortalScene
          progress={progress}
          onPhaseChange={setPhase}
          className="absolute inset-0"
        />
      </div>

      {/* New world: space image (always in DOM, hidden via opacity) */}
      <div
        ref={newWorldRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{ opacity: 0 }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${SPACE_BG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <h1 className="mb-2 font-mono text-5xl font-bold tracking-wider text-white drop-shadow-lg">
            GATEWAY OPEN
          </h1>
          <p className="mb-6 font-mono text-lg tracking-wide text-purple-300/80">
            Welcome to 3024
          </p>
          <Globe />
        </div>
      </div>

      {/* Controls */}
      <div
        ref={controlsRef}
        className="absolute right-0 bottom-0 left-0 z-10 flex flex-col items-center gap-4 p-6"
      >
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
