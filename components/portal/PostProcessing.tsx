'use client'

import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

interface PortalPostProcessingProps {
  bloomIntensity: number
  bloomThreshold: number
  vignetteDarkness: number
  isMobile: boolean
}

export function PortalPostProcessing({
  bloomIntensity,
  bloomThreshold,
  vignetteDarkness,
}: PortalPostProcessingProps) {
  return (
    <EffectComposer>
      <Bloom
        intensity={bloomIntensity * 0.35}
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={0.4}
        mipmapBlur
        radius={0.4}
      />
      <Vignette
        darkness={vignetteDarkness}
        offset={0.3}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  )
}
