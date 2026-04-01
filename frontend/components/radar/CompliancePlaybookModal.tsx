'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react'
import {
  CompliancePlaybook,
  getCompliancePlaybook,
  submitChecklist,
  markCompliancePushAsRead,
} from '@/lib/api/radar'
import { message } from '@/lib/message'
import { cn } from '@/lib/utils'
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
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  CheckCircle,
  Copy,
  Heart,
  Share,
  MailCheck,
  AlertTriangle,
  Shield,
  RefreshCw,
  ChevronDown,
  ExternalLink,
} from 'lucide-react'

/**
 * 应对剧本弹窗属性
 */
interface CompliancePlaybookModalProps {
  visible: boolean
  pushId: string
  organizationId: string
  push?: {
    complianceRiskCategory?: string
    penaltyCase?: string
    policyRequirements?: string
  }
  onClose: () => void
}

/**
 * CompliancePlaybookModal组件 - 合规应对剧本弹窗
 *
 * Story 4.3 - Phase 4 Task 4.1-4.7
 *
 * 功能：
 * - 显示完整应对剧本内容（6个区域）
 * - 自查清单勾选和提交
 * - 整改方案对比表格
 * - 汇报模板复制
 * - 政策依据链接
 * - 加载状态管理（loading, generating, failed）
 */
