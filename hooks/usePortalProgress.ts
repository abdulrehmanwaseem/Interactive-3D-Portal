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
    // Slow approach — camera drifts closer while you see the gateway
    const t = (p - PHASE.TENSION_END) / (PHASE.DRAG_END - PHASE.TENSION_END)
    return lerp(2.5, 1.8, t * t)
  } else if (p <= 0.80) {
    // HOLD phase — camera barely moves, gateway is clearly visible
    const t = (p - PHASE.DRAG_END) / (0.80 - PHASE.DRAG_END)
    return lerp(1.8, 1.6, t)
  } else if (p <= PHASE.BREAKTHROUGH_END) {
    // PULL phase — exponential suck-in SLAMS forward
    const t = (p - 0.80) / (PHASE.BREAKTHROUGH_END - 0.80)
    const eased = Math.pow(t, 3.0)
    return lerp(1.6, 0.15, eased)
  } else {
    return 0.15
  }
}

function getFlashIntensity(p: number): number {
  // Flash pushed later: starts building at 0.91, peaks at 0.97
  if (p < 0.91) return 0
  if (p < 0.95) return smoothstep(0.91, 0.95, p) * 0.5
  if (p < 0.97) return 0.5 + smoothstep(0.95, 0.97, p) * 0.5
  return 1.0
}

// Ring expansion: keeps growing through breakthrough
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
    // Keep expanding aggressively through the entire breakthrough
    const t = (p - PHASE.DRAG_END) / (PHASE.BREAKTHROUGH_END - PHASE.DRAG_END)
    return lerp(8.0, 20.0, Math.pow(t, 1.5))
  } else {
    return 20.0
  }
}

export function usePortalProgress(progress: number): PortalAnimationState {
  return useMemo(() => {
    const p = clamp(progress, 0, 1)

    return {
      // Tunnel keeps intensifying all the way to 0.95
      tunnelIntensity: lerp(0.3, 1.8, smoothstep(0, 0.95, p)),
      tunnelDepthScale: getRingScale(p),
      tunnelTwistSpeed: lerp(0.5, 6.0, smoothstep(0, 0.95, p)),
      flashIntensity: getFlashIntensity(p),

      // Particles keep accelerating through breakthrough
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
      // FOV: narrows gradually, holds during gateway phase, then slams narrow
      cameraFov: p < 0.15 ? 75
        : p < 0.55 ? lerp(75, 48, Math.pow(smoothstep(0.15, 0.55, p), 1.8))
        : p < 0.80 ? lerp(48, 38, smoothstep(0.55, 0.80, p))        // gentle during hold
        : p < 0.92 ? lerp(38, 15, Math.pow(smoothstep(0.80, 0.92, p), 2.0))  // slam narrow
        : p < 0.95 ? lerp(15, 12, smoothstep(0.92, 0.95, p))
        : lerp(12, 75, smoothstep(0.95, 1.0, p)),
      shakeIntensity: p < 0.3 ? 0
        : p < 0.80 ? clamp((p - 0.3) * 0.06, 0, 0.04)  // mild during hold
        : p < 0.95 ? lerp(0.04, 0.5, Math.pow(smoothstep(0.80, 0.95, p), 1.5))
        : lerp(0.5, 0, smoothstep(0.95, 1.0, p)),
      // Physics-based pull: delayed until AFTER gateway hold phase
      // 0.00-0.80 = no pull (gateway holds, you see the destination)
      // 0.80-0.95 = forceful pull yanks you in
      suckInForce: p < 0.80 ? 0
        : p < PHASE.BREAKTHROUGH_END ? Math.pow(smoothstep(0.80, PHASE.BREAKTHROUGH_END, p), 1.5)
        : p < 0.97 ? 1.0
        : 0,

      phase: getPhase(p),
    }
  }, [progress])
}
