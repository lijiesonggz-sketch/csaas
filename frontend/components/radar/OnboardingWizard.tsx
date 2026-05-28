'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Stepper } from '@/components/ui/stepper'
import { TrendingUp, Building2, CheckCircle, Plus, X, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/utils/api'
import { useOnboarding } from '@/lib/hooks/useOnboarding'
import { useWeaknesses, WeaknessCategory } from '@/lib/hooks/useWeaknesses'
import { INSTITUTION_PRESETS } from '@/lib/constants/institution-presets'
import { cn } from '@/lib/utils'

const PRESET_TOPICS = [
  '云原生',
  'AI应用',
  '移动金融安全',
  '成本优化',
  '微服务架构',
  'DevOps',
  '区块链技术',
  '大数据分析',
]

// Use banking presets from unified constant file
const PRESET_PEERS = INSTITUTION_PRESETS.banking.map((p) => p.name)

function getApiErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status
    return typeof status === 'number' ? status : undefined
  }

  return undefined
}

interface OnboardingWizardProps {
  orgId: string
  projectId?: string
  open: boolean
  onClose: () => void
  onComplete: () => void
}

const steps = [
  {
    label: '薄弱项识别',
    icon: TrendingUp,
  },
  {
    label: '关注技术领域',
    icon: TrendingUp,
  },
  {
    label: '关注同业机构',
    icon: Building2,
  },
]

/**
 * OnboardingWizard Component
 *
 * Three-step onboarding wizard for Radar Service.
 *
 * Story 1.4 - AC 2-6: 首次访问引导流程
 *
 * @component OnboardingWizard
 */