export const CompliancePlaybookModal: React.FC<CompliancePlaybookModalProps> = ({
  visible,
  pushId,
  organizationId,
  push,
  onClose,
}) => {
  // 状态管理
  const [playbookStatus, setPlaybookStatus] = useState<'loading' | 'generating' | 'ready' | 'failed' | 'not_found'>('loading')
  const [playbook, setPlaybook] = useState<CompliancePlaybook | null>(null)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [copyButtonText, setCopyButtonText] = useState('复制汇报模板')
  const [retryCount, setRetryCount] = useState(0)

  // 加载应对剧本数据
  useEffect(() => {
    const loadPlaybook = async () => {
      if (!pushId || !visible || !organizationId) return

      try {
        setPlaybookStatus('loading')
        const data = await getCompliancePlaybook(pushId, organizationId)
        setPlaybook(data)
        setPlaybookStatus('ready')

        // 加载本地保存的勾选状态
        const saved = localStorage.getItem(`checklist-${pushId}`)
        if (saved) {
          setCheckedItems(new Set(JSON.parse(saved)))
        }
      } catch (error: any) {
        // 剧本生成中，3秒后重试
        if (error.status === 202) {
          setPlaybookStatus('generating')
          setTimeout(() => loadPlaybook(), 3000)
        }
        // 剧本不存在（尚未生成）
        else if (error.status === 404) {
          setPlaybookStatus('not_found')
        }
        // 剧本生成失败
        else if (error.status === 500) {
          setPlaybookStatus('failed')
        } else {
          message.error('获取应对剧本失败')
          setPlaybookStatus('failed')
        }
      }
    }

    loadPlaybook()
  }, [pushId, visible, organizationId, retryCount])

  // 持久化勾选状态
  useEffect(() => {
    if (pushId && visible) {
      localStorage.setItem(`checklist-${pushId}`, JSON.stringify([...checkedItems]))
    }
  }, [checkedItems, pushId, visible])

  // 勾选/取消勾选自查项
  const handleToggleCheck = (itemId: string) => {
    setCheckedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  // 提交自查结果
  const handleSubmitChecklist = async () => {
    if (!playbook) return

    // 数据完整性验证
    const checkedArray = Array.from(checkedItems)
    const uncheckedArray = playbook.checklistItems
      .filter((item) => !checkedItems.has(item.id))
      .map((item) => item.id)

    if (checkedArray.length === 0) {
      message.error('至少需要勾选一项')
      return
    }

    try {
      await submitChecklist(pushId, organizationId, {
        checkedItems: checkedArray,
        uncheckedItems: uncheckedArray,
      })

      message.success('自查完成！建议选择整改方案并向上级汇报')
      setSubmitted(true)
    } catch (error: any) {
      if (error.status === 400) {
        message.error('数据不完整，请检查所有项目')
      } else if (error.status === 404) {
        message.error('应对剧本不存在')
      } else {
        message.error('提交失败，请稍后重试')
      }
    }
  }

  // 复制汇报模板
  const handleCopyTemplate = async () => {
    if (!playbook) return

    const reportTemplate = playbook.reportTemplate

    // 优先使用 clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(reportTemplate)
        message.success('已复制！可直接粘贴到邮件或报告中')
        setCopyButtonText('已复制！')
        setTimeout(() => setCopyButtonText('复制汇报模板'), 1000)
        return
      } catch (err) {
        console.warn('Clipboard API failed, falling back to execCommand', err)
      }
    }

    // 降级方案: execCommand
    const textarea = document.createElement('textarea')
    textarea.value = reportTemplate
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()

    const successful = document.execCommand('copy')
    document.body.removeChild(textarea)

    if (successful) {
      message.success('已复制！请手动粘贴 (Ctrl+C)')
      setCopyButtonText('已复制！')
      setTimeout(() => setCopyButtonText('复制汇报模板'), 1000)
    } else {
      message.error('复制失败，请手动选择文本复制')
    }
  }

  // 计算完成进度
  const completedCount = checkedItems.size
  const totalCount = playbook?.checklistItems.length || 0
  const isAllChecked = completedCount === totalCount && totalCount > 0

  return (
    <Dialog open={visible} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-600" />
            <span className="text-xl font-bold font-[var(--font-plus-jakarta)] text-[#1E3A5F]">
              合规应对剧本
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 加载状态 */}
          {playbookStatus === 'loading' && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[#94A3B8] mt-3">正在加载应对剧本...</p>
            </div>
          )}

          {/* 生成中状态 */}
          {playbookStatus === 'generating' && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[#94A3B8] mt-3">正在生成应对剧本，请稍候...</p>
              <p className="text-xs text-[#94A3B8]">(系统将在3秒后自动重试)</p>
            </div>
          )}

          {/* 剧本尚未生成 */}
          {playbookStatus === 'not_found' && (
            <Alert className="rounded-sm">
              <AlertDescription>该推送暂无应对剧本数据</AlertDescription>
            </Alert>
          )}

          {/* 失败状态 */}
          {playbookStatus === 'failed' && (
            <div className="space-y-3 py-4">
              <Alert variant="destructive" className="rounded-sm">
                <AlertDescription>应对剧本生成失败，请联系管理员</AlertDescription>
              </Alert>
              <Button
                variant="outline"
                onClick={() => setRetryCount((prev) => prev + 1)}
                className="rounded-sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                重试
              </Button>
            </div>
          )}

          {/* 准备就绪 - 显示完整内容 */}
          {playbookStatus === 'ready' && playbook && (
            <div className="space-y-4">
              {/* Part 1: 风险详情区域 */}
              <CollapsibleSection
                title="风险详情"
                icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
                defaultOpen
              >
                <div className="space-y-4">
                  {/* 风险类别 */}
                  <div>
                    <p className="text-sm text-[#94A3B8] mb-1.5">风险类别：</p>
                    <Badge className="rounded-sm bg-red-600 text-white">
                      {push?.complianceRiskCategory || '合规风险'}
                    </Badge>
                  </div>

                  {/* 政策要求 */}
                  <div>
                    <p className="text-sm text-[#94A3B8] mb-2">政策要求：</p>
                    {push?.policyRequirements ? (
                      <ul className="space-y-1.5">
                        {(() => {
                          // 智能分割政策要求，支持多种格式
                          let requirements = push.policyRequirements.split('\n').filter((r) => r.trim())
                          if (requirements.length === 1 && requirements[0].length > 100) {
                            requirements = requirements[0].split(/。(?=[^。]*$)/).filter((r) => r.trim())
                            if (requirements.length === 1) {
                              requirements = requirements[0].split(/；/).filter((r) => r.trim())
                            }
                          }
                          return requirements.map((req, idx) => (
                            <li key={idx} className="text-sm text-[#1E3A5F] pl-2">
                              • {req.trim()}
                            </li>
                          ))
                        })()}
                      </ul>
                    ) : (
                      <p className="text-sm text-[#94A3B8]">暂无政策要求信息</p>
                    )}
                  </div>

                  {/* 信息来源 */}
                  <p className="text-xs text-[#94A3B8]">
                    生成时间: {new Date(playbook.generatedAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </CollapsibleSection>

              {/* Part 2: 自查清单区域 */}
              <CollapsibleSection
                title="自查清单"
                icon={<CheckCircle className="w-4 h-4 text-emerald-600" />}
                badge={`已完成 ${completedCount}/${totalCount}`}
                defaultOpen
              >
                <div className="space-y-2">
                  {playbook.checklistItems.map((item) => (
                    <Card
                      key={item.id}
                      className={cn(
                        'p-3 rounded-sm border cursor-pointer transition-colors',
                        checkedItems.has(item.id)
                          ? 'border-[#059669] bg-green-50'
                          : 'border-[#E2E8F0] hover:bg-slate-50'
                      )}
                      onClick={() => handleToggleCheck(item.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={checkedItems.has(item.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <p className="text-sm text-[#1E3A5F]">
                            {item.order + 1}. {item.text}
                          </p>
                          <Badge variant="outline" className="rounded-sm text-xs mt-1">
                            {item.category}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  ))}

                  {/* 提交按钮 */}
                  <div className="flex justify-end pt-2">
                    <Button
                      className="rounded-sm bg-[#059669] hover:bg-[#047857]"
                      disabled={!isAllChecked || submitted}
                      onClick={handleSubmitChecklist}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {submitted ? '已提交' : '提交自查结果'}
                    </Button>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Part 3: 整改方案对比区域 */}
              <CollapsibleSection
                title="整改方案对比"
                badge="推荐方案已高亮"
                defaultOpen
              >
                <Card className="rounded-sm border border-[#E2E8F0] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 border-b border-[#E2E8F0]">
                        <th className="px-4 py-2 text-left font-semibold text-[#1E3A5F]">方案名称</th>
                        <th className="px-4 py-2 text-left font-semibold text-[#1E3A5F]">投入成本</th>
                        <th className="px-4 py-2 text-left font-semibold text-[#1E3A5F]">预期收益</th>
                        <th className="px-4 py-2 text-left font-semibold text-[#1E3A5F]">ROI评分</th>
                        <th className="px-4 py-2 text-left font-semibold text-[#1E3A5F]">实施周期</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playbook.solutions.map((solution) => {
                        const maxRoiScore = Math.max(...playbook.solutions.map((s) => s.roiScore))
                        const isRecommended = solution.roiScore === maxRoiScore

                        return (
                          <tr
                            key={solution.name}
                            className={cn(
                              'border-b border-[#E2E8F0] last:border-b-0',
                              isRecommended && 'bg-green-50'
                            )}
                          >
                            <td className={cn('px-4 py-3', isRecommended && 'font-semibold')}>
                              {solution.name}
                              {isRecommended && (
                                <Badge className="rounded-sm bg-[#059669] text-white text-xs ml-2">
                                  推荐
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">¥{solution.estimatedCost.toLocaleString()}</td>
                            <td className="px-4 py-3">¥{solution.expectedBenefit.toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full',
                                      isRecommended ? 'bg-[#059669]' : 'bg-[#1E3A5F]'
                                    )}
                                    style={{ width: `${(solution.roiScore / 10) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs">{solution.roiScore.toFixed(1)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">{solution.implementationTime}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </Card>
              </CollapsibleSection>

              {/* Part 4: 汇报模板区域 */}
              <CollapsibleSection title="汇报模板">
                <div className="space-y-3">
                  <Card className="rounded-sm border border-[#E2E8F0] bg-slate-50 p-4">
                    <pre className="text-sm font-mono whitespace-pre-wrap text-[#1E3A5F]">
                      {playbook.reportTemplate}
                    </pre>
                  </Card>
                  <Button
                    variant="outline"
                    onClick={handleCopyTemplate}
                    className="rounded-sm w-full"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {copyButtonText}
                  </Button>
                </div>
              </CollapsibleSection>

              {/* Part 5: 政策依据区域 */}
              <CollapsibleSection title="政策依据">
                <ul className="space-y-2">
                  {playbook.policyReference.map((policy, idx) => (
                    <li key={idx}>
                      {/^https?:\/\//.test(policy) ? (
                        <a
                          href={policy}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {policy}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <p className="text-sm text-[#94A3B8]">{policy}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            </div>
          )}
        </div>

        {/* Part 6: 操作按钮区域 */}
        <DialogFooter className="flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => message.info('收藏功能开发中')}
            className="rounded-sm"
          >
            <Heart className="w-4 h-4 mr-2" />
            收藏
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const shareUrl = `${window.location.origin}/radar/compliance?pushId=${pushId}`
              navigator.clipboard.writeText(shareUrl).then(() => {
                message.success('分享链接已复制到剪贴板')
              }).catch(() => {
                message.error('复制失败，请手动复制链接')
              })
            }}
            className="rounded-sm"
          >
            <Share className="w-4 h-4 mr-2" />
            分享
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await markCompliancePushAsRead(pushId)
                message.success('已标记为已读')
                onClose()
              } catch {
                message.error('标记失败，请稍后重试')
              }
            }}
            className="rounded-sm"
          >
            <MailCheck className="w-4 h-4 mr-2" />
            标记已读
          </Button>
          <div className="w-px h-8 bg-[#E2E8F0]" />
          <Button variant="outline" onClick={onClose} className="rounded-sm">
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 可折叠区域辅助组件
interface CollapsibleSectionProps {
  title: string
  icon?: React.ReactNode
  badge?: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function CollapsibleSection({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-white border border-[#E2E8F0] rounded-sm hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-[#1E3A5F]">{title}</span>
          {badge && (
            <Badge variant="outline" className="rounded-sm text-xs">
              {badge}
            </Badge>
          )}
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-[#94A3B8] transition-transform',
            isOpen && 'transform rotate-180'
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
