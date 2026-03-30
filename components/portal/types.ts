export interface PortalSceneProps {
  /** Animation progress from 0 to 1, driven by audio engine */
  progress: number
  /** Optional CSS className for the container div */
  className?: string
  /** Optional inline styles for the container div */
  style?: React.CSSProperties
  /** Color overrides */
  colors?: {
    inner?: string
    mid?: string
    outer?: string
    particles?: string
  }
  /** Performance tier override */
  quality?: 'low' | 'medium' | 'high'
  /** Called when the portal animation reaches specific phases */
  onPhaseChange?: (phase: PortalPhase) => void
  /** Disable post-processing */
  disablePostProcessing?: boolean
}

export type PortalPhase =
  | 'dormant'
  | 'build'
  | 'tension'
  | 'drag'
  | 'breakthrough'
  | 'arrival'

export interface PortalAnimationState {
  // Tunnel
  tunnelIntensity: number
  tunnelDepthScale: number
  tunnelTwistSpeed: number
  flashIntensity: number
  // Particles
  particleSpeed: number
  particleStreakFactor: number
  // Post-processing
  bloomIntensity: number
  bloomThreshold: number
  chromaticOffset: number
  vignetteDarkness: number
  // Camera
  cameraZ: number
  cameraFov: number
  shakeIntensity: number
  // Phase
  phase: PortalPhase
}
