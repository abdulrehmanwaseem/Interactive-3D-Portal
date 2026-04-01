"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { GLSL_NOISE, COLORS } from "./constants"

const vertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = /* glsl */ `
${GLSL_NOISE}

uniform float uTime;
uniform float uProgress;
uniform vec3 uColorInner;
uniform vec3 uColorMid;
uniform vec3 uColorOuter;
uniform float uFlashIntensity;
uniform float uAspect;
uniform float uRingScale;

varying vec2 vUv;

void main() {
  vec2 circleUv = (vUv - 0.5) * 2.0;

  // Vertical ellipse
  vec2 ellipseUv = circleUv;
  ellipseUv.y *= 0.85;
  float dist = length(ellipseUv);
  float angle = atan(circleUv.y, circleUv.x);

  float intensity = 0.5 + uProgress * 0.7;

  // === RING SYSTEM: rings that SPREAD OUTWARD as progress increases ===
  // Base ring radius scales up dramatically with uRingScale
  float ringRadius = 0.28 * uRingScale;
  float ringWidth = (0.012 + uProgress * 0.008) * uRingScale;

  // Primary ring (the main portal circle)
  float ring = exp(-pow((dist - ringRadius) / ringWidth, 2.0));
  float ringOuter = exp(-pow((dist - ringRadius) / (ringWidth * 2.5), 2.0));
  // Secondary rings at slightly different radii
  float ring2 = exp(-pow((dist - ringRadius * 0.88) / (ringWidth * 1.8), 2.0)) * 0.5;
  float ring3 = exp(-pow((dist - ringRadius * 0.75) / (ringWidth * 2.2), 2.0)) * 0.3;

  // Additional outer spreading rings (appear as progress increases)
  float spreadRing1 = exp(-pow((dist - ringRadius * 1.15) / (ringWidth * 1.5), 2.0)) * 0.3;
  float spreadRing2 = exp(-pow((dist - ringRadius * 1.35) / (ringWidth * 2.0), 2.0)) * 0.2;
  spreadRing1 *= smoothstep(0.2, 0.5, uProgress);
  spreadRing2 *= smoothstep(0.3, 0.6, uProgress);

  // ====== ORBITAL STREAKS (swirling around the ring) ======
  float orbitals = 0.0;
  for (float i = 0.0; i < 6.0; i++) {
    float speed = 0.8 + i * 0.35;
    float orbitAngle = angle + uTime * speed + i * 1.047;
    float wobble = sin(orbitAngle * 2.0 + i * 3.0) * 0.02 * uRingScale;
    float orbitDist = ringRadius + wobble;
    float orbitW = (0.003 + 0.002 * sin(uTime * 0.5 + i)) * uRingScale;
    float line = exp(-pow((dist - orbitDist) / orbitW, 2.0));
    float arcMask = pow(max(sin(orbitAngle + i * 1.5) * 0.5 + 0.5, 0.0), 2.0);
    orbitals += line * arcMask * (0.25 + uProgress * 0.5);
  }

  // ====== SPARKLES ======
  float sparkles = 0.0;
  float sparkleNoise = snoise(vec3(angle * 8.0 + uTime * 3.0, dist * 20.0, uTime * 2.0));
  sparkles = pow(max(sparkleNoise, 0.0), 4.0) * ring * 2.0;
  float flareNoise = snoise(vec3(angle * 4.0 - uTime * 1.5, dist * 10.0, uTime * 0.8));
  sparkles += pow(max(flareNoise, 0.0), 6.0) * ringOuter * 1.5;

  // ====== VORTEX SPIRALS (inside the ring, converging to center) ======
  float insideRing = smoothstep(ringRadius + 0.02, ringRadius * 0.05, dist);
  float spiral = sin(angle * 5.0 + log(max(dist, 0.001)) * 7.0 - uTime * 3.0 * intensity);
  spiral = smoothstep(0.25, 0.75, spiral * 0.5 + 0.5);
  spiral *= insideRing * intensity * 0.5 * smoothstep(0.08, 0.25, uProgress);

  float spiral2 = sin(angle * 3.0 - log(max(dist, 0.001)) * 5.0 + uTime * 1.8 * intensity);
  spiral2 = smoothstep(0.3, 0.7, spiral2 * 0.5 + 0.5);
  spiral2 *= insideRing * intensity * 0.25 * smoothstep(0.15, 0.4, uProgress);

  // ====== CONVERGENCE LINES (lines pointing TOWARD center - "being pulled in" feel) ======
  float convergence = 0.0;
  if (uProgress > 0.15) {
    float convP = smoothstep(0.15, 0.7, uProgress);
    // Radial lines that point toward center
    for (float i = 0.0; i < 8.0; i++) {
      float lineAngle = angle + i * 0.785 + uTime * 0.3; // 8 lines evenly spaced, slowly rotating
      float linePattern = pow(abs(cos(lineAngle * 1.0)), 30.0 - uProgress * 15.0);
      // Lines exist between ring and center, fading at both ends
      float lineMask = smoothstep(ringRadius * 0.08, ringRadius * 0.3, dist)
                     * smoothstep(ringRadius * 1.1, ringRadius * 0.5, dist);
      convergence += linePattern * lineMask * convP * 0.15;
    }
    // Additional fine convergence lines at higher progress
    if (uProgress > 0.4) {
      float fineP = smoothstep(0.4, 0.8, uProgress);
      float fineLines = pow(abs(sin(angle * 20.0 + uTime * 2.0)), 8.0);
      float fineMask = smoothstep(0.02, ringRadius * 0.4, dist)
                     * smoothstep(ringRadius * 1.0, ringRadius * 0.3, dist);
      convergence += fineLines * fineMask * fineP * 0.2;
    }
  }

  // ====== CENTER DOT (the "pull point" - bright core that draws you in) ======
  // This is the key element: a bright white dot at center that grows
  float centerP = smoothstep(0.0, 0.3, uProgress);

  // Core dot: very concentrated bright point
  float coreSize = 0.006 + uProgress * 0.015;
  float coreDot = exp(-dist * dist / (coreSize * coreSize)) * centerP;

  // Inner glow around the dot
  float glowSize = 0.02 + uProgress * 0.04;
  float coreGlow = exp(-dist * dist / (glowSize * glowSize)) * centerP * 0.6;

  // Soft halo
  float haloSize = 0.05 + uProgress * 0.08;
  float coreHalo = exp(-dist * dist / (haloSize * haloSize)) * centerP * 0.3;

  // As we approach breakthrough, the center dot EXPANDS dramatically
  float expandP = smoothstep(0.8, 0.95, uProgress);
  float expandSize = 0.01 + expandP * 2.0; // grows from tiny to HUGE
  float expandDot = exp(-dist * dist / (expandSize * expandSize)) * expandP;

  float centerTotal = coreDot + coreGlow + coreHalo + expandDot;

  // ====== RADIAL SPEED LINES (converging toward center, intensify with progress) ======
  float speedLines = 0.0;
  if (uProgress > 0.35) {
    float speedP = smoothstep(0.35, 0.85, uProgress);
    // Lines that radiate from far out toward center
    float linePattern = pow(abs(sin(angle * 24.0 + uTime * 6.0)), 16.0);
    // Mask: visible from ring inward, strongest mid-distance
    float lineMask = smoothstep(ringRadius * 1.2, ringRadius * 0.4, dist)
                   * smoothstep(0.01, ringRadius * 0.2, dist);
    speedLines = linePattern * lineMask * speedP * 0.4;

    // Second layer of speed lines
    float linePattern2 = pow(abs(sin(angle * 16.0 - uTime * 4.0 + 1.0)), 12.0);
    speedLines += linePattern2 * lineMask * speedP * 0.25;
  }

  // ====== PASSING RINGS (tunnel depth markers rushing toward viewer) ======
  float passingRings = 0.0;
  if (uProgress > 0.2) {
    float prP = smoothstep(0.2, 0.6, uProgress);
    for (float i = 0.0; i < 7.0; i++) {
      float ringT = fract(uTime * 0.7 + i * 0.143);
      float r = ringT * ringRadius * 0.85;
      float w = 0.003 + ringT * 0.014;
      passingRings += exp(-pow((dist - r) / w, 2.0)) * (1.0 - ringT) * prP * 0.5;
    }
  }

  // ====== DEPTH BANDS (concentric rings inside portal for layered depth) ======
  float depthBands = 0.0;
  if (uProgress > 0.1) {
    float dbP = smoothstep(0.1, 0.5, uProgress);
    for (float i = 0.0; i < 6.0; i++) {
      float bandR = ringRadius * (0.7 - i * 0.1);
      float bandW = 0.006 * uRingScale;
      float band = exp(-pow((dist - bandR) / bandW, 2.0));
      float bandAnim = sin(angle * 3.0 + uTime * (1.0 + i * 0.5) + i * 1.0) * 0.5 + 0.5;
      depthBands += band * bandAnim * 0.15 * intensity * dbP;
    }
  }

  // ====== ENERGY SHIMMER ======
  float energyNoise = snoise(vec3(angle * 5.0 + uTime * 2.0, dist * 5.0, uTime * 0.8));
  energyNoise = max(energyNoise, 0.0) * ringOuter * 0.6;

  // ====== BLAST RAYS (at breakthrough) ======
  float blastRays = 0.0;
  if (uProgress > 0.75) {
    float blastP = smoothstep(0.75, 0.92, uProgress);
    for (float i = 0.0; i < 4.0; i++) {
      float rayAngle = angle * (8.0 + i * 3.0) + uTime * (4.0 + i * 1.5) + i * 1.5;
      float ray = pow(max(sin(rayAngle) * 0.5 + 0.5, 0.0), 3.0);
      // Rays emanate from center outward
      float rayLen = smoothstep(0.01, ringRadius * 0.8, dist)
                   * smoothstep(ringRadius * 2.0, ringRadius * 0.5, dist);
      blastRays += ray * rayLen * blastP * (0.35 - i * 0.07);
    }
  }

  // ====== AMBIENT HAZE ======
  float haze = exp(-pow(dist - ringRadius, 2.0) / 0.03) * 0.15 * intensity;

  // ====== DORMANT DARK CENTER (only at very start) ======
  float dormantDark = smoothstep(ringRadius * 0.85, ringRadius * 0.05, dist);
  dormantDark *= (1.0 - smoothstep(0.05, 0.25, uProgress));

  // ====== COLOR COMPOSITION ======
  vec3 color = vec3(0.0);

  // Ring layers (these spread outward and eventually leave view)
  vec3 ringColor = mix(vec3(0.9, 0.7, 1.0), vec3(1.0, 0.85, 1.0), ring);
  color += ringColor * ring * 2.8 * intensity;
  color += vec3(0.55, 0.2, 0.95) * ringOuter * 0.8 * intensity;
  color += vec3(0.6, 0.3, 1.0) * ring2 * intensity;
  color += vec3(0.45, 0.2, 0.85) * ring3 * intensity;
  color += vec3(0.7, 0.4, 1.0) * spreadRing1 * intensity;
  color += vec3(0.5, 0.25, 0.9) * spreadRing2 * intensity;

  // Orbitals & sparkles
  color += vec3(0.5, 0.3, 1.0) * orbitals * 0.8;
  color += vec3(0.9, 0.8, 1.0) * sparkles;

  // Spirals (inside, converging)
  color += vec3(0.5, 0.15, 0.9) * spiral * 1.0;
  color += vec3(0.3, 0.15, 0.7) * spiral2 * 0.8;

  // Convergence lines (toward center)
  color += vec3(0.6, 0.35, 1.0) * convergence;

  // Energy
  color += vec3(0.6, 0.3, 1.0) * energyNoise * 0.3;

  // CENTER DOT: bright white-purple core that draws you in
  vec3 dotColor = mix(vec3(0.6, 0.4, 1.0), vec3(1.0, 0.95, 1.0), coreDot);
  color += dotColor * (coreDot * 4.5 + coreGlow * 2.5 + coreHalo * 1.2);

  // Expanding center (the dot growing to fill screen)
  color += vec3(1.0, 0.97, 1.0) * expandDot * 2.5;

  // Dormant darkness
  color = mix(color, vec3(0.02, 0.005, 0.06), dormantDark * insideRing * 0.7);

  // Haze
  color += vec3(0.3, 0.1, 0.6) * haze;

  // Depth bands (layered tunnel depth)
  color += vec3(0.4, 0.2, 0.85) * depthBands;

  // Passing rings
  color += vec3(0.5, 0.35, 0.95) * passingRings;

  // Speed lines (converging toward center)
  color += vec3(0.5, 0.35, 1.0) * speedLines;
  color += vec3(0.75, 0.65, 1.0) * speedLines * 0.3;

  // Blast rays
  color += vec3(0.5, 0.3, 0.95) * blastRays;
  color += vec3(0.7, 0.6, 1.0) * blastRays * 0.4;

  // ====== WHITE FLASH (from center expanding outward) ======
  // Instead of uniform flash, this radiates from center
  float flashRadius = uFlashIntensity * uFlashIntensity * 3.0; // expands from center
  float centerFlash = exp(-dist * dist / max(flashRadius * flashRadius, 0.001));
  // Blend: at low flash, just center brightens; at high flash, everything goes white
  float flashBlend = mix(centerFlash, 1.0, uFlashIntensity * uFlashIntensity);
  color = mix(color, vec3(1.0), flashBlend * uFlashIntensity);

  // ====== SHADER VIGNETTE (stronger for deeper contrast) ======
  float vignette = 1.0 - smoothstep(0.25, 0.85, dist) * (0.2 + uProgress * 0.7);
  // Reduce vignette during flash so white fills fully
  vignette = mix(vignette, 1.0, uFlashIntensity);
  color *= vignette;

  // ====== ALPHA ======
  float alpha = 0.0;
  alpha += ring * 1.0;
  alpha += ringOuter * 0.3;
  alpha += ring2 * 0.3;
  alpha += ring3 * 0.2;
  alpha += spreadRing1 * 0.3;
  alpha += spreadRing2 * 0.2;
  alpha += orbitals * 0.5;
  alpha += sparkles * 0.4;
  alpha += spiral * 0.45;
  alpha += spiral2 * 0.3;
  alpha += convergence * 0.5;
  alpha += energyNoise * 0.15;
  alpha += haze * 0.5;
  alpha += depthBands * 0.4;
  alpha += passingRings * 0.5;
  alpha += speedLines * 0.5;
  alpha += centerTotal * 0.8;
  alpha += dormantDark * 0.4 * insideRing;
  alpha += blastRays * 0.6;
  alpha += expandDot * 1.0;
  alpha *= intensity;
  alpha = max(alpha, uFlashIntensity);
  alpha = clamp(alpha, 0.0, 1.0);

  // Subtle purple ambient inside
  color += vec3(0.03, 0.01, 0.08) * insideRing * intensity * 0.15;

  gl_FragColor = vec4(color, alpha);
}
`

interface VortexTunnelProps {
  progress: number
  flashIntensity: number
  tunnelIntensity: number
  tunnelDepthScale: number
}

export function VortexTunnel({ progress, flashIntensity, tunnelDepthScale }: VortexTunnelProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uColorInner: { value: COLORS.inner.clone() },
      uColorMid: { value: COLORS.mid.clone() },
      uColorOuter: { value: COLORS.outer.clone() },
      uFlashIntensity: { value: 0 },
      uAspect: { value: 1 },
      uRingScale: { value: 1 },
    }),
    []
  )

  useFrame((state) => {
    if (!materialRef.current) return
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
    materialRef.current.uniforms.uProgress.value = progress
    materialRef.current.uniforms.uFlashIntensity.value = flashIntensity
    materialRef.current.uniforms.uRingScale.value = tunnelDepthScale
    materialRef.current.uniforms.uAspect.value =
      state.viewport.width / state.viewport.height
  })

  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[11.5, 14]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}
