'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { COLORS } from './constants'

const STREAK_COUNT_DESKTOP = 200
const STREAK_COUNT_MOBILE = 100

const particleVertexShader = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uPointSize;
uniform float uParticleSpeed;
uniform float uStreakFactor;

attribute vec3 aOffset;
attribute float aSpeed;
attribute float aSize;

varying float vAlpha;
varying float vAngle;
varying float vStretch;
varying float vBrightness;

void main() {
  float baseAngle = aOffset.x;
  float radius = aOffset.y;
  float phase = aOffset.z;

  float speed = aSpeed * uParticleSpeed;
  float t = fract(uTime * speed * 0.06 + phase);

  // INWARD SPIRAL — particles spawn at outer radius, accelerate toward center
  // Quadratic pull: slow start, fast finish = forceful suction
  float currentRadius = radius * (1.0 - t * t);
  // Spins faster as it approaches center (angular momentum conservation feel)
  float angularSpeed = 3.0 + t * 15.0;
  float currentAngle = baseAngle + uTime * angularSpeed * speed * 0.3;

  float x = currentRadius * cos(currentAngle);
  float y = currentRadius * sin(currentAngle) * 1.15;
  float z = mix(1.0, -1.5, t * t); // accelerating depth push

  vec3 particlePos = vec3(x, y, z);
  vec4 mvPosition = modelViewMatrix * vec4(particlePos, 1.0);

  // Streak orientation: more tangential early (swirling), more radial late (pulled in)
  float radialAngle = atan(y, x);
  float tangentAngle = radialAngle + 3.14159 * 0.5;
  float radialWeight = t * t; // increasingly radial as particle approaches center
  vAngle = mix(tangentAngle, radialAngle, radialWeight);

  // Moderate stretch — fat wide streaks, NOT thin lines
  vStretch = uStreakFactor * (1.2 + uProgress * 1.0) * (0.8 + aSpeed * 0.2);

  // Size scales with distance from center — small near core, big when spread out
  float sizeFade = smoothstep(0.0, 0.1, t) * smoothstep(1.0, 0.7, t);
  float distScale = smoothstep(0.0, 0.4, t); // small near center, full size when spread
  float progressScale = 0.3 + uProgress * 0.7; // smaller at dormant, full at high progress
  float baseSize = aSize * uPointSize * 8.0 * distScale * progressScale;
  gl_PointSize = baseSize * sizeFade * (80.0 / -mvPosition.z);
  gl_PointSize = clamp(gl_PointSize, 2.0, 140.0);

  gl_Position = projectionMatrix * mvPosition;

  float edgeFade = smoothstep(0.0, 0.1, t) * smoothstep(1.0, 0.7, t);
  float flashHide = 1.0 - smoothstep(0.93, 0.98, uProgress);
  // Particles barely visible at dormant, ramp up with progress
  float progressAlpha = smoothstep(0.05, 0.25, uProgress);
  vAlpha = edgeFade * progressAlpha * clamp(flashHide, 0.0, 1.0);

  vBrightness = 0.85 + aSpeed * 0.4;
}
`

const particleFragmentShader = /* glsl */ `
uniform vec3 uParticleColor;

varying float vAlpha;
varying float vAngle;
varying float vStretch;
varying float vBrightness;

void main() {
  vec2 coord = gl_PointCoord - 0.5;

  // Rotate to align with travel direction
  float c = cos(vAngle);
  float s = sin(vAngle);
  vec2 rotated = vec2(
    coord.x * c - coord.y * s,
    coord.x * s + coord.y * c
  );

  // Moderate stretch — creates fat elongated blobs, not thin lines
  rotated.y *= vStretch;

  float d = length(rotated);

  // === GLOW LAYERS ===
  float core = exp(-d * d / 0.004);
  float inner = exp(-d * d / 0.015);
  float midGlow = exp(-d * d / 0.045);
  float bloom = exp(-d * d / 0.1);

  float shape = core * 1.0 + inner * 0.5 + midGlow * 0.25 + bloom * 0.1;

  // === MAGENTA COLOR RAMP — less white, more colored ===
  vec3 hotPink = vec3(0.95, 0.35, 0.95);
  vec3 brightMagenta = vec3(0.8, 0.1, 0.9);
  vec3 deepMagenta = vec3(0.5, 0.02, 0.7);

  vec3 color = deepMagenta * bloom;
  color += brightMagenta * midGlow * 0.5;
  color += hotPink * inner * 0.4;
  color += hotPink * core * 0.6;

  color *= vBrightness * 0.85;

  float finalAlpha = shape * vAlpha;
  if (finalAlpha < 0.003) discard;

  gl_FragColor = vec4(color, finalAlpha);
}
`

interface ParticleSystemProps {
  progress: number
  particleSpeed: number
  particleStreakFactor: number
}

export function ParticleSystem({ progress, particleSpeed, particleStreakFactor }: ParticleSystemProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const count = isMobile ? STREAK_COUNT_MOBILE : STREAK_COUNT_DESKTOP

  const { geometry, uniforms } = useMemo(() => {
    const geo = new THREE.BufferGeometry()

    const offsets = new Float32Array(count * 3)
    const speeds = new Float32Array(count)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      offsets[i * 3] = Math.random() * Math.PI * 2
      offsets[i * 3 + 1] = 0.25 + Math.random() * 2.0
      offsets[i * 3 + 2] = Math.random()

      speeds[i] = 0.4 + Math.random() * 1.6
      sizes[i] = 0.6 + Math.random() * 1.4
    }

    const positions = new Float32Array(count * 3)
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 3))
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    const unis = {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uPointSize: { value: 5.0 },
      uParticleSpeed: { value: 0.5 },
      uStreakFactor: { value: 1.0 },
      uParticleColor: { value: new THREE.Color('#cc33ff') },
    }

    return { geometry: geo, uniforms: unis }
  }, [count])

  useFrame((state) => {
    if (!materialRef.current) return
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
    materialRef.current.uniforms.uProgress.value = progress
    materialRef.current.uniforms.uParticleSpeed.value = particleSpeed
    materialRef.current.uniforms.uStreakFactor.value = particleStreakFactor
  })

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={particleVertexShader}
        fragmentShader={particleFragmentShader}
        uniforms={uniforms}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}
