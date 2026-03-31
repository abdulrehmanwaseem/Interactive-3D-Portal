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
  // Camera pushes forward: z=4 → z=2.5 (safe distance, ring expansion handles the rest)
  if (p <= PHASE.DORMANT_END) {
    return lerp(4.0, 3.9, p / PHASE.DORMANT_END)
  } else if (p <= PHASE.BUILD_END) {
    const t = (p - PHASE.DORMANT_END) / (PHASE.BUILD_END - PHASE.DORMANT_END)
    return lerp(3.9, 3.5, t)
  } else if (p <= PHASE.TENSION_END) {
    const t = (p - PHASE.BUILD_END) / (PHASE.TENSION_END - PHASE.BUILD_END)
    return lerp(3.5, 3.0, t)
  } else if (p <= PHASE.DRAG_END) {
    // Cubic ease-in: slow start then accelerating rush
    const t = (p - PHASE.TENSION_END) / (PHASE.DRAG_END - PHASE.TENSION_END)
    const eased = t * t * t
    return lerp(3.0, 2.6, eased)
  } else if (p <= PHASE.BREAKTHROUGH_END) {
    const t = (p - PHASE.DRAG_END) / (PHASE.BREAKTHROUGH_END - PHASE.DRAG_END)
    return lerp(2.6, 2.5, t)
  } else {
    return 2.5
  }
}

function getFlashIntensity(p: number): number {
  if (p < 0.83 || p > 0.98) return 0
  const riseEnd = 0.90
  const peak = 0.92
  const fadeEnd = 0.98
  if (p < riseEnd) return smoothstep(0.83, riseEnd, p) * 0.8
  if (p < peak) return 0.8 + smoothstep(riseEnd, peak, p) * 0.2
  return 1.0 - smoothstep(peak, fadeEnd, p)
}

// How much the ring expands (simulates camera rushing through portal)
function getRingScale(p: number): number {
  if (p <= PHASE.TENSION_END) {
    // Subtle growth during build/tension
    return lerp(1.0, 1.15, smoothstep(0, PHASE.TENSION_END, p))
  } else if (p <= PHASE.DRAG_END) {
    // Accelerating expansion during drag (portal "reaching" toward you)
    const t = (p - PHASE.TENSION_END) / (PHASE.DRAG_END - PHASE.TENSION_END)
    const eased = t * t * t
    return lerp(1.15, 2.2, eased)
  } else if (p <= PHASE.BREAKTHROUGH_END) {
    // Ring fills viewport at breakthrough
    const t = (p - PHASE.DRAG_END) / (PHASE.BREAKTHROUGH_END - PHASE.DRAG_END)
    return lerp(2.2, 3.5, t)
  } else {
    // Settle
    return lerp(3.5, 2.5, smoothstep(PHASE.BREAKTHROUGH_END, 1.0, p))
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

      particleSpeed: lerp(0.5, 6.0, smoothstep(0, 0.83, p)),
      particleStreakFactor: lerp(1.0, 6.0, smoothstep(0.2, 0.83, p)),

      bloomIntensity: lerp(0.2, 0.8, smoothstep(0, 0.83, p)),
      bloomThreshold: lerp(0.8, 0.4, smoothstep(0, 0.83, p)),
      chromaticOffset: 0,
      vignetteDarkness: lerp(0.3, 0.7, smoothstep(0, 0.83, p)),

      cameraZ: getCameraZ(p),
      // FOV narrows aggressively: 75 → 40 (strong tunnel vision pull)
      cameraFov: p < 0.25 ? 75
        : p < 0.83 ? lerp(75, 48, Math.pow(smoothstep(0.25, 0.83, p), 2))
        : p < 0.92 ? lerp(48, 40, smoothstep(0.83, 0.92, p))
        : lerp(40, 75, smoothstep(0.92, 1.0, p)),
      // Shake: builds during drag, peaks at WHOOODOOMP
      shakeIntensity: p < 0.3 ? 0
        : p < 0.83 ? clamp((p - 0.3) * 0.07, 0, 0.05)
        : p < 0.95 ? lerp(0.05, 0.2, smoothstep(0.83, 0.92, p))
        : lerp(0.2, 0, smoothstep(0.95, 1.0, p)),

      phase: getPhase(p),
    }
  }, [progress])
}