export default function OnboardingWizard({
  orgId,
  projectId,
  open,
  onClose,
  onComplete,
}: OnboardingWizardProps) {
  const [activeStep, setActiveStep] = useState(0)
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [selectedPeers, setSelectedPeers] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // 自定义输入状态
  const [customTopic, setCustomTopic] = useState('')
  const [customPeer, setCustomPeer] = useState('')
  const [isAddingCustomTopic, setIsAddingCustomTopic] = useState(false)
  const [isAddingCustomPeer, setIsAddingCustomPeer] = useState(false)

  const { weaknesses, isLoading: isLoadingWeaknesses } = useWeaknesses(orgId, projectId)
  const { completeOnboarding } = useOnboarding(orgId)

  // Handle next step
  const handleNext = async () => {
    setSubmitError(null)

    if (activeStep === 2) {
      // Final step - submit onboarding data
      await handleComplete()
    } else {
      setActiveStep((prev) => prev + 1)
    }
  }

  // Handle back step
  const handleBack = () => {
    setActiveStep((prev) => prev - 1)
  }

  // Complete onboarding and save preferences
  const handleComplete = async () => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Save watched topics
      if (selectedTopics.length > 0) {
        await apiFetch(`/organizations/${orgId}/watched-topics/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ names: selectedTopics }),
        })
      }

      // Save watched peers
      if (selectedPeers.length > 0) {
        await apiFetch(`/organizations/${orgId}/watched-peers/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ names: selectedPeers }),
        })
      }

      // Activate radar service
      try {
        await apiFetch(`/organizations/${orgId}/radar-activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (error) {
        const status = getApiErrorStatus(error)

        if (status === 401) {
          throw new Error('请先登录后再激活 Radar Service')
        }

        if (status === 403) {
          throw error
        }

        console.warn(
          '[OnboardingWizard] Activation API failed, but proceeding with localStorage update'
        )
      }

      // Mark onboarding as complete in localStorage
      await completeOnboarding()

      // Update radar activated status in localStorage (always do this)
      const radarActivatedKey = `radar_activated_${orgId}`
      localStorage.setItem(radarActivatedKey, 'true')
      console.log(
        '[OnboardingWizard] Set radar activated in localStorage:',
        radarActivatedKey,
        '=',
        'true'
      )

      // Notify parent component
      onComplete()
      onClose()
    } catch (error) {
      console.error('Failed to complete onboarding:', error)
      setSubmitError(error instanceof Error ? error.message : 'Failed to complete onboarding')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 添加自定义主题
  const handleAddCustomTopic = () => {
    const trimmed = customTopic.trim()
    if (trimmed && !selectedTopics.includes(trimmed)) {
      setSelectedTopics((prev) => [...prev, trimmed])
      setCustomTopic('')
      setIsAddingCustomTopic(false)
    }
  }

  // 删除主题
  const handleRemoveTopic = (topic: string) => {
    setSelectedTopics((prev) => prev.filter((t) => t !== topic))
  }

  // 添加自定义机构
  const handleAddCustomPeer = () => {
    const trimmed = customPeer.trim()
    if (trimmed && !selectedPeers.includes(trimmed)) {
      setSelectedPeers((prev) => [...prev, trimmed])
      setCustomPeer('')
      setIsAddingCustomPeer(false)
    }
  }

  // 删除机构
  const handleRemovePeer = (peer: string) => {
    setSelectedPeers((prev) => prev.filter((p) => p !== peer))
  }

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <div>
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-2">系统已自动识别您的薄弱项</h3>
            <p className="text-sm text-[#94A3B8] mb-4">
              Radar Service将优先推送与这些薄弱项相关的技术趋势、行业标杆和合规预警。
            </p>

            {isLoadingWeaknesses ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-[#1E3A5F] animate-spin" />
              </div>
            ) : weaknesses.length > 0 ? (
              <div className="space-y-2">
                {weaknesses.slice(0, 5).map((weakness: WeaknessCategory) => (
                  <div
                    key={weakness.name}
                    className="p-3 border border-[#E2E8F0] rounded-sm flex justify-between items-center"
                  >
                    <span className="text-sm">{weakness.name}</span>
                    <div className="flex gap-2 items-center">
                      <Badge
                        variant={weakness.level >= 3 ? 'destructive' : 'secondary'}
                        className="rounded-sm"
                      >
                        等级 {weakness.level}
                      </Badge>
                      <span className="text-xs text-[#94A3B8]">{weakness.count} 项</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  暂无薄弱项数据。完成评估后，系统将自动识别并显示薄弱项。
                </AlertDescription>
              </Alert>
            )}
          </div>
        )

      case 1:
        return (
          <div>
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-2">选择您关注的技术领域</h3>
            <p className="text-sm text-[#94A3B8] mb-4">
              Radar
              Service将推送这些领域的技术趋势、最佳实践和供应商推荐。您也可以自定义添加其他领域。
            </p>

            {/* 已选择的主题 */}
            {selectedTopics.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedTopics.map((topic) => (
                  <Badge key={topic} variant="secondary" className="rounded-sm pl-2 pr-1 py-1">
                    {topic}
                    <button
                      type="button"
                      onClick={() => handleRemoveTopic(topic)}
                      className="ml-1 hover:bg-slate-200 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* 预设选项 */}
            <div className="space-y-2 mb-4">
              {PRESET_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => {
                    if (!selectedTopics.includes(topic)) {
                      setSelectedTopics((prev) => [...prev, topic])
                    }
                  }}
                  disabled={selectedTopics.includes(topic)}
                  className={cn(
                    'w-full p-3 text-left border rounded-sm transition-colors',
                    selectedTopics.includes(topic)
                      ? 'border-[#059669] bg-green-50'
                      : 'border-[#E2E8F0] hover:bg-slate-50'
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{topic}</span>
                    {selectedTopics.includes(topic) && (
                      <CheckCircle className="w-4 h-4 text-[#059669]" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* 自定义添加 */}
            {isAddingCustomTopic ? (
              <div className="flex gap-2">
                <Input
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="输入自定义领域"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddCustomTopic()
                    }
                  }}
                  className="rounded-sm border-[#E2E8F0]"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleAddCustomTopic}
                  className="rounded-sm bg-[#059669] hover:bg-[#047857]"
                >
                  添加
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsAddingCustomTopic(false)
                    setCustomTopic('')
                  }}
                  className="rounded-sm"
                >
                  取消
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddingCustomTopic(true)}
                className="rounded-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                自定义领域
              </Button>
            )}
          </div>
        )

      case 2:
        return (
          <div>
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-2">选择您关注的同业机构</h3>
            <p className="text-sm text-[#94A3B8] mb-4">
              Radar
              Service将推送这些机构的技术实践案例、招聘信息和机构动态。您也可以自定义添加其他机构。
            </p>

            {/* 已选择的机构 */}
            {selectedPeers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedPeers.map((peer) => (
                  <Badge key={peer} variant="secondary" className="rounded-sm pl-2 pr-1 py-1">
                    {peer}
                    <button
                      type="button"
                      onClick={() => handleRemovePeer(peer)}
                      className="ml-1 hover:bg-slate-200 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* 预设选项 */}
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {PRESET_PEERS.map((peer) => (
                <button
                  key={peer}
                  type="button"
                  onClick={() => {
                    if (!selectedPeers.includes(peer)) {
                      setSelectedPeers((prev) => [...prev, peer])
                    }
                  }}
                  disabled={selectedPeers.includes(peer)}
                  className={cn(
                    'w-full p-3 text-left border rounded-sm transition-colors',
                    selectedPeers.includes(peer)
                      ? 'border-[#059669] bg-green-50'
                      : 'border-[#E2E8F0] hover:bg-slate-50'
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{peer}</span>
                    {selectedPeers.includes(peer) && (
                      <CheckCircle className="w-4 h-4 text-[#059669]" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* 自定义添加 */}
            {isAddingCustomPeer ? (
              <div className="flex gap-2">
                <Input
                  value={customPeer}
                  onChange={(e) => setCustomPeer(e.target.value)}
                  placeholder="输入自定义机构"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddCustomPeer()
                    }
                  }}
                  className="rounded-sm border-[#E2E8F0]"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleAddCustomPeer}
                  className="rounded-sm bg-[#059669] hover:bg-[#047857]"
                >
                  添加
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsAddingCustomPeer(false)
                    setCustomPeer('')
                  }}
                  className="rounded-sm"
                >
                  取消
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddingCustomPeer(true)}
                className="rounded-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                自定义机构
              </Button>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="rounded-sm max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-[#059669]" />
            <DialogTitle>欢迎使用 Radar Service！</DialogTitle>
          </div>
          <DialogDescription>让我们设置您的雷达偏好，只需3步即可完成配置</DialogDescription>
        </DialogHeader>

        <div className="mb-6">
          <Stepper
            steps={steps.map((step, index) => ({
              id: String(index),
              label: step.label,
              icon: <step.icon className="w-5 h-5" />,
            }))}
            currentStep={activeStep}
            className="mb-6"
          />

          {submitError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {renderStepContent()}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="rounded-sm">
            跳过
          </Button>
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={activeStep === 0 || isSubmitting}
            className="rounded-sm"
          >
            上一步
          </Button>
          <Button
            onClick={handleNext}
            disabled={isSubmitting}
            className="rounded-sm bg-[#059669] hover:bg-[#047857]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                提交中...
              </>
            ) : activeStep === 2 ? (
              '完成'
            ) : (
              '下一步'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
