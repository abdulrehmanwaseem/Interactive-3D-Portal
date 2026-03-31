'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PARTICLE_COUNT_DESKTOP, PARTICLE_COUNT_MOBILE, COLORS } from './constants'

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
varying float vDepthFade;

void main() {
  float angle = aOffset.x;
  float radius = aOffset.y;
  float phase = aOffset.z;

  // Aggressive speed that ramps hard with progress
  float speed = aSpeed * uParticleSpeed;
  float t = fract(uTime * speed * 0.08 + phase);

  // INWARD SPIRAL - tighter rotation near center
  float currentRadius = radius * (1.0 - t * 0.92);
  float angularSpeed = 1.0 + (1.0 - currentRadius / max(radius, 0.01)) * 10.0;
  float currentAngle = angle + uTime * angularSpeed * speed * 0.4;

  // Vertical ellipse matching portal
  float x = currentRadius * cos(currentAngle);
  float y = currentRadius * sin(currentAngle) * 1.18;
  float z = mix(2.0, -1.0, t);

  vec3 particlePos = vec3(x, y, z);
  vec4 mvPosition = modelViewMatrix * vec4(particlePos, 1.0);

  // Streaking based on actual streak factor
  float streakMul = 1.0 + (uStreakFactor - 1.0) * aSpeed;
  float sizeFade = 1.0 - t * 0.3;
  gl_PointSize = aSize * uPointSize * sizeFade * streakMul * (60.0 / -mvPosition.z);
  gl_PointSize = clamp(gl_PointSize, 0.5, 10.0);

  gl_Position = projectionMatrix * mvPosition;

  // Invisible at dormant, higher alpha overall, hide during flash
  float edgeFade = smoothstep(0.0, 0.15, t) * smoothstep(1.0, 0.8, t);
  float flashHide = 1.0 - smoothstep(0.85, 0.92, uProgress) + smoothstep(0.95, 1.0, uProgress);
  vAlpha = edgeFade * smoothstep(0.05, 0.2, uProgress) * (0.5 + uProgress * 0.5) * clamp(flashHide, 0.0, 1.0);
  vDepthFade = t;
}
`

const particleFragmentShader = /* glsl */ `
uniform vec3 uParticleColor;

varying float vAlpha;
varying float vDepthFade;

void main() {
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);

  // Tiny pinpoint: hard cutoff, almost no falloff
  float shape = smoothstep(0.45, 0.2, dist);

  vec3 color = mix(uParticleColor, vec3(0.8, 0.65, 1.0), vDepthFade * 0.3);

  gl_FragColor = vec4(color, shape * vAlpha);
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
  const count = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP

  const { geometry, uniforms } = useMemo(() => {
    const geo = new THREE.BufferGeometry()

    const offsets = new Float32Array(count * 3)
    const speeds = new Float32Array(count)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      offsets[i * 3] = Math.random() * Math.PI * 2
      offsets[i * 3 + 1] = 0.15 + Math.random() * 1.5
      offsets[i * 3 + 2] = Math.random()

      speeds[i] = 0.5 + Math.random() * 1.5
      sizes[i] = 0.3 + Math.random() * 1.0
    }

    const positions = new Float32Array(count * 3)
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 3))
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    const unis = {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uPointSize: { value: 0.6 },
      uParticleSpeed: { value: 0.5 },
      uStreakFactor: { value: 1.0 },
      uParticleColor: { value: COLORS.particles.clone() },
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
