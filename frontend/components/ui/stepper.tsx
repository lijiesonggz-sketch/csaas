'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Stepper Component
 *
 * 步骤条组件，显示多步骤流程的进度
 * 基于 Advisory Authority 设计风格
 */

interface Step {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
}

interface StepperProps {
  steps: Step[]
  currentStep: number
  completedSteps?: string[]
  orientation?: 'horizontal' | 'vertical'
  onStepClick?: (stepId: string) => void
  className?: string
}

export function Stepper({
  steps,
  currentStep,
  completedSteps = [],
  orientation = 'horizontal',
  onStepClick,
  className,
}: StepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === steps[currentStep]?.id)

  const getStepStatus = (index: number) => {
    if (completedSteps.includes(steps[index]?.id)) return 'completed'
    if (index === currentIndex) return 'current'
    if (index < currentIndex) return 'completed'
    return 'pending'
  }

  const isClickable = (index: number) => {
    return onStepClick && (index < currentIndex || completedSteps.includes(steps[index]?.id))
  }

  if (orientation === 'vertical') {
    return (
      <div className={cn('space-y-0', className)}>
        {steps.map((step, index) => {
          const status = getStepStatus(index)
          const clickable = isClickable(index)

          return (
            <div key={step.id} className="relative">
              {/* Line */}
              {index < steps.length - 1 && (
                <div className="absolute left-4 top-8 w-0.5 h-full bg-[#E2E8F0]" />
              )}

              <div
                className={cn(
                  'relative flex items-start gap-4 pb-8',
                  clickable && 'cursor-pointer'
                )}
                onClick={() => clickable && onStepClick && onStepClick(step.id)}
              >
                {/* Circle */}
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full border-2 flex-shrink-0 z-10',
                    status === 'completed' && 'border-[#059669] bg-[#059669]',
                    status === 'current' && 'border-[#1E3A5F] bg-[#1E3A5F]',
                    status === 'pending' && 'border-[#E2E8F0] bg-[#FEFDFB]'
                  )}
                >
                  {status === 'completed' ? (
                    <Check className="h-4 w-4 text-white" />
                  ) : (
                    <span
                      className={cn(
                        'text-sm font-medium',
                        status === 'current' ? 'text-white' : 'text-[#64748B]'
                      )}
                    >
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div
                  className={cn(
                    'flex-1 pt-1',
                    status === 'pending' && 'opacity-50'
                  )}
                >
                  <p
                    className={cn(
                      'text-sm font-medium',
                      status === 'current' ? 'text-[#1E3A5F]' : 'text-[#64748B]'
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-[#64748B] mt-0.5">{step.description}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const status = getStepStatus(index)
          const clickable = isClickable(index)

          return (
            <React.Fragment key={step.id}>
              {/* Step */}
              <div
                className={cn(
                  'flex flex-col items-center gap-2',
                  clickable && 'cursor-pointer'
                )}
                onClick={() => clickable && onStepClick && onStepClick(step.id)}
              >
                {/* Circle */}
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full border-2',
                    status === 'completed' && 'border-[#059669] bg-[#059669]',
                    status === 'current' && 'border-[#1E3A5F] bg-[#1E3A5F]',
                    status === 'pending' && 'border-[#E2E8F0] bg-[#FEFDFB]'
                  )}
                >
                  {status === 'completed' ? (
                    <Check className="h-5 w-5 text-white" />
                  ) : step.icon ? (
                    <div
                      className={cn(
                        status === 'current' ? 'text-white' : 'text-[#64748B]'
                      )}
                    >
                      {step.icon}
                    </div>
                  ) : (
                    <span
                      className={cn(
                        'text-sm font-medium',
                        status === 'current' ? 'text-white' : 'text-[#64748B]'
                      )}
                    >
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Label */}
                <p
                  className={cn(
                    'text-xs font-medium text-center max-w-[100px]',
                    status === 'current' ? 'text-[#1E3A5F]' : 'text-[#64748B]',
                    status === 'pending' && 'opacity-50'
                  )}
                >
                  {step.label}
                </p>
              </div>

              {/* Line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2',
                    status === 'completed' ? 'bg-[#059669]' : 'bg-[#E2E8F0]'
                  )}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

export default Stepper
