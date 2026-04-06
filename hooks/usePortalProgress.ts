import { useMemo } from 'react'
import { PHASE, lerp, smoothstep, clamp } from '@/components/portal/constants'
import type { PortalAnimationState, PortalPhase } from '@/components/portal/types'

function getPhase(p: number): PortalPhase {
  if (p <= PHASE.DORMANT_END) return 'dormant'
  if (p <= PHASE.BUILD_END) return 'build'
  if (p <= PHASE.TENSION_END) return 'tension'
  if (p <= PHASE.DRAG_END) return 'drag'
  if (p <= PHASE.BREAKTHROUGH_END) return 'breakthrough'
  return 'arrival'
}

function getCameraZ(p: number): number {
  if (p <= PHASE.DORMANT_END) {
    const t = p / PHASE.DORMANT_END
    return lerp(4.0, 3.8, t)
  } else if (p <= PHASE.BUILD_END) {
    const t = (p - PHASE.DORMANT_END) / (PHASE.BUILD_END - PHASE.DORMANT_END)
    return lerp(3.8, 3.2, t)
  } else if (p <= PHASE.TENSION_END) {
    const t = (p - PHASE.BUILD_END) / (PHASE.TENSION_END - PHASE.BUILD_END)
    return lerp(3.2, 2.5, t)
  } else if (p <= PHASE.DRAG_END) {
    const t = (p - PHASE.TENSION_END) / (PHASE.DRAG_END - PHASE.TENSION_END)
    return lerp(2.5, 1.8, t * t)
  } else if (p <= 0.80) {
    // HOLD phase — gateway visible
    const t = (p - PHASE.DRAG_END) / (0.80 - PHASE.DRAG_END)
    return lerp(1.8, 1.6, t)
  } else if (p <= PHASE.BREAKTHROUGH_END) {
    // PULL phase — slam forward through the portal
    const t = (p - 0.80) / (PHASE.BREAKTHROUGH_END - 0.80)
    const eased = Math.pow(t, 3.0)
    return lerp(1.6, 0.15, eased)
  } else {
    // ARRIVAL — camera continues past portal into city
    const t = (p - PHASE.BREAKTHROUGH_END) / (PHASE.ARRIVAL_END - PHASE.BREAKTHROUGH_END)
    return lerp(0.15, -3.0, Math.pow(t, 0.6))
  }
}

function getFlashIntensity(p: number): number {
  if (p < 0.90) return 0
  if (p < 0.95) return smoothstep(0.90, 0.95, p)
  return 1.0
}

function getRingScale(p: number): number {
  if (p <= PHASE.DORMANT_END) {
    const t = p / PHASE.DORMANT_END
    return lerp(1.0, 1.4, t * t)
  } else if (p <= PHASE.BUILD_END) {
    const t = (p - PHASE.DORMANT_END) / (PHASE.BUILD_END - PHASE.DORMANT_END)
    return lerp(1.4, 2.5, t)
  } else if (p <= PHASE.TENSION_END) {
    const t = (p - PHASE.BUILD_END) / (PHASE.TENSION_END - PHASE.BUILD_END)
    return lerp(2.5, 4.5, t)
  } else if (p <= PHASE.DRAG_END) {
    const t = (p - PHASE.TENSION_END) / (PHASE.DRAG_END - PHASE.TENSION_END)
    return lerp(4.5, 8.0, t)
  } else if (p <= 0.85) {
    const t = (p - PHASE.DRAG_END) / (0.85 - PHASE.DRAG_END)
    return lerp(8.0, 15.0, t)
  } else {
    // Ring shrinks as camera passes through (tunnel collapses behind you)
    const t = clamp((p - 0.85) / (1.0 - 0.85), 0, 1)
    return lerp(15.0, 0.1, Math.pow(t, 2.0))
  }
}

export function usePortalProgress(progress: number): PortalAnimationState {
  return useMemo(() => {
    const p = clamp(progress, 0, 1)

    return {
      tunnelIntensity: lerp(0.3, 1.8, smoothstep(0, 0.95, p)),
      tunnelDepthScale: getRingScale(p),
      tunnelTwistSpeed: lerp(0.5, 6.0, smoothstep(0, 0.95, p)),
      flashIntensity: getFlashIntensity(p),

      particleSpeed: p < 0.72
        ? lerp(0.8, 10.0, smoothstep(0, 0.72, p))
        : lerp(10.0, 25.0, Math.pow(smoothstep(0.72, 0.95, p), 1.5)),
      particleStreakFactor: p < 0.72
        ? lerp(1.5, 8.0, smoothstep(0.2, 0.72, p))
        : lerp(8.0, 20.0, smoothstep(0.72, 0.95, p)),

      bloomIntensity: lerp(0.2, 1.0, smoothstep(0, 0.95, p)),
      bloomThreshold: lerp(0.8, 0.3, smoothstep(0, 0.95, p)),
      chromaticOffset: 0,
      vignetteDarkness: lerp(0.3, 0.85, smoothstep(0, 0.95, p)),

      cameraZ: getCameraZ(p),
      cameraFov: p < 0.15 ? 75
        : p < 0.55 ? lerp(75, 48, Math.pow(smoothstep(0.15, 0.55, p), 1.8))
        : p < 0.80 ? lerp(48, 38, smoothstep(0.55, 0.80, p))
        : p < 0.96 ? lerp(38, 12, Math.pow(smoothstep(0.80, 0.96, p), 2.0))
        : lerp(12, 120, Math.pow(smoothstep(0.96, 1.0, p), 3.0)),  // wide burst into city
      shakeIntensity: p < 0.3 ? 0
        : p < 0.80 ? clamp((p - 0.3) * 0.06, 0, 0.04)
        : p < 0.92 ? lerp(0.04, 0.6, Math.pow(smoothstep(0.80, 0.92, p), 1.5))
        : lerp(0.6, 0, smoothstep(0.92, 1.0, p)),
      suckInForce: p < 0.80 ? 0
        : p < 0.96 ? Math.pow(smoothstep(0.80, 0.96, p), 1.5)
        : lerp(1.0, 0.0, Math.pow(smoothstep(0.96, 1.0, p), 2.0)),

      phase: getPhase(p),
    }
  }, [progress])
}
