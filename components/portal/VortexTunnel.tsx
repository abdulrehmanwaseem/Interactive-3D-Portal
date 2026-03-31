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

  float intensity = 0.4 + uProgress * 0.6;
  // Ring scales up dramatically via uRingScale (simulates rushing through portal)
  float ringRadius = 0.28 * uRingScale;
  float ringWidth = (0.010 + uProgress * 0.005) * uRingScale;

  // ====== MULTI-LAYER RING ======
  float ring = exp(-pow((dist - ringRadius) / ringWidth, 2.0));
  float ringOuter = exp(-pow((dist - ringRadius) / (ringWidth * 2.5), 2.0));
  float ring2 = exp(-pow((dist - ringRadius * 0.92) / (ringWidth * 1.5), 2.0)) * 0.4;
  float ring3 = exp(-pow((dist - ringRadius * 0.82) / (ringWidth * 2.0), 2.0)) * 0.2;

  // ====== ORBITAL STREAKS ======
  float orbitals = 0.0;
  for (float i = 0.0; i < 6.0; i++) {
    float speed = 0.8 + i * 0.35;
    float orbitAngle = angle + uTime * speed + i * 1.047;
    float wobble = sin(orbitAngle * 2.0 + i * 3.0) * 0.02;
    float orbitDist = ringRadius + wobble;
    float orbitW = 0.003 + 0.001 * sin(uTime * 0.5 + i);
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

  // ====== TUNNEL DEPTH RINGS ======
  float tunnel = 0.0;
  for (float i = 1.0; i < 6.0; i++) {
    float r = ringRadius * (1.0 - i * 0.14) * (1.0 - uProgress * 0.04 * i);
    float w = ringWidth * (1.5 + i * 0.5);
    float tRing = exp(-pow((dist - r) / w, 2.0));
    float tAngle = angle + uTime * (0.6 + i * 0.35) * intensity + i * 1.0;
    float tPattern = sin(tAngle * 5.0) * 0.5 + 0.5;
    tunnel += tRing * tPattern * (0.18 - i * 0.025) * intensity;
  }

  // ====== VORTEX SPIRALS ======
  float insideRing = smoothstep(ringRadius + 0.02, ringRadius * 0.1, dist);
  float spiral = sin(angle * 5.0 + log(max(dist, 0.001)) * 7.0 - uTime * 3.0 * intensity);
  spiral = smoothstep(0.25, 0.75, spiral * 0.5 + 0.5);
  spiral *= insideRing * intensity * 0.5 * smoothstep(0.08, 0.25, uProgress);

  float spiral2 = sin(angle * 3.0 - log(max(dist, 0.001)) * 5.0 + uTime * 1.8 * intensity);
  spiral2 = smoothstep(0.3, 0.7, spiral2 * 0.5 + 0.5);
  spiral2 *= insideRing * intensity * 0.25 * smoothstep(0.15, 0.4, uProgress);

  // ====== ENERGY SHIMMER ======
  float energyNoise = snoise(vec3(angle * 5.0 + uTime * 2.0, dist * 5.0, uTime * 0.8));
  energyNoise = max(energyNoise, 0.0) * ringOuter * 0.6;

  // ====== GATEWAY CENTER (replaces dark void) ======
  // Bright opening that progressively reveals as progress increases
  float gatewayP = smoothstep(0.1, 0.6, uProgress);
  // Concentrated bright core
  float gateCore = exp(-dist * dist / (0.006 + uProgress * 0.012)) * gatewayP * 0.7;
  // Concentric gateway rings inside (depth illusion)
  float gateRing1 = exp(-pow((dist - ringRadius * 0.5) / 0.012, 2.0)) * 0.35 * gatewayP;
  float gateRing2 = exp(-pow((dist - ringRadius * 0.3) / 0.010, 2.0)) * 0.25 * gatewayP;
  float gateRing3 = exp(-pow((dist - ringRadius * 0.15) / 0.008, 2.0)) * 0.2 * gatewayP;
  float gatewayTotal = gateCore + gateRing1 + gateRing2 + gateRing3;

  // At dormant, center is still dark (gateway hasn't opened)
  float dormantDark = smoothstep(ringRadius * 0.85, ringRadius * 0.05, dist);
  dormantDark *= (1.0 - smoothstep(0.05, 0.3, uProgress)); // fades as gateway opens

  // ====== SPEED LINES ======
  float speedLines = 0.0;
  if (uProgress > 0.4) {
    float speedP = smoothstep(0.4, 0.85, uProgress);
    float linePattern = pow(abs(sin(angle * 20.0 + uTime * 8.0)), 14.0);
    float lineFade = smoothstep(ringRadius * 3.5, ringRadius * 1.3, dist)
                   * smoothstep(ringRadius * 0.9, ringRadius * 1.3, dist);
    speedLines = linePattern * lineFade * speedP * 0.5;
    float linePattern2 = pow(abs(sin(angle * 14.0 - uTime * 6.0 + 1.0)), 12.0);
    speedLines += linePattern2 * lineFade * speedP * 0.3;
  }

  // ====== WHOOODOOMP BLAST ======
  float blast = 0.0;
  float blastRays = 0.0;
  if (uProgress > 0.7) {
    float blastP = smoothstep(0.7, 0.95, uProgress);
    for (float i = 0.0; i < 3.0; i++) {
      float rayAngle = angle * (10.0 + i * 4.0) + uTime * (3.0 + i) + i * 2.0;
      float ray = pow(max(sin(rayAngle) * 0.5 + 0.5, 0.0), 4.0);
      float rayLen = smoothstep(ringRadius * 0.2, ringRadius * 1.2, dist)
                   * smoothstep(ringRadius * 4.0, ringRadius * 1.5, dist);
      blastRays += ray * rayLen * blastP * (0.4 - i * 0.1);
    }
    blast = exp(-dist * 5.0) * blastP * 0.5;
  }

  // ====== AMBIENT HAZE ======
  float haze = exp(-pow(dist - ringRadius, 2.0) / 0.03) * 0.15 * intensity;

  // ====== COLOR COMPOSITION ======
  vec3 color = vec3(0.0);

  // Ring layers
  vec3 ringColor = mix(vec3(0.9, 0.7, 1.0), vec3(1.0, 0.85, 1.0), ring);
  color += ringColor * ring * 2.2 * intensity;
  color += vec3(0.55, 0.2, 0.95) * ringOuter * 0.6 * intensity;
  color += vec3(0.6, 0.3, 1.0) * ring2 * intensity;
  color += vec3(0.45, 0.2, 0.85) * ring3 * intensity;

  // Orbitals & sparkles
  color += vec3(0.5, 0.3, 1.0) * orbitals * 0.8;
  color += vec3(0.9, 0.8, 1.0) * sparkles;

  // Spirals
  color += vec3(0.5, 0.15, 0.9) * spiral * 1.0;
  color += vec3(0.3, 0.15, 0.7) * spiral2 * 0.8;

  // Tunnel depth
  color += vec3(0.35, 0.12, 0.7) * tunnel * 0.7;

  // Energy
  color += vec3(0.6, 0.3, 1.0) * energyNoise * 0.3;

  // GATEWAY CENTER: bright white-purple opening
  vec3 gateColor = mix(vec3(0.5, 0.3, 1.0), vec3(0.95, 0.9, 1.0), gateCore);
  color += gateColor * gatewayTotal * 1.5;

  // Dormant darkness (only at very start, fades as gateway opens)
  color = mix(color, vec3(0.02, 0.005, 0.06), dormantDark * insideRing * 0.7);

  // Haze
  color += vec3(0.3, 0.1, 0.6) * haze;

  // Speed lines
  color += vec3(0.4, 0.3, 1.0) * speedLines;
  color += vec3(0.7, 0.6, 1.0) * speedLines * 0.3;

  // Blast
  color += vec3(0.4, 0.25, 0.9) * blastRays;
  color += vec3(0.6, 0.5, 1.0) * blastRays * 0.4;
  color += vec3(0.9, 0.85, 1.0) * blast;

  // White flash
  color = mix(color, vec3(1.0), uFlashIntensity * uFlashIntensity);

  // ====== SHADER VIGNETTE (replaces broken PostProcessing) ======
  float vignette = 1.0 - smoothstep(0.3, 0.9, dist) * (0.3 + uProgress * 0.4);
  color *= vignette;

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
  alpha += gatewayTotal * 0.6;
  alpha += dormantDark * 0.4 * insideRing;
  alpha += blastRays * 0.6;
  alpha += blast * 0.7;
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
