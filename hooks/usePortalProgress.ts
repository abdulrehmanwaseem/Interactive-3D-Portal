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
  // Subtle camera push: z=4 → z=3.2 (enough to feel motion, not clip the ring)
  if (p <= PHASE.DORMANT_END) {
    return lerp(4.0, 3.95, p / PHASE.DORMANT_END)
  } else if (p <= PHASE.BUILD_END) {
    const t = (p - PHASE.DORMANT_END) / (PHASE.BUILD_END - PHASE.DORMANT_END)
    return lerp(3.95, 3.75, t)
  } else if (p <= PHASE.TENSION_END) {
    const t = (p - PHASE.BUILD_END) / (PHASE.TENSION_END - PHASE.BUILD_END)
    return lerp(3.75, 3.5, t)
  } else if (p <= PHASE.DRAG_END) {
    // Cubic ease-in for the "pulled in" feel
    const t = (p - PHASE.TENSION_END) / (PHASE.DRAG_END - PHASE.TENSION_END)
    const eased = t * t * t
    return lerp(3.5, 3.25, eased)
  } else if (p <= PHASE.BREAKTHROUGH_END) {
    const t = (p - PHASE.DRAG_END) / (PHASE.BREAKTHROUGH_END - PHASE.DRAG_END)
    return lerp(3.25, 3.2, t)
  } else {
    return 3.2
  }
}

function getFlashIntensity(p: number): number {
  // Breakthrough flash: builds up then fades back to portal
  if (p < 0.83 || p > 0.98) return 0
  const riseEnd = 0.90
  const peak = 0.92
  const fadeEnd = 0.98
  if (p < riseEnd) {
    return smoothstep(0.83, riseEnd, p) * 0.8
  }
  if (p < peak) {
    return 0.8 + smoothstep(riseEnd, peak, p) * 0.2 // hits 1.0
  }
  // Fade back to portal
  return 1.0 - smoothstep(peak, fadeEnd, p)
}

export function usePortalProgress(progress: number): PortalAnimationState {
  return useMemo(() => {
    const p = clamp(progress, 0, 1)

    return {
      tunnelIntensity: lerp(0.3, 1.5, smoothstep(0, 0.9, p)),
      tunnelDepthScale: lerp(1.0, 3.0, smoothstep(0, 0.9, p)),
      tunnelTwistSpeed: lerp(0.5, 3.0, smoothstep(0, 0.83, p)),
      flashIntensity: getFlashIntensity(p),

      particleSpeed: lerp(0.3, 3.0, smoothstep(0, 0.83, p)),
      particleStreakFactor: lerp(1.0, 4.0, smoothstep(0.3, 0.83, p)),

      bloomIntensity: p < 0.83
        ? lerp(0.2, 0.8, smoothstep(0, 0.83, p))
        : p < 0.9
          ? lerp(0.8, 1.2, smoothstep(0.83, 0.9, p))
          : lerp(1.2, 0.4, smoothstep(0.9, 1.0, p)),
      bloomThreshold: p < 0.83
        ? lerp(0.8, 0.5, smoothstep(0, 0.83, p))
        : p < 0.9
          ? lerp(0.5, 0.35, smoothstep(0.83, 0.9, p))
          : lerp(0.35, 0.7, smoothstep(0.9, 1.0, p)),
      chromaticOffset: 0,
      vignetteDarkness: p < 0.83
        ? lerp(0.3, 0.6, smoothstep(0, 0.83, p))
        : p < 0.9
          ? lerp(0.6, 0.8, smoothstep(0.83, 0.9, p))
          : lerp(0.8, 0.3, smoothstep(0.9, 1.0, p)),

      cameraZ: getCameraZ(p),
      // FOV zoom: narrows during drag for tunnel vision pull
      cameraFov: p < 0.57 ? 75
        : p < 0.83 ? lerp(75, 60, smoothstep(0.57, 0.83, p) * smoothstep(0.57, 0.83, p) * smoothstep(0.57, 0.83, p))
        : p < 0.9 ? lerp(60, 55, smoothstep(0.83, 0.9, p))
        : lerp(55, 70, smoothstep(0.9, 1.0, p)),
      // Shake builds during drag, peaks at WHOOODOOMP
      shakeIntensity: p < 0.4 ? 0
        : p < 0.83 ? clamp((p - 0.4) * 0.06, 0, 0.03)
        : p < 0.95 ? lerp(0.03, 0.12, smoothstep(0.83, 0.9, p))
        : lerp(0.12, 0, smoothstep(0.95, 1.0, p)),

      phase: getPhase(p),
    }
  }, [progress])
}
