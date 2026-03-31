"use client"

import { useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

interface CameraRigProps {
  cameraZ: number
  cameraFov: number
  shakeIntensity: number
}

export function CameraRig({ cameraZ, cameraFov, shakeIntensity }: CameraRigProps) {
  const { camera } = useThree()
  const targetZ = useRef(4)
  const targetFov = useRef(75)

  useFrame((state, delta) => {
    // Faster lerp = snappier camera response
    const lerpFactor = Math.min(delta * 8, 1)

    targetZ.current += (cameraZ - targetZ.current) * lerpFactor
    targetFov.current += (cameraFov - targetFov.current) * lerpFactor

    const cam = camera as THREE.PerspectiveCamera
    cam.fov = targetFov.current
    cam.updateProjectionMatrix()

    let shakeX = 0
    let shakeY = 0
    let lurchZ = 0
    if (shakeIntensity > 0) {
      const time = state.clock.elapsedTime
      shakeX =
        (Math.sin(time * 13.7) + Math.sin(time * 23.1) * 0.5) * shakeIntensity
      shakeY =
        (Math.cos(time * 17.3) + Math.cos(time * 29.7) * 0.5) * shakeIntensity

      // Forward lurches during intense shake (sells the pull)
      if (shakeIntensity > 0.05) {
        lurchZ = Math.sin(time * 7.3) * shakeIntensity * 0.4
      }
    }

    camera.position.set(shakeX, shakeY, targetZ.current + lurchZ)
    camera.lookAt(0, 0, -100)
  })

  return null
}
