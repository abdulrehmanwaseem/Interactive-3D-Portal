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
  const yankTimer = useRef(0)
  const yankCooldown = useRef(0)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05) // cap delta to prevent huge jumps
    const time = state.clock.elapsedTime

    // Keep near clip tight so camera can get close to portal without clipping
    const cam = camera as THREE.PerspectiveCamera
    cam.near = 0.01

    // ========== DETECT SUCK-IN ACTIVATION / DEACTIVATION ==========
    const wasActive = lastSuckForce.current > 0.01
    const isActive = suckInForce > 0.01

    // Activate physics: snapshot current camera Z as starting point
    if (isActive && !wasActive) {
      physicsZ.current = targetZ.current
      velocityZ.current = 0
      yankTimer.current = 0
      yankCooldown.current = 0
    }

    // Deactivate: return to target-based
    if (!isActive && wasActive) {
      physicsZ.current = null
      velocityZ.current = 0
      targetZ.current = cameraZ // sync back
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

    // ========== PHYSICS MODE (velocity-based suck-in) ==========
    // The cameraZ target from usePortalProgress acts as the FLOOR —
    // physics can yank the camera forward in jolts, but it always
    // springs back toward cameraZ. This means the camera can't
    // outrun progress — it jolts ahead then gets pulled back,
    // creating the "yank-resist-yank" rhythm.

    // --- SPRING toward the target Z (keeps physics synced to progress) ---
    const springForce = (cameraZ - physicsZ.current) * 6.0 * suckInForce
    velocityZ.current += springForce * dt

    // --- GRAVITATIONAL PULL: extra forward bias beyond the spring ---
    const gravity = -0.8 * suckInForce * suckInForce
    velocityZ.current += gravity * dt

    // --- DISCRETE YANKS: sudden forward jolts ---
    yankTimer.current += dt
    yankCooldown.current -= dt

    // Yanks get faster and stronger as force increases
    const yankInterval = Math.max(0.10, 0.45 - suckInForce * 0.35)

    if (yankTimer.current >= yankInterval && yankCooldown.current <= 0) {
      // Sharp impulse — overshoots the target, then spring pulls back
      const overshoot = -(0.3 + suckInForce * 1.2)
      velocityZ.current += overshoot

      yankCooldown.current = 0.05 // 50ms kickback window
      yankTimer.current = 0
    }

    // --- MICRO KICKBACK after yank (brief backward resist) ---
    if (yankCooldown.current > 0) {
      velocityZ.current += 4.0 * dt
    }

    // --- VELOCITY DAMPING ---
    velocityZ.current *= (1 - 3.0 * dt)

    // --- INTEGRATE POSITION ---
    physicsZ.current += velocityZ.current * dt

    // Floor: never go below cameraZ minus a small overshoot allowance
    // This ensures physics tracks progress, not running ahead to black screen
    const minZ = Math.max(0.03, cameraZ - 0.4 * suckInForce)
    physicsZ.current = Math.max(minZ, Math.min(physicsZ.current, 4.0))

    // --- FOV: jolt on yanks ---
    const fovJolt = yankCooldown.current > 0 ? -4.0 : 0
    targetFov.current += (cameraFov + fovJolt - targetFov.current) * Math.min(dt * 18, 1)

    cam.fov = targetFov.current
    cam.updateProjectionMatrix()

    // --- SHAKE ---
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
