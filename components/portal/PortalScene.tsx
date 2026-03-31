"use client"

import { Canvas } from "@react-three/fiber"
import { Suspense, useEffect, useRef, useState } from "react"
import { VortexTunnel } from "./VortexTunnel"
import { ParticleSystem } from "./ParticleSystem"
import { CameraRig } from "./CameraRig"
import { PortalPostProcessing } from "./PostProcessing"
import { usePortalProgress } from "@/hooks/usePortalProgress"
import type { PortalSceneProps, PortalPhase } from "./types"

function PortalContent({
  progress,
  disablePostProcessing,
  onPhaseChange,
}: {
  progress: number
  disablePostProcessing: boolean
  onPhaseChange?: (phase: PortalPhase) => void
}) {
  const state = usePortalProgress(progress)
  const prevPhaseRef = useRef<PortalPhase>("dormant")
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
  }, [])

  useEffect(() => {
    if (state.phase !== prevPhaseRef.current) {
      prevPhaseRef.current = state.phase
      onPhaseChange?.(state.phase)
    }
  }, [state.phase, onPhaseChange])

  return (
    <>
      <CameraRig
        cameraZ={state.cameraZ}
        cameraFov={state.cameraFov}
        shakeIntensity={state.shakeIntensity}
      />

      <VortexTunnel
        progress={progress}
        flashIntensity={state.flashIntensity}
        tunnelIntensity={state.tunnelIntensity}
        tunnelDepthScale={state.tunnelDepthScale}
      />

      <ParticleSystem
        progress={progress}
        particleSpeed={state.particleSpeed}
        particleStreakFactor={state.particleStreakFactor}
      />

      {/* PostProcessing disabled - shader vignette replaces it */}
    </>
  )
}

export function PortalScene({
  progress,
  className,
  style,
  onPhaseChange,
  disablePostProcessing = false,
}: PortalSceneProps) {
  return (
    <div
      className={className}
      style={{ background: "#000", width: "100%", height: "100%", ...style }}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        camera={{
          fov: 75,
          near: 0.1,
          far: 100,
          position: [0, 0, 5],
        }}
      >
        <Suspense fallback={null}>
          <PortalContent
            progress={progress}
            disablePostProcessing={disablePostProcessing}
            onPhaseChange={onPhaseChange}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
