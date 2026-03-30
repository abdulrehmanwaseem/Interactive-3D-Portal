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

varying vec2 vUv;

void main() {
  vec2 circleUv = (vUv - 0.5) * 2.0;

  // Vertical ellipse
  vec2 ellipseUv = circleUv;
  ellipseUv.y *= 0.85;
  float dist = length(ellipseUv);
  float angle = atan(circleUv.y, circleUv.x);

  float intensity = 0.4 + uProgress * 0.6;
  // Ring GROWS with progress (portal swallowing you)
  float ringRadius = 0.28 + uProgress * uProgress * 0.15;
  float ringWidth = 0.010 + uProgress * 0.005;

  // ====== MULTI-LAYER RING SYSTEM ======

  // Main ring: hot white-pink core
  float ring = exp(-pow((dist - ringRadius) / ringWidth, 2.0));
  // Outer glow ring (slightly wider, purple)
  float ringOuter = exp(-pow((dist - ringRadius) / (ringWidth * 2.5), 2.0));
  // Inner secondary ring
  float ring2 = exp(-pow((dist - ringRadius * 0.92) / (ringWidth * 1.5), 2.0)) * 0.4;
  // Third inner ring (deeper)
  float ring3 = exp(-pow((dist - ringRadius * 0.82) / (ringWidth * 2.0), 2.0)) * 0.2;

  // ====== ORBITAL STREAK LINES ======
  float orbitals = 0.0;
  for (float i = 0.0; i < 6.0; i++) {
    float speed = 0.8 + i * 0.35;
    float orbitAngle = angle + uTime * speed + i * 1.047;
    float wobble = sin(orbitAngle * 2.0 + i * 3.0) * 0.02;
    float orbitDist = ringRadius + wobble;
    float orbitW = 0.003 + 0.001 * sin(uTime * 0.5 + i);
    float line = exp(-pow((dist - orbitDist) / orbitW, 2.0));
    // Arc mask: each streak is ~120 degrees
    float arcMask = pow(max(sin(orbitAngle + i * 1.5) * 0.5 + 0.5, 0.0), 2.0);
    orbitals += line * arcMask * (0.25 + uProgress * 0.5);
  }

  // ====== SPARKLE POINTS on ring ======
  float sparkles = 0.0;
  float sparkleNoise = snoise(vec3(angle * 8.0 + uTime * 3.0, dist * 20.0, uTime * 2.0));
  sparkles = pow(max(sparkleNoise, 0.0), 4.0) * ring * 2.0;
  // Add some larger sparkle flares
  float flareNoise = snoise(vec3(angle * 4.0 - uTime * 1.5, dist * 10.0, uTime * 0.8));
  sparkles += pow(max(flareNoise, 0.0), 6.0) * ringOuter * 1.5;

  // ====== INNER DEPTH RINGS (vortex tunnel) ======
  float tunnel = 0.0;
  for (float i = 1.0; i < 6.0; i++) {
    float r = ringRadius * (1.0 - i * 0.14) * (1.0 - uProgress * 0.04 * i);
    float w = ringWidth * (1.5 + i * 0.5);
    float tRing = exp(-pow((dist - r) / w, 2.0));
    float tAngle = angle + uTime * (0.6 + i * 0.35) * intensity + i * 1.0;
    float tPattern = sin(tAngle * 5.0) * 0.5 + 0.5;
    tunnel += tRing * tPattern * (0.18 - i * 0.025) * intensity;
  }

  // ====== VORTEX SPIRAL (builds with progress) ======
  float insideRing = smoothstep(ringRadius + 0.02, ringRadius * 0.1, dist);
  float spiral = sin(angle * 5.0 + log(max(dist, 0.001)) * 7.0 - uTime * 3.0 * intensity);
  spiral = smoothstep(0.25, 0.75, spiral * 0.5 + 0.5);
  spiral *= insideRing * intensity * 0.5 * smoothstep(0.08, 0.25, uProgress);

  // Second spiral layer (counter-rotating, slower)
  float spiral2 = sin(angle * 3.0 - log(max(dist, 0.001)) * 5.0 + uTime * 1.8 * intensity);
  spiral2 = smoothstep(0.3, 0.7, spiral2 * 0.5 + 0.5);
  spiral2 *= insideRing * intensity * 0.25 * smoothstep(0.15, 0.4, uProgress);

  // ====== ENERGY SHIMMER ======
  float energyNoise = snoise(vec3(angle * 5.0 + uTime * 2.0, dist * 5.0, uTime * 0.8));
  energyNoise = max(energyNoise, 0.0) * ringOuter * 0.6;

  // ====== CORE GLOW ======
  float coreGlow = exp(-dist * 8.0) * smoothstep(0.5, 0.9, uProgress) * 0.35;

  // ====== SPEED LINES (cinematic pull-in streaks) ======
  float speedLines = 0.0;
  if (uProgress > 0.45) {
    float speedP = smoothstep(0.45, 0.85, uProgress);
    // Thin radial streaks rushing toward center
    float linePattern = pow(abs(sin(angle * 20.0 + uTime * 8.0)), 14.0);
    // Only between ring edge and outer area
    float lineFade = smoothstep(ringRadius * 3.5, ringRadius * 1.3, dist)
                   * smoothstep(ringRadius * 0.9, ringRadius * 1.3, dist);
    speedLines = linePattern * lineFade * speedP * 0.5;

    // Second layer (different frequency, offset)
    float linePattern2 = pow(abs(sin(angle * 14.0 - uTime * 6.0 + 1.0)), 12.0);
    speedLines += linePattern2 * lineFade * speedP * 0.3;
  }

  // ====== WHOOODOOMP RADIAL RAYS ======
  float blast = 0.0;
  float blastRays = 0.0;
  if (uProgress > 0.7) {
    float blastP = smoothstep(0.7, 0.95, uProgress);
    // Many radial streaks
    for (float i = 0.0; i < 3.0; i++) {
      float rayAngle = angle * (10.0 + i * 4.0) + uTime * (3.0 + i) + i * 2.0;
      float ray = pow(max(sin(rayAngle) * 0.5 + 0.5, 0.0), 4.0);
      float rayLen = smoothstep(ringRadius * 0.2, ringRadius * 1.2, dist)
                   * smoothstep(ringRadius * 4.0, ringRadius * 1.5, dist);
      blastRays += ray * rayLen * blastP * (0.4 - i * 0.1);
    }
    // Central bright core during blast
    blast = exp(-dist * 5.0) * blastP * 0.5;
  }

  // ====== DARK VOID ======
  float portalDark = smoothstep(ringRadius * 0.85, ringRadius * 0.05, dist);
  float darkFade = 1.0 - smoothstep(0.65, 0.95, uProgress) * 0.7;

  // ====== AMBIENT PURPLE HAZE around portal ======
  float haze = exp(-pow(dist - ringRadius, 2.0) / 0.03) * 0.15 * intensity;

  // ====== COLOR COMPOSITION ======
  vec3 color = vec3(0.0);

  // Main ring: hot white core fading to purple
  vec3 ringColor = mix(vec3(0.9, 0.7, 1.0), vec3(1.0, 0.85, 1.0), ring);
  color += ringColor * ring * 2.2 * intensity;
  // Purple outer glow
  color += vec3(0.55, 0.2, 0.95) * ringOuter * 0.6 * intensity;
  // Inner rings
  color += vec3(0.6, 0.3, 1.0) * ring2 * intensity;
  color += vec3(0.45, 0.2, 0.85) * ring3 * intensity;

  // Orbital streaks (blue-purple)
  color += vec3(0.5, 0.3, 1.0) * orbitals * 0.8;

  // Sparkles (bright white-purple points)
  color += vec3(0.9, 0.8, 1.0) * sparkles;

  // Spiral vortex (purple + blue layers)
  color += vec3(0.5, 0.15, 0.9) * spiral * 1.0;
  color += vec3(0.3, 0.15, 0.7) * spiral2 * 0.8;

  // Tunnel depth
  color += vec3(0.35, 0.12, 0.7) * tunnel * 0.7;

  // Energy shimmer
  color += vec3(0.6, 0.3, 1.0) * energyNoise * 0.3;

  // Ambient purple haze
  color += vec3(0.3, 0.1, 0.6) * haze;

  // Speed lines (blue-purple cinematic streaks)
  color += vec3(0.4, 0.3, 1.0) * speedLines;
  color += vec3(0.7, 0.6, 1.0) * speedLines * 0.3;

  // Core glow (white-purple center)
  color += mix(vec3(0.6, 0.3, 1.0), vec3(1.0), 0.3) * coreGlow;

  // Blast rays (blue-purple streaks)
  color += vec3(0.4, 0.25, 0.9) * blastRays;
  color += vec3(0.6, 0.5, 1.0) * blastRays * 0.4;
  // Blast core (bright white)
  color += vec3(0.9, 0.85, 1.0) * blast;

  // White flash at the end
  color = mix(color, vec3(1.0), uFlashIntensity * uFlashIntensity);

  // ====== ALPHA ======
  float alpha = 0.0;
  alpha += ring * 1.0;
  alpha += ringOuter * 0.3;
  alpha += ring2 * 0.3;
  alpha += ring3 * 0.2;
  alpha += orbitals * 0.5;
  alpha += sparkles * 0.4;
  alpha += spiral * 0.45;
  alpha += spiral2 * 0.3;
  alpha += tunnel * 0.3;
  alpha += energyNoise * 0.15;
  alpha += haze * 0.5;
  alpha += speedLines * 0.5;
  alpha += coreGlow * 0.6;
  alpha += blastRays * 0.6;
  alpha += blast * 0.7;
  alpha += portalDark * 0.5 * insideRing;
  alpha *= intensity;
  alpha = max(alpha, uFlashIntensity);
  alpha = clamp(alpha, 0.0, 1.0);

  // Dark void inside
  color = mix(color, vec3(0.02, 0.005, 0.06), portalDark * insideRing * darkFade * 0.75);

  // Deep purple-blue ambient inside ring
  color += vec3(0.04, 0.015, 0.1) * insideRing * intensity * 0.2;

  gl_FragColor = vec4(color, alpha);
}
`

interface VortexTunnelProps {
  progress: number
  flashIntensity: number
  tunnelIntensity: number
  tunnelDepthScale: number
}

export function VortexTunnel({ progress, flashIntensity }: VortexTunnelProps) {
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
    }),
    []
  )

  useFrame((state) => {
    if (!materialRef.current) return
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
    materialRef.current.uniforms.uProgress.value = progress
    materialRef.current.uniforms.uFlashIntensity.value = flashIntensity
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
