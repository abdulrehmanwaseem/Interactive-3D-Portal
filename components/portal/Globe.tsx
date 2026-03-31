"use client"

import { useEffect, useRef, useCallback } from "react"
import createGlobe from "cobe"

export function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerRef = useRef({ x: 0, y: 0, active: false })
  const phiRef = useRef(0)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointerRef.current = { x: e.clientX, y: e.clientY, active: true }
  }, [])

  const onPointerUp = useCallback(() => {
    pointerRef.current.active = false
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerRef.current.active) return
    const dx = e.clientX - pointerRef.current.x
    phiRef.current += dx * 0.005
    pointerRef.current.x = e.clientX
    pointerRef.current.y = e.clientY
  }, [])

  useEffect(() => {
    if (!canvasRef.current) return

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 600 * 2,
      height: 600 * 2,
      phi: 0,
      theta: 0.2,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.3, 0.1, 0.5],
      markerColor: [0.6, 0.3, 1],
      glowColor: [0.4, 0.15, 0.8],
      markers: [
        { location: [37.7749, -122.4194], size: 0.05 },
        { location: [40.7128, -74.006], size: 0.05 },
        { location: [51.5074, -0.1278], size: 0.04 },
        { location: [35.6762, 139.6503], size: 0.04 },
        { location: [48.8566, 2.3522], size: 0.03 },
        { location: [-33.8688, 151.2093], size: 0.03 },
      ],
    })

    let frame: number
    function animate() {
      // Auto-rotate when not dragging
      if (!pointerRef.current.active) {
        phiRef.current += 0.005
      }
      globe.update({ phi: phiRef.current })
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frame)
      globe.destroy()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="h-[600px] w-[600px] max-w-full cursor-grab active:cursor-grabbing"
      style={{ aspectRatio: "1" }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerOut={onPointerUp}
      onPointerMove={onPointerMove}
    />
  )
}
