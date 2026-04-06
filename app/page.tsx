"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import gsap from "gsap"
import { PortalScene } from "@/components/portal/PortalScene"
import { Globe } from "@/components/portal/Globe"
import type { PortalPhase } from "@/components/portal/types"

const CITY_BG = "/images/bg-image.jpeg"

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

  useEffect(() => {
    if (!isPlaying) return

    function tick() {
      const audio = audioRef.current
      if (!audio || audio.paused) return

      const simulatedDur = 7.0
      const current = Math.min(audio.currentTime, simulatedDur)
      let p = current / simulatedDur

      if (p >= 1.0) {
        p = 1.0
        audio.pause()
        setIsPlaying(false)
      }

      setProgress(p)

      if (p < 1.0) {
        animFrameRef.current = requestAnimationFrame(tick)
      }
    }

    animFrameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isPlaying])

  // At 0.98: portal canvas fades out, high-res city + text fades in
  useEffect(() => {
    if (progress >= 0.98 && !hasTriggeredRef.current && isPlaying) {
      hasTriggeredRef.current = true

      const tl = gsap.timeline()

      if (controlsRef.current) {
        tl.to(controlsRef.current, { opacity: 0, duration: 0.15 })
      }

      // Fade out the WebGL canvas
      if (portalRef.current) {
        tl.to(
          portalRef.current,
          {
            opacity: 0,
            duration: 0.5,
            ease: "power2.in",
          },
          0
        )
      }

      // Circle-wipe reveal the high-res city + text
      if (newWorldRef.current) {
        tl.fromTo(
          newWorldRef.current,
          { opacity: 1, clipPath: "circle(0% at 50% 50%)", scale: 1.05 },
          {
            clipPath: "circle(150% at 50% 50%)",
            scale: 1,
            duration: 1.2,
            ease: "power3.inOut",
          },
          0
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
          gsap.set(portalRef.current, { opacity: 1, scale: 1, filter: "none" })
        }
        if (newWorldRef.current) {
          gsap.set(newWorldRef.current, {
            opacity: 0,
            clipPath: "circle(0% at 50% 50%)",
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
      {/* Portal — WebGL canvas handles tunnel + city preview in center */}
      <div ref={portalRef} className="absolute inset-0">
        <PortalScene
          progress={progress}
          onPhaseChange={setPhase}
          className="absolute inset-0"
          cityBg={CITY_BG}
        />
      </div>

      {/* High-res city reveal (circle-wipe after WebGL transition) */}
      <div
        ref={newWorldRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{ opacity: 0, clipPath: "circle(0% at 50% 50%)" }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${CITY_BG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <h1 className="mb-2 font-mono text-5xl font-bold tracking-wider text-white drop-shadow-lg">
            GATEWAY OPEN
          </h1>
          <p className="mb-12 font-mono text-lg tracking-wide text-purple-400">
            Welcome to 3024
          </p>
          {/* <Globe /> */}
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
