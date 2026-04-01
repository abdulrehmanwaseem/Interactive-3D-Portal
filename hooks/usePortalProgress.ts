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

// Camera accelerates INTO the portal — slow start, hard push at the end
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
    // Cubic ease-in: accelerating hard
    const t = (p - PHASE.TENSION_END) / (PHASE.DRAG_END - PHASE.TENSION_END)
    const eased = t * t * t
    return lerp(2.5, 1.5, eased)
  } else if (p <= PHASE.BREAKTHROUGH_END) {
    // Slamming through
    const t = (p - PHASE.DRAG_END) / (PHASE.BREAKTHROUGH_END - PHASE.DRAG_END)
    return lerp(1.5, 0.8, t)
  } else {
    return 0.8
  }
}

function getFlashIntensity(p: number): number {
  if (p < 0.85) return 0
  if (p < 0.92) return smoothstep(0.85, 0.92, p) * 0.6
  if (p < 0.95) return 0.6 + smoothstep(0.92, 0.95, p) * 0.4
  return 1.0
}

// Ring expansion: smooth early spread
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
  } else if (p <= PHASE.BREAKTHROUGH_END) {
    const t = (p - PHASE.DRAG_END) / (PHASE.BREAKTHROUGH_END - PHASE.DRAG_END)
    return lerp(8.0, 14.0, t)
  } else {
    return 14.0
  }
}

export function usePortalProgress(progress: number): PortalAnimationState {
  return useMemo(() => {
    const p = clamp(progress, 0, 1)

    return {
      tunnelIntensity: lerp(0.3, 1.5, smoothstep(0, 0.9, p)),
      tunnelDepthScale: getRingScale(p),
      tunnelTwistSpeed: lerp(0.5, 4.0, smoothstep(0, 0.83, p)),
      flashIntensity: getFlashIntensity(p),

      // Boosted particle speed and streak ranges
      particleSpeed: lerp(0.8, 14.0, smoothstep(0, 0.83, p)),
      particleStreakFactor: lerp(1.5, 12.0, smoothstep(0.2, 0.83, p)),

      bloomIntensity: lerp(0.2, 0.8, smoothstep(0, 0.83, p)),
      bloomThreshold: lerp(0.8, 0.4, smoothstep(0, 0.83, p)),
      chromaticOffset: 0,
      vignetteDarkness: lerp(0.3, 0.7, smoothstep(0, 0.83, p)),

      cameraZ: getCameraZ(p),
      // FOV narrows more aggressively for tunnel vision
      cameraFov: p < 0.15 ? 75
        : p < 0.83 ? lerp(75, 38, Math.pow(smoothstep(0.15, 0.83, p), 1.8))
        : p < 0.90 ? lerp(38, 28, smoothstep(0.83, 0.90, p))
        : p < 0.93 ? lerp(28, 22, smoothstep(0.90, 0.93, p))
        : lerp(22, 75, smoothstep(0.93, 1.0, p)),
      shakeIntensity: p < 0.3 ? 0
        : p < 0.83 ? clamp((p - 0.3) * 0.07, 0, 0.05)
        : p < 0.95 ? lerp(0.05, 0.25, smoothstep(0.83, 0.92, p))
        : lerp(0.25, 0, smoothstep(0.95, 1.0, p)),

      phase: getPhase(p),
    }
  }, [progress])
}
