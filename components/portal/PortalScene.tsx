"use client"

import { Canvas } from "@react-three/fiber"
import { Suspense, useEffect, useRef, useState } from "react"
import { useTexture } from "@react-three/drei"
import { VortexTunnel } from "./VortexTunnel"
import { ParticleSystem } from "./ParticleSystem"
import { CameraRig } from "./CameraRig"
import { usePortalProgress } from "@/hooks/usePortalProgress"
import type { PortalSceneProps, PortalPhase } from "./types"

// Separate component to handle texture loading (hooks can't be conditional)
function CityTexturedTunnel({
  progress,
  state,
  cityImage,
}: {
  progress: number
  state: ReturnType<typeof usePortalProgress>
  cityImage: string
}) {
  const texture = useTexture(cityImage)

  return (
    <VortexTunnel
      progress={progress}
      flashIntensity={state.flashIntensity}
      tunnelIntensity={state.tunnelIntensity}
      tunnelDepthScale={state.tunnelDepthScale}
      cityTexture={texture}
    />
  )
}

function PortalContent({
  progress,
  disablePostProcessing,
  cityImage,
  onPhaseChange,
}: {
  progress: number
  disablePostProcessing: boolean
  cityImage?: string
  onPhaseChange?: (phase: PortalPhase) => void
}) {
  const state = usePortalProgress(progress)
  const prevPhaseRef = useRef<PortalPhase>("dormant")

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
        suckInForce={state.suckInForce}
      />

      {cityImage ? (
        <CityTexturedTunnel
          progress={progress}
          state={state}
          cityImage={cityImage}
        />
      ) : (
        <VortexTunnel
          progress={progress}
          flashIntensity={state.flashIntensity}
          tunnelIntensity={state.tunnelIntensity}
          tunnelDepthScale={state.tunnelDepthScale}
        />
      )}

      <ParticleSystem
        progress={progress}
        particleSpeed={state.particleSpeed}
        particleStreakFactor={state.particleStreakFactor}
      />
    </>
  )
}

export function PortalScene({
  progress,
  className,
  style,
  onPhaseChange,
  disablePostProcessing = false,
  cityBg,
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
          near: 0.01,
          far: 100,
          position: [0, 0, 5],
        }}
      >
        <Suspense fallback={null}>
          <PortalContent
            progress={progress}
            disablePostProcessing={disablePostProcessing}
            onPhaseChange={onPhaseChange}
            cityImage={cityBg}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
