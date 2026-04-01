'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface CollapsibleProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  ({ open, onOpenChange, children, className }, ref) => {
    // Store state internally if not controlled
    const [internalOpen, setInternalOpen] = React.useState(false)
    const isControlled = open !== undefined
    const isOpen = isControlled ? open : internalOpen

    const handleToggle = React.useCallback(() => {
      const newState = !isOpen
      if (!isControlled) {
        setInternalOpen(newState)
      }
      onOpenChange?.(newState)
    }, [isOpen, isControlled, onOpenChange])

    // Create a context for children components
    const context = React.useMemo(
      () => ({ isOpen, onToggle: handleToggle }),
      [isOpen, handleToggle]
    )

    return (
      <CollapsibleContext.Provider value={context}>
        <div ref={ref} className={className}>
          {children}
        </div>
      </CollapsibleContext.Provider>
    )
  }
)
Collapsible.displayName = 'Collapsible'

interface CollapsibleContextValue {
  isOpen: boolean
  onToggle: () => void
}

const CollapsibleContext = React.createContext<CollapsibleContextValue>({
  isOpen: false,
  onToggle: () => {},
})

const CollapsibleTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, children, ...props }, ref) => {
  const { isOpen, onToggle } = React.useContext(CollapsibleContext)

  return (
    <button
      ref={ref}
      type="button"
      onClick={(e) => {
        onClick?.(e)
        onToggle()
      }}
      className={className}
      {...props}
    >
      {children}
    </button>
  )
})
CollapsibleTrigger.displayName = 'CollapsibleTrigger'

const CollapsibleContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { isOpen } = React.useContext(CollapsibleContext)

  if (!isOpen) return null

  return (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  )
})
CollapsibleContent.displayName = 'CollapsibleContent'

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
