"use client"

import { useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

interface CameraRigProps {
  cameraZ: number
  cameraFov: number
  shakeIntensity: number
  suckInForce: number
}

export function CameraRig({ cameraZ, cameraFov, shakeIntensity, suckInForce }: CameraRigProps) {
  const { camera } = useThree()
  const targetZ = useRef(4)
  const targetFov = useRef(75)

  // Physics state for the suck-in effect
  const velocityZ = useRef(0)
  const physicsZ = useRef<number | null>(null) // null = not active
  const lastSuckForce = useRef(0)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const time = state.clock.elapsedTime

    const cam = camera as THREE.PerspectiveCamera
    cam.near = 0.01

    // ========== DETECT SUCK-IN ACTIVATION / DEACTIVATION ==========
    const wasActive = lastSuckForce.current > 0.01
    const isActive = suckInForce > 0.01

    if (isActive && !wasActive) {
      physicsZ.current = targetZ.current
      velocityZ.current = 0
    }

    if (!isActive && wasActive) {
      physicsZ.current = null
      velocityZ.current = 0
      targetZ.current = cameraZ
    }

    lastSuckForce.current = suckInForce

    // ========== NORMAL MODE (target-based lerp) ==========
    if (!isActive || physicsZ.current === null) {
      const lerpFactor = Math.min(dt * 8, 1)
      targetZ.current += (cameraZ - targetZ.current) * lerpFactor
      targetFov.current += (cameraFov - targetFov.current) * lerpFactor

      cam.fov = targetFov.current
      cam.updateProjectionMatrix()

      let shakeX = 0
      let shakeY = 0
      let lurchZ = 0
      if (shakeIntensity > 0) {
        shakeX = (Math.sin(time * 13.7) + Math.sin(time * 23.1) * 0.5) * shakeIntensity
        shakeY = (Math.cos(time * 17.3) + Math.cos(time * 29.7) * 0.5) * shakeIntensity
        if (shakeIntensity > 0.05) {
          lurchZ = Math.sin(time * 7.3) * shakeIntensity * 0.4
        }
      }

      camera.position.set(shakeX, shakeY, targetZ.current + lurchZ)
      camera.lookAt(0, 0, -100)
      return
    }

    // ========== PHYSICS MODE (velocity-based pull) ==========
    const acceleration = -10.0 * suckInForce * suckInForce
    velocityZ.current += acceleration * dt
    velocityZ.current *= (1 - 1.5 * dt)
    physicsZ.current += velocityZ.current * dt

    // Clamp: follow cameraZ target as the floor (allows negative Z during arrival)
    physicsZ.current = Math.min(physicsZ.current, cameraZ + 0.3)
    physicsZ.current = Math.max(physicsZ.current, cameraZ - 0.5)

    // FOV jolt during intense pull
    const fovJolt = suckInForce > 0.8 ? (suckInForce - 0.8) * 40.0 : 0
    targetFov.current += (cameraFov + fovJolt - targetFov.current) * Math.min(dt * 10, 1)

    cam.fov = targetFov.current
    cam.updateProjectionMatrix()

    // Shake
    let shakeX = 0
    let shakeY = 0

    if (shakeIntensity > 0) {
      const lateralDampen = 1 - suckInForce * 0.7
      shakeX = (Math.sin(time * 13.7) + Math.sin(time * 23.1) * 0.5)
        * shakeIntensity * lateralDampen
      shakeY = (Math.cos(time * 17.3) + Math.cos(time * 29.7) * 0.5)
        * shakeIntensity * lateralDampen
    }

    camera.position.set(shakeX, shakeY, physicsZ.current)
    camera.lookAt(0, 0, -100)
  })

  return null
}
