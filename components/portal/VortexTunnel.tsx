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
uniform sampler2D uCityTexture;

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

  // ====== CENTER GATEWAY (a real opening you are about to enter) ======
  // Phase 1 (0.0-0.45): gateway appears small
  // Phase 2 (0.45-0.80): gateway grows PROMINENT and HOLDS — the destination is clear
  // Phase 3 (0.80+): pull kicks in, gateway expands to engulf you
  float centerP = smoothstep(0.0, 0.2, uProgress);

  // Two-stage opening radius: grows moderately, then HOLDS at a prominent size
  // before the suck-in phase expands it to fill screen
  float baseRadius = 0.02 + smoothstep(0.0, 0.45, uProgress) * 0.03;
  // From 0.45-0.80: gateway grows to a clearly visible size and holds
  float holdRadius = smoothstep(0.45, 0.65, uProgress) * 0.07;
  // From 0.80+: rapid expansion during the pull
  float pullRadius = smoothstep(0.80, 0.95, uProgress) * 0.15;
  float openingRadius = baseRadius + holdRadius + pullRadius;

  float openingEdge = 0.006 + smoothstep(0.45, 0.70, uProgress) * 0.008;
  float openingMask = smoothstep(openingRadius + openingEdge, openingRadius - openingEdge * 0.5, dist);

  // Dark void inside the opening (depth/space feel)
  float voidDarkness = openingMask * centerP * 0.9;

  // BRIGHT RIM — intensifies during the hold phase (0.45-0.80)
  float rimDist = abs(dist - openingRadius);
  // Rim gets brighter and sharper during hold phase
  float holdIntensity = 1.0 + smoothstep(0.45, 0.70, uProgress) * 1.5;
  float rimSharp = exp(-rimDist * rimDist / (openingEdge * openingEdge * 1.2)) * centerP * holdIntensity;
  float rimGlow = exp(-rimDist * rimDist / (openingEdge * openingEdge * 6.0)) * centerP * 0.6 * holdIntensity;

  // Rim shimmer — pulses more actively during hold to draw attention
  float shimmerSpeed = 3.0 + smoothstep(0.50, 0.80, uProgress) * 4.0;
  float rimShimmer = sin(angle * 12.0 + uTime * shimmerSpeed) * 0.12 + 0.88;
  rimSharp *= rimShimmer;

  // Inner atmosphere: destination glow deep inside — stronger during hold
  float atmoStrength = 0.2 + smoothstep(0.50, 0.75, uProgress) * 0.4;
  float innerAtmo = exp(-dist * dist / (openingRadius * openingRadius * 0.35)) * centerP * atmoStrength;
  // Pulsing deep light — like something breathing on the other side
  float pulseSpeed = 1.5 + smoothstep(0.60, 0.80, uProgress) * 2.0;
  float innerPulse = sin(uTime * pulseSpeed) * 0.12 + 0.88;
  innerAtmo *= innerPulse;

  // Inner depth rings — more visible during hold
  float depthRingIntensity = 0.3 + smoothstep(0.50, 0.75, uProgress) * 0.5;
  float innerRimR = openingRadius * 0.55;
  float innerRimDist = abs(dist - innerRimR);
  float innerRim = exp(-innerRimDist * innerRimDist / (openingEdge * openingEdge * 0.8)) * centerP * depthRingIntensity;
  innerRim *= openingMask;

  // Third depth ring
  float deepRimR = openingRadius * 0.3;
  float deepRimDist = abs(dist - deepRimR);
  float deepRim = exp(-deepRimDist * deepRimDist / (openingEdge * openingEdge * 0.5)) * centerP * depthRingIntensity * 0.7;
  deepRim *= openingMask;

  // Fourth depth ring — only visible during hold (extra depth cue)
  float deepRim2R = openingRadius * 0.15;
  float deepRim2Dist = abs(dist - deepRim2R);
  float deepRim2 = exp(-deepRim2Dist * deepRim2Dist / (openingEdge * openingEdge * 0.3)) * centerP * 0.2;
  deepRim2 *= openingMask * smoothstep(0.55, 0.75, uProgress);

  // As we approach breakthrough, the opening EXPANDS dramatically
  float expandP = smoothstep(0.88, 0.96, uProgress);
  float expandSize = 0.01 + expandP * 2.5;
  float expandDot = exp(-dist * dist / (expandSize * expandSize)) * expandP;

  float centerTotal = rimSharp + rimGlow + innerAtmo + innerRim + deepRim + deepRim2 + expandDot;

  // ====== RADIAL SPEED LINES (converging toward center, keep escalating to 0.95) ======
  float speedLines = 0.0;
  if (uProgress > 0.35) {
    float speedP = smoothstep(0.35, 0.95, uProgress);
    // Time multiplier accelerates with progress for faster-moving lines
    float timeAccel = 1.0 + smoothstep(0.72, 0.95, uProgress) * 4.0;
    // Lines that radiate from far out toward center
    float linePattern = pow(abs(sin(angle * 24.0 + uTime * 6.0 * timeAccel)), 16.0);
    // Mask: visible from ring inward, strongest mid-distance
    float lineMask = smoothstep(ringRadius * 1.2, ringRadius * 0.4, dist)
                   * smoothstep(0.01, ringRadius * 0.2, dist);
    speedLines = linePattern * lineMask * speedP * 0.4;

    // Second layer of speed lines
    float linePattern2 = pow(abs(sin(angle * 16.0 - uTime * 4.0 * timeAccel + 1.0)), 12.0);
    speedLines += linePattern2 * lineMask * speedP * 0.25;

    // Third dense layer in late breakthrough
    if (uProgress > 0.78) {
      float lateP = smoothstep(0.78, 0.95, uProgress);
      float linePattern3 = pow(abs(sin(angle * 36.0 + uTime * 10.0 * timeAccel + 2.5)), 10.0);
      speedLines += linePattern3 * lineMask * lateP * 0.35;
    }
  }

  // ====== PASSING RINGS (tunnel depth markers — speed up through breakthrough) ======
  float passingRings = 0.0;
  if (uProgress > 0.2) {
    float prP = smoothstep(0.2, 0.6, uProgress);
    // Rings move faster in late stages
    float ringSpeed = 0.7 + smoothstep(0.72, 0.95, uProgress) * 2.5;
    for (float i = 0.0; i < 7.0; i++) {
      float ringT = fract(uTime * ringSpeed + i * 0.143);
      float r = ringT * ringRadius * 0.85;
      float w = 0.003 + ringT * 0.014;
      passingRings += exp(-pow((dist - r) / w, 2.0)) * (1.0 - ringT) * prP * 0.5;
    }
    // Extra dense rings in late breakthrough
    if (uProgress > 0.80) {
      float latePR = smoothstep(0.80, 0.95, uProgress);
      for (float i = 0.0; i < 5.0; i++) {
        float ringT2 = fract(uTime * ringSpeed * 1.5 + i * 0.2 + 0.5);
        float r2 = ringT2 * ringRadius * 0.7;
        float w2 = 0.002 + ringT2 * 0.01;
        passingRings += exp(-pow((dist - r2) / w2, 2.0)) * (1.0 - ringT2) * latePR * 0.4;
      }
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

  // ====== BLAST RAYS (at breakthrough — extended to 0.95) ======
  float blastRays = 0.0;
  if (uProgress > 0.70) {
    float blastP = smoothstep(0.70, 0.95, uProgress);
    for (float i = 0.0; i < 4.0; i++) {
      float rayAngle = angle * (8.0 + i * 3.0) + uTime * (4.0 + i * 1.5) + i * 1.5;
      float ray = pow(max(sin(rayAngle) * 0.5 + 0.5, 0.0), 3.0);
      float rayLen = smoothstep(0.01, ringRadius * 0.8, dist)
                   * smoothstep(ringRadius * 2.0, ringRadius * 0.5, dist);
      blastRays += ray * rayLen * blastP * (0.35 - i * 0.07);
    }
  }

  // ====== SHOCKWAVE PULSES (expanding rings from center during breakthrough) ======
  float shockwaves = 0.0;
  if (uProgress > 0.72) {
    float swP = smoothstep(0.72, 0.85, uProgress);
    for (float i = 0.0; i < 4.0; i++) {
      // Each shockwave expands outward at different phase
      float swTime = fract(uTime * 1.2 + i * 0.25);
      float swRadius = swTime * ringRadius * 0.6;
      float swWidth = 0.005 + swTime * 0.015;
      float sw = exp(-pow((dist - swRadius) / swWidth, 2.0));
      // Fade out as they expand
      sw *= (1.0 - swTime) * swP;
      shockwaves += sw * 0.6;
    }
  }

  // ====== ENERGY CRACKLING (lightning-like arcs around the portal rim) ======
  float crackling = 0.0;
  if (uProgress > 0.75) {
    float crackP = smoothstep(0.75, 0.90, uProgress);
    // Noise-based lightning that flickers
    float crackNoise = snoise(vec3(angle * 15.0, dist * 30.0, uTime * 8.0));
    float crackNoise2 = snoise(vec3(angle * 8.0 + 3.0, dist * 20.0, uTime * 6.0 + 5.0));
    // Only show the sharp peaks (creates lightning look)
    crackling = pow(max(crackNoise, 0.0), 6.0) * crackP;
    crackling += pow(max(crackNoise2, 0.0), 8.0) * crackP * 0.6;
    // Mask to the area around the ring and inner portal
    float crackMask = smoothstep(ringRadius * 1.5, ringRadius * 0.3, dist)
                    * smoothstep(0.01, ringRadius * 0.15, dist);
    crackling *= crackMask;
  }

  // ====== LATE-STAGE INTENSITY RAMP (everything gets brighter 0.85-0.95) ======
  float lateIntensity = 1.0 + smoothstep(0.82, 0.95, uProgress) * 1.5;

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

  // CENTER GATEWAY: dark opening with bright defined rim
  // First: darken the void area (the actual "hole" you look into)
  color = mix(color, vec3(0.008, 0.003, 0.03), voidDarkness * 0.92);

  // Bright rim — high contrast white-purple edge, intensified during hold
  vec3 rimColor = mix(vec3(0.7, 0.5, 1.0), vec3(1.0, 0.95, 1.0), rimSharp * 0.5);
  color += rimColor * rimSharp * 4.0;
  color += vec3(0.6, 0.4, 1.0) * rimGlow * 2.0;

  // Inner depth rings (receding tunnel rings inside the opening)
  color += vec3(0.5, 0.35, 0.9) * innerRim * 1.8;
  color += vec3(0.4, 0.25, 0.8) * deepRim * 1.5;
  color += vec3(0.35, 0.2, 0.75) * deepRim2 * 1.2;

  // Inner atmosphere (destination glow deep inside — brighter during hold)
  color += vec3(0.25, 0.15, 0.6) * innerAtmo * 2.0;

  // Expanding center (the opening growing to fill screen at breakthrough)
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

  // Shockwave pulses (expanding white-purple rings)
  color += vec3(0.8, 0.6, 1.0) * shockwaves;
  color += vec3(1.0, 0.9, 1.0) * shockwaves * 0.3;

  // Energy crackling (bright white lightning flashes)
  color += vec3(0.9, 0.7, 1.0) * crackling * 2.0;
  color += vec3(1.0, 1.0, 1.0) * crackling * 0.8;

  // Late-stage overall intensity boost
  color *= lateIntensity;

  // ====== LATE INTENSITY ======
  float whiteShift = smoothstep(0.88, 0.96, uProgress) * 0.25;
  color = mix(color, vec3(length(color) * 1.5), whiteShift);
  
  // ====== CITY PREVIEW IN CENTER ======
  float cityReveal = smoothstep(0.80, 0.98, uProgress);
  if (cityReveal > 0.0) {
    vec2 cityUv = vUv - 0.5;
    cityUv *= mix(0.5, 0.9, cityReveal); 
    cityUv += 0.5;
    
    vec3 cityTexColor = texture2D(uCityTexture, cityUv).rgb;
    
    float portalMask = smoothstep(openingRadius * mix(0.5, 2.5, cityReveal), 0.01, dist);
    
    color = mix(color, cityTexColor * mix(0.2, 1.2, cityReveal), portalMask * cityReveal);
  }

  // ====== EDGE DARKENING ====== 
  color *= mix(1.0, clamp(1.5 - dist * 3.0, 0.0, 1.0), uFlashIntensity);

  // ====== FOCAL POINT CONTRAST BOOST ======
  float focalBoost = smoothstep(ringRadius * 0.8, openingRadius * 2.0, dist);
  color *= mix(1.15, 1.0, focalBoost);

  // ====== SHADER VIGNETTE ======
  float vignette = 1.0 - smoothstep(0.2, 0.8, dist) * (0.25 + uProgress * 0.75);
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
  alpha += centerTotal * 0.9;
  alpha += voidDarkness * 0.6;
  alpha += dormantDark * 0.4 * insideRing;
  alpha += blastRays * 0.6;
  alpha += shockwaves * 0.5;
  alpha += crackling * 0.6;
  alpha += deepRim2 * 0.3;
  alpha += expandDot * 1.0;
  alpha *= intensity;
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
  cityTexture?: THREE.Texture | null
}

export function VortexTunnel({ progress, flashIntensity, tunnelDepthScale, cityTexture }: VortexTunnelProps) {
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
      uCityTexture: { value: null as THREE.Texture | null },
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
      
    if (cityTexture) {
        materialRef.current.uniforms.uCityTexture.value = cityTexture
    }
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
