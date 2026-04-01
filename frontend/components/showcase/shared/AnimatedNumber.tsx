'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: string
  className?: string
}

export function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const ref = useRef<HTMLSpanElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const numericMatch = value.match(/^(\d+)/)
    if (!numericMatch) {
      setDisplayValue(value)
      return
    }

    const target = parseInt(numericMatch[1], 10)
    const suffix = value.slice(numericMatch[0].length)
    const duration = 1500
    const startTime = Date.now()

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          const animate = () => {
            const elapsed = Date.now() - startTime
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            const current = Math.round(target * eased)
            setDisplayValue(`${current}${suffix}`)
            if (progress < 1) {
              requestAnimationFrame(animate)
            }
          }
          requestAnimationFrame(animate)
        }
      },
      { threshold: 0.3 }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [value])

  return (
    <span ref={ref} className={className}>
      {displayValue}
    </span>
  )
}
