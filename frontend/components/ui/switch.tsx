'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, defaultChecked, onCheckedChange, disabled, ...props }, ref) => {
    const [isChecked, setIsChecked] = React.useState(defaultChecked ?? false)
    const controlled = checked !== undefined
    const state = controlled ? checked : isChecked

    const handleClick = () => {
      if (disabled) return
      const newValue = !state
      if (!controlled) setIsChecked(newValue)
      onCheckedChange?.(newValue)
    }

    return (
      <button
        type="button"
        role="switch"
        aria-checked={state}
        ref={ref}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
          state ? 'bg-[#059669]' : 'bg-[#CBD5E1]',
          className
        )}
        {...props}
      >
        <span
          className={cn(
            'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform',
            state ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </button>
    )
  }
)
Switch.displayName = 'Switch'

export { Switch }
