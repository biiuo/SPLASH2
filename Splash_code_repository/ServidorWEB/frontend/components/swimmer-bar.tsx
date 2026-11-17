'use client'

import { useEffect, useRef } from 'react'
import { mountSwimmerLane } from './stickman-swimmer-fix.js'

interface SwimmerBarProps {
  className?: string
}

export function SwimmerBar({
  className = 'relative z-10 h-[130px] w-full overflow-hidden',
}: SwimmerBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return
    return mountSwimmerLane(canvasRef.current, containerRef.current)
  }, [])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={className}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
