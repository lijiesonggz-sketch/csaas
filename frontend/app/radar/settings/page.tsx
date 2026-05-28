'use client'

export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 雷达配置管理页面 (Story 5.1 - Phase 3)
 *
 * 功能：
 * - 显示关注技术领域列表
 * - 添加关注领域（预设选项 + 自定义输入）
 * - 删除关注领域（带确认）
 * - 空状态友好提示
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Trash2, ChevronRight, Save, Clock, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { formatChinaDate } from '@/lib/utils/dateTime'
import {
  getWatchedTopics,
  createWatchedTopic,
  deleteWatchedTopic,
  WatchedTopic,
  getWatchedPeers,
  createWatchedPeer,
  deleteWatchedPeer,
  WatchedPeer,
  getPushPreference,
  updatePushPreference,
  UpdatePushPreferenceDto,
} from '@/lib/api/radar'
import {
  INSTITUTION_PRESETS,
  INDUSTRY_LABELS,
  IndustryKey,
} from '@/lib/constants/institution-presets'
import { message } from '@/lib/message'
import { cn } from '@/lib/utils'

function extractOrganizationId(payload: unknown): string | null {
  const data = payload as {
    data?: { organization?: { id?: string } }
    organization?: { id?: string }
  } | null

  return data?.data?.organization?.id || data?.organization?.id || null
}

// 预设技术领域选项
const PRESET_TOPICS = [
  { name: '云原生', desc: '容器化、微服务、Kubernetes等' },
  { name: 'AI应用', desc: '机器学习、大模型、智能客服等' },
  { name: '移动金融安全', desc: '移动端安全、生物识别等' },
  { name: '成本优化', desc: 'FinOps、资源优化等' },
  { name: 'DevOps', desc: 'CI/CD、自动化运维等' },
  { name: '数据安全', desc: '数据加密、隐私保护等' },
  { name: '区块链', desc: '分布式账本、智能合约等' },
  { name: '开放银行', desc: 'Open API、生态合作等' },
]

