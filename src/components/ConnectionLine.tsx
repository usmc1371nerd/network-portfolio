import { useEffect, useRef, useState } from 'react'
import { BaseEdge, getBezierPath, type EdgeProps } from 'reactflow'

export function ConnectionLine({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const pathRef = useRef<SVGPathElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const [markerPosition, setMarkerPosition] = useState<{ x: number; y: number } | null>(null)

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  useEffect(() => {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    if (!data?.showPacket || !pathRef.current) {
      setMarkerPosition(null)
      return
    }

    const durationMs = 935
    const pathEl = pathRef.current
    const pathLength = pathEl.getTotalLength()
    const reverse = data.packetDirection === 'reverse'
    const startTime = performance.now()

    const tick = (timestamp: number) => {
      const elapsed = Math.min(timestamp - startTime, durationMs)
      const progress = elapsed / durationMs
      const distance = reverse ? pathLength * (1 - progress) : pathLength * progress
      const point = pathEl.getPointAtLength(distance)

      setMarkerPosition({ x: point.x, y: point.y })

      if (elapsed < durationMs) {
        frameRef.current = window.requestAnimationFrame(tick)
      } else {
        frameRef.current = null
      }
    }

    frameRef.current = window.requestAnimationFrame(tick)

    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [data?.packetDirection, data?.packetKey, data?.showPacket])

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: '#00ffc3',
          strokeWidth: 2,
        }}
      />
      <path ref={pathRef} d={edgePath} fill="none" stroke="none" />
      {data?.showPacket && markerPosition ? (
        <circle
          key={String(data?.packetKey ?? 0)}
          cx={markerPosition.x}
          cy={markerPosition.y}
          r="9"
          fill="rgba(0, 255, 195, 0.25)"
          stroke="#00ffc3"
          strokeWidth="3"
          style={{ filter: 'drop-shadow(0 0 8px rgba(0, 255, 195, 0.8))' }}
        />
      ) : null}
    </>
  )
}