export default function RadarSettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlOrgId = searchParams?.get('orgId') ?? null
  const [topics, setTopics] = useState<WatchedTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState('')
  const [customTopic, setCustomTopic] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [authError, setAuthError] = useState(false)

  // Story 5.2: WatchedPeer state
  const [peers, setPeers] = useState<WatchedPeer[]>([])
  const [peersLoading, setPeersLoading] = useState(true)
  const [addPeerModalVisible, setAddPeerModalVisible] = useState(false)
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryKey>('banking')
  const [selectedPeer, setSelectedPeer] = useState('')
  const [customPeerName, setCustomPeerName] = useState('')
  const [customInstitutionType, setCustomInstitutionType] = useState('')
  const [peerSubmitting, setPeerSubmitting] = useState(false)

  // Story 5.3: PushPreference state
  const [preferenceLoading, setPreferenceLoading] = useState(true)
  const [preferenceSaving, setPreferenceSaving] = useState(false)
  const [deleteTopicDialog, setDeleteTopicDialog] = useState<{
    open: boolean
    topicId: string
    topicName: string
  }>({ open: false, topicId: '', topicName: '' })
  const [deletePeerDialog, setDeletePeerDialog] = useState<{
    open: boolean
    peerId: string
    peerName: string
  }>({ open: false, peerId: '', peerName: '' })
  const [pushStartTime, setPushStartTime] = useState('09:00')
  const [pushEndTime, setPushEndTime] = useState('18:00')
  const [dailyPushLimit, setDailyPushLimit] = useState<number>(5)
  const [relevanceFilter, setRelevanceFilter] = useState<'high_only' | 'high_medium'>('high_only')

  // 获取 organizationId：以后端当前用户组织为准，避免复用 localStorage 中的旧组织 ID。
  useEffect(() => {
    if (typeof window === 'undefined') return

    let active = true

    const resolveOrganization = async () => {
      try {
        const response = await fetch('/api/organizations/me', { cache: 'no-store' })

        if (!response.ok) {
          throw new Error('未找到组织信息，请从雷达首页进入')
        }

        const currentOrgId = extractOrganizationId(await response.json())

        if (!currentOrgId) {
          throw new Error('未找到组织信息，请从雷达首页进入')
        }

        if (!active) return

        setOrganizationId(currentOrgId)
        localStorage.setItem('organizationId', currentOrgId)

        if (urlOrgId && urlOrgId !== currentOrgId) {
          router.replace(`/radar/settings?orgId=${currentOrgId}`)
        }
      } catch (error) {
        if (!active) return

        localStorage.removeItem('organizationId')
        setAuthError(true)
        message.error(error instanceof Error ? error.message : '未找到组织信息，请从雷达首页进入')
      }
    }

    void resolveOrganization()

    return () => {
      active = false
    }
  }, [router, urlOrgId])

  const loadTopics = useCallback(async () => {
    if (!organizationId) return

    setLoading(true)
    try {
      const data = await getWatchedTopics(organizationId)
      setTopics(data)
    } catch (error) {
      message.error(getErrorMessage(error, '加载失败'))
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  const handleAdd = async () => {
    if (!organizationId) {
      message.error('组织信息缺失，无法添加')
      return
    }

    const topicName = selectedTopic || customTopic
    if (!topicName) {
      message.warning('请选择或输入领域名称')
      return
    }

    setSubmitting(true)
    try {
      await createWatchedTopic(organizationId, {
        topicName,
        topicType: 'tech',
      })
      message.success('已添加关注领域!系统将推送相关技术趋势')
      setAddModalVisible(false)
      setSelectedTopic('')
      setCustomTopic('')
      loadTopics()
    } catch (error) {
      message.error(getErrorMessage(error, '添加失败'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = (topicId: string, topicName: string) => {
    setDeleteTopicDialog({ open: true, topicId, topicName })
  }

  const handleConfirmDeleteTopic = async () => {
    if (!organizationId) {
      message.error('组织信息缺失')
      return
    }
    try {
      await deleteWatchedTopic(deleteTopicDialog.topicId, organizationId)
      message.success('已取消关注')
      setDeleteTopicDialog({ open: false, topicId: '', topicName: '' })
      loadTopics()
    } catch (error) {
      message.error(getErrorMessage(error, '删除失败'))
    }
  }

  const formatDate = (dateString: string) => {
    return formatChinaDate(dateString, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  // Story 5.2: Load watched peers
  const loadPeers = useCallback(async () => {
    if (!organizationId) return

    setPeersLoading(true)
    try {
      const data = await getWatchedPeers(organizationId)
      setPeers(data)
    } catch (error) {
      message.error(getErrorMessage(error, '加载关注同业失败'))
    } finally {
      setPeersLoading(false)
    }
  }, [organizationId])

  // Story 5.2: Add watched peer
  const handleAddPeer = async () => {
    if (!organizationId) {
      message.error('组织信息缺失，无法添加')
      return
    }

    let peerName = ''
    const industry = selectedIndustry
    let institutionType = ''

    if (selectedPeer) {
      const preset = INSTITUTION_PRESETS[selectedIndustry].find((p) => p.name === selectedPeer)
      if (preset) {
        peerName = preset.name
        institutionType = preset.type
      }
    } else if (customPeerName && customInstitutionType) {
      peerName = customPeerName
      institutionType = customInstitutionType
    }

    if (!peerName || !institutionType) {
      message.warning('请选择或输入完整的同业机构信息')
      return
    }

    setPeerSubmitting(true)
    try {
      await createWatchedPeer(organizationId, {
        peerName,
        industry,
        institutionType,
      })
      message.success('已添加关注同业!系统将推送相关行业动态')
      setAddPeerModalVisible(false)
      setSelectedPeer('')
      setCustomPeerName('')
      setCustomInstitutionType('')
      loadPeers()
    } catch (error) {
      message.error(getErrorMessage(error, '添加失败'))
    } finally {
      setPeerSubmitting(false)
    }
  }

  // Story 5.2: Delete watched peer
  const handleDeletePeer = (peerId: string, peerName: string) => {
    setDeletePeerDialog({ open: true, peerId, peerName })
  }

  const handleConfirmDeletePeer = async () => {
    if (!organizationId) {
      message.error('组织信息缺失')
      return
    }
    try {
      await deleteWatchedPeer(deletePeerDialog.peerId, organizationId)
      message.success('已取消关注')
      setDeletePeerDialog({ open: false, peerId: '', peerName: '' })
      loadPeers()
    } catch (error) {
      message.error(getErrorMessage(error, '删除失败'))
    }
  }

  // Story 5.2: Get industry and institution type labels
  const getIndustryLabel = (industry: string) => {
    return INDUSTRY_LABELS[industry as IndustryKey] || industry
  }

  // Story 5.3: Load push preference
  const loadPushPreference = useCallback(async () => {
    if (!organizationId) return

    setPreferenceLoading(true)
    try {
      const data = await getPushPreference(organizationId)
      setPushStartTime(data.pushStartTime)
      setPushEndTime(data.pushEndTime)
      setDailyPushLimit(data.dailyPushLimit)
      setRelevanceFilter(data.relevanceFilter)
    } catch (error) {
      message.error(getErrorMessage(error, '加载推送偏好失败'))
    } finally {
      setPreferenceLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    if (organizationId) {
      void loadTopics()
      void loadPeers()
      void loadPushPreference()
    }
  }, [loadPeers, loadPushPreference, loadTopics, organizationId])

  // Story 5.3: Save push preference
  const handleSavePreference = async () => {
    if (!organizationId) {
      message.error('组织信息缺失，无法保存')
      return
    }

    // Validate time range
    if (!pushStartTime || !pushEndTime) {
      message.warning('请设置推送时段')
      return
    }

    // Check if start time equals end time
    if (pushStartTime === pushEndTime) {
      message.warning('开始时间和结束时间不能相同')
      return
    }

    // Validate time span (at least 1 hour)
    const [startHour, startMinute] = pushStartTime.split(':').map(Number)
    const [endHour, endMinute] = pushEndTime.split(':').map(Number)
    const startMinutes = startHour * 60 + startMinute
    const endMinutes = endHour * 60 + endMinute
    let spanMinutes: number
    if (startMinutes < endMinutes) {
      spanMinutes = endMinutes - startMinutes
    } else {
      // Overnight: e.g., 22:00-08:00 = (24:00-22:00) + 08:00 = 600 minutes
      spanMinutes = 24 * 60 - startMinutes + endMinutes
    }
    if (spanMinutes < 60) {
      message.warning('时段跨度至少 1 小时')
      return
    }

    setPreferenceSaving(true)
    try {
      const dto: UpdatePushPreferenceDto = {
        pushStartTime,
        pushEndTime,
        dailyPushLimit,
        relevanceFilter,
      }
      await updatePushPreference(organizationId, dto)
      message.success('推送偏好已更新')
      loadPushPreference()
    } catch (error) {
      message.error(getErrorMessage(error, '保存失败'))
    } finally {
      setPreferenceSaving(false)
    }
  }

  // 如果认证失败，显示错误状态
  if (authError) {
    return (
      <div className="min-h-screen bg-[#FEFDFB] p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <h2 className="text-2xl font-semibold text-red-600 mb-2">无法访问</h2>
          <p className="text-[#94A3B8] mb-4">未找到组织信息，请从雷达首页进入</p>
          <Button
            onClick={() => router.push('/radar')}
            className="rounded-sm bg-[#1E3A5F] hover:bg-[#152a47]"
          >
            返回雷达首页
          </Button>
        </div>
      </div>
    )
  }

  // 等待 organizationId 加载
  if (!organizationId) {
    return (
      <div className="min-h-screen bg-[#FEFDFB] p-6">
        <div className="max-w-6xl mx-auto animate-pulse">
          <div className="h-96 bg-slate-200 rounded-sm" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FEFDFB] p-6">
      <div className="max-w-6xl mx-auto">
        {/* 面包屑导航 */}
        <nav className="mb-4 text-sm">
          <ol className="flex items-center gap-2 text-[#94A3B8]">
            <li>
              <button
                onClick={() =>
                  router.push(`/radar${organizationId ? `?orgId=${organizationId}` : ''}`)
                }
                className="hover:text-[#1E3A5F] transition-colors"
              >
                雷达首页
              </button>
            </li>
            <li>
              <ChevronRight className="w-4 h-4" />
            </li>
            <li className="text-[#1E3A5F]">配置管理</li>
          </ol>
        </nav>

        {/* 页面标题 */}
        <h1 className="text-3xl font-bold font-[var(--font-plus-jakarta)] text-[#1E3A5F] mb-6">
          雷达配置管理
        </h1>

        {/* 关注技术领域配置区域 */}
        <Card className="border border-[#E2E8F0] rounded-sm shadow-sm mb-6">
          <div className="p-6 border-b border-[#E2E8F0] flex items-center justify-between">
            <h2 className="text-xl font-semibold font-[var(--font-plus-jakarta)] text-[#1E3A5F]">
              关注技术领域
            </h2>
            <Button
              onClick={() => setAddModalVisible(true)}
              className="rounded-sm bg-[#059669] hover:bg-[#047857]"
            >
              <Plus className="w-4 h-4 mr-2" />
              添加关注领域
            </Button>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 bg-slate-200 animate-pulse rounded-sm" />
                ))}
              </div>
            ) : topics.length === 0 ? (
              <EmptyState description="暂无关注领域,点击上方按钮添加" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {topics.map((topic) => (
                  <Card key={topic.id} className="border border-[#E2E8F0] rounded-sm shadow-sm p-4">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-semibold text-[#1E3A5F] mb-2">
                        {topic.topicName}
                      </h3>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(topic.id, topic.topicName)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-[#94A3B8]">
                      添加时间: {formatDate(topic.createdAt)}
                    </p>
                    {topic.relatedPushCount !== undefined && topic.relatedPushCount > 0 && (
                      <p className="text-xs text-[#059669] mt-2">
                        已推送 {topic.relatedPushCount} 条相关内容
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Story 5.2: 关注同业机构配置区域 */}
        <Card className="border border-[#E2E8F0] rounded-sm shadow-sm mb-6">
          <div className="p-6 border-b border-[#E2E8F0] flex items-center justify-between">
            <h2 className="text-xl font-semibold font-[var(--font-plus-jakarta)] text-[#1E3A5F]">
              关注同业机构
            </h2>
            <Button
              onClick={() => setAddPeerModalVisible(true)}
              className="rounded-sm bg-[#059669] hover:bg-[#047857]"
            >
              <Plus className="w-4 h-4 mr-2" />
              添加关注同业
            </Button>
          </div>
          <div className="p-6">
            {peersLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 bg-slate-200 animate-pulse rounded-sm" />
                ))}
              </div>
            ) : peers.length === 0 ? (
              <EmptyState description="暂无关注同业,点击上方按钮添加" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {peers.map((peer) => (
                  <Card key={peer.id} className="border border-[#E2E8F0] rounded-sm shadow-sm p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-semibold text-[#1E3A5F] mb-1">
                          {peer.peerName}
                        </h3>
                        <div className="flex gap-1 mb-2">
                          <Badge variant="outline" className="rounded-sm text-xs">
                            {getIndustryLabel(peer.industry)}
                          </Badge>
                          <Badge variant="outline" className="rounded-sm text-xs">
                            {peer.institutionType}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeletePeer(peer.id, peer.peerName)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-[#94A3B8]">添加时间: {formatDate(peer.createdAt)}</p>
                    {peer.relatedPushCount !== undefined && peer.relatedPushCount > 0 && (
                      <p className="text-xs text-[#059669] mt-2">
                        已推送 {peer.relatedPushCount} 条相关内容
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Story 5.3: 推送偏好配置区域 */}
        <Card className="border border-[#E2E8F0] rounded-sm shadow-sm">
          <div className="p-6 border-b border-[#E2E8F0] flex items-center justify-between">
            <h2 className="text-xl font-semibold font-[var(--font-plus-jakarta)] text-[#1E3A5F]">
              推送偏好设置
            </h2>
            <Button
              onClick={handleSavePreference}
              disabled={preferenceSaving}
              className="rounded-sm bg-[#1E3A5F] hover:bg-[#152a47]"
            >
              <Save className="w-4 h-4 mr-2" />
              {preferenceSaving ? '保存中...' : '保存设置'}
            </Button>
          </div>
          <div className="p-6">
            {preferenceLoading ? (
              <div className="h-48 bg-slate-200 animate-pulse rounded-sm" />
            ) : (
              <div className="space-y-6">
                {/* 推送时段设置 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1E3A5F] mb-3 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      推送时段
                    </h3>
                    <div className="flex items-center gap-3">
                      <Input
                        type="time"
                        value={pushStartTime}
                        onChange={(e) => setPushStartTime(e.target.value)}
                        className="rounded-sm border-[#E2E8F0] w-32"
                      />
                      <span className="text-[#94A3B8]">至</span>
                      <Input
                        type="time"
                        value={pushEndTime}
                        onChange={(e) => setPushEndTime(e.target.value)}
                        className="rounded-sm border-[#E2E8F0] w-32"
                      />
                    </div>
                    <p className="text-xs text-[#94A3B8] mt-2">
                      系统仅在设置的时段内推送消息（合规雷达除外）
                    </p>
                  </div>

                  {/* 单日推送上限 */}
                  <div>
                    <h3 className="text-lg font-semibold text-[#1E3A5F] mb-3 flex items-center gap-2">
                      <SlidersHorizontal className="w-5 h-5" />
                      单日推送上限: {dailyPushLimit} 条
                    </h3>
                    <Slider
                      min={1}
                      max={20}
                      value={[dailyPushLimit]}
                      onValueChange={(value) => setDailyPushLimit(value[0])}
                      step={1}
                      className="my-4"
                    />
                    <div className="flex justify-between text-xs text-[#94A3B8]">
                      <span>1条</span>
                      <span>5条</span>
                      <span>10条</span>
                      <span>15条</span>
                      <span>20条</span>
                    </div>
                    <p className="text-xs text-[#94A3B8] mt-2">
                      范围：1-20 条，超出上限的推送将自动延迟到次日
                    </p>
                  </div>
                </div>

                {/* 相关性过滤 */}
                <div>
                  <h3 className="text-lg font-semibold text-[#1E3A5F] mb-3">相关性过滤</h3>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer p-3 border border-[#E2E8F0] rounded-sm hover:bg-slate-50 transition-colors">
                      <input
                        type="radio"
                        name="relevance"
                        value="high_only"
                        checked={relevanceFilter === 'high_only'}
                        onChange={(e) =>
                          setRelevanceFilter(e.target.value as 'high_only' | 'high_medium')
                        }
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium text-[#1E3A5F]">仅推送高相关内容</p>
                        <p className="text-sm text-[#94A3B8]">相关性评分 ≥ 0.9</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer p-3 border border-[#E2E8F0] rounded-sm hover:bg-slate-50 transition-colors">
                      <input
                        type="radio"
                        name="relevance"
                        value="high_medium"
                        checked={relevanceFilter === 'high_medium'}
                        onChange={(e) =>
                          setRelevanceFilter(e.target.value as 'high_only' | 'high_medium')
                        }
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium text-[#1E3A5F]">推送高+中相关内容</p>
                        <p className="text-sm text-[#94A3B8]">相关性评分 ≥ 0.7</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* 添加关注领域弹窗 */}
        <Dialog
          open={addModalVisible}
          onOpenChange={(open) => !submitting && setAddModalVisible(open)}
        >
          <DialogContent className="rounded-sm max-w-lg">
            <DialogHeader>
              <DialogTitle>添加关注领域</DialogTitle>
              <DialogDescription>选择预设领域或输入自定义领域名称</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {PRESET_TOPICS.map((topic) => (
                <label
                  key={topic.name}
                  className={cn(
                    'flex items-start gap-3 p-3 border rounded-sm cursor-pointer transition-colors',
                    selectedTopic === topic.name
                      ? 'border-[#059669] bg-green-50'
                      : 'border-[#E2E8F0] hover:bg-slate-50'
                  )}
                >
                  <input
                    type="radio"
                    name="topic"
                    value={topic.name}
                    checked={selectedTopic === topic.name}
                    onChange={(e) => {
                      setSelectedTopic(e.target.value)
                      setCustomTopic('')
                    }}
                    disabled={submitting}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-[#1E3A5F]">{topic.name}</p>
                    <p className="text-sm text-[#94A3B8]">{topic.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 h-px bg-[#E2E8F0]" />
              <span className="text-sm text-[#94A3B8]">或</span>
              <div className="flex-1 h-px bg-[#E2E8F0]" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-topic">自定义领域名称</Label>
              <Input
                id="custom-topic"
                value={customTopic}
                onChange={(e) => {
                  setCustomTopic(e.target.value)
                  setSelectedTopic('')
                }}
                placeholder="输入自定义技术领域"
                disabled={submitting}
                className="rounded-sm border-[#E2E8F0]"
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAddModalVisible(false)}
                disabled={submitting}
                className="rounded-sm"
              >
                取消
              </Button>
              <Button
                onClick={handleAdd}
                disabled={submitting}
                className="rounded-sm bg-[#059669] hover:bg-[#047857]"
              >
                {submitting ? '提交中...' : '确认'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Story 5.2: 添加关注同业弹窗 */}
        <Dialog
          open={addPeerModalVisible}
          onOpenChange={(open) => !peerSubmitting && setAddPeerModalVisible(open)}
        >
          <DialogContent className="rounded-sm max-w-lg">
            <DialogHeader>
              <DialogTitle>添加关注同业</DialogTitle>
              <DialogDescription>选择预设机构或输入自定义机构</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* 行业选择 */}
              <div className="space-y-2">
                <Label htmlFor="industry-select">行业类别</Label>
                <Select
                  value={selectedIndustry}
                  onValueChange={(value) => {
                    setSelectedIndustry(value as IndustryKey)
                    setSelectedPeer('')
                  }}
                  disabled={peerSubmitting}
                >
                  <SelectTrigger className="rounded-sm border-[#E2E8F0]">
                    <SelectValue placeholder="选择行业" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INDUSTRY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 预设选项 */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {INSTITUTION_PRESETS[selectedIndustry].map((peer) => (
                  <label
                    key={peer.name}
                    className={cn(
                      'flex items-start gap-3 p-3 border rounded-sm cursor-pointer transition-colors',
                      selectedPeer === peer.name
                        ? 'border-[#059669] bg-green-50'
                        : 'border-[#E2E8F0] hover:bg-slate-50'
                    )}
                  >
                    <input
                      type="radio"
                      name="peer"
                      value={peer.name}
                      checked={selectedPeer === peer.name}
                      onChange={(e) => {
                        setSelectedPeer(e.target.value)
                        setCustomPeerName('')
                      }}
                      disabled={peerSubmitting}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-[#1E3A5F]">{peer.name}</p>
                      <p className="text-sm text-[#94A3B8]">
                        {peer.type} - {peer.desc}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-[#E2E8F0]" />
                <span className="text-sm text-[#94A3B8]">或</span>
                <div className="flex-1 h-px bg-[#E2E8F0]" />
              </div>

              {/* 自定义输入 */}
              <div className="space-y-2">
                <Label htmlFor="custom-peer">自定义机构名称</Label>
                <Input
                  id="custom-peer"
                  value={customPeerName}
                  onChange={(e) => {
                    setCustomPeerName(e.target.value)
                    setSelectedPeer('')
                  }}
                  placeholder="输入自定义机构名称"
                  disabled={peerSubmitting}
                  className="rounded-sm border-[#E2E8F0]"
                />
              </div>

              {/* 自定义类型输入 */}
              {customPeerName && (
                <div className="space-y-2">
                  <Label htmlFor="institution-type">机构类型</Label>
                  <Input
                    id="institution-type"
                    value={customInstitutionType}
                    onChange={(e) => setCustomInstitutionType(e.target.value)}
                    placeholder="例如：城商行、券商、寿险公司"
                    disabled={peerSubmitting}
                    className="rounded-sm border-[#E2E8F0]"
                  />
                  <p className="text-xs text-[#94A3B8]">请输入机构的具体类型</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAddPeerModalVisible(false)}
                disabled={peerSubmitting}
                className="rounded-sm"
              >
                取消
              </Button>
              <Button
                onClick={handleAddPeer}
                disabled={peerSubmitting}
                className="rounded-sm bg-[#059669] hover:bg-[#047857]"
              >
                {peerSubmitting ? '提交中...' : '确认'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 删除关注领域确认对话框 */}
        <ConfirmDialog
          open={deleteTopicDialog.open}
          title="确定取消关注该领域吗?"
          content={`取消后,系统将不再推送"${deleteTopicDialog.topicName}"相关内容`}
          confirmText="确定"
          cancelText="取消"
          confirmColor="error"
          onConfirm={handleConfirmDeleteTopic}
          onCancel={() => setDeleteTopicDialog({ open: false, topicId: '', topicName: '' })}
        />

        {/* 删除关注同业确认对话框 */}
        <ConfirmDialog
          open={deletePeerDialog.open}
          title="确定取消关注该同业机构吗?"
          content={`取消后,系统将不再推送"${deletePeerDialog.peerName}"相关内容`}
          confirmText="确定"
          cancelText="取消"
          confirmColor="error"
          onConfirm={handleConfirmDeletePeer}
          onCancel={() => setDeletePeerDialog({ open: false, peerId: '', peerName: '' })}
        />
      </div>
    </div>
  )
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback
