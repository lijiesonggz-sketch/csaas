'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { PeerCrawlerSourceList } from '@/components/admin/PeerCrawlerSourceList'
import { PeerCrawlerSourceForm } from '@/components/admin/PeerCrawlerSourceForm'
import { TestCrawlDialog } from '@/components/admin/TestCrawlDialog'
import {
  RadarSource,
  getRadarSources,
  createRadarSource,
  updateRadarSource,
  deleteRadarSource,
  toggleRadarSourceActive,
  testRadarSourceCrawl,
  CreateRadarSourceData,
  UpdateRadarSourceData,
} from '@/lib/api/radar-sources'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

/**
 * 同业采集源管理页面
 *
 * Story 8.1: 同业采集源管理
 *
 * 功能：
 * - 显示同业采集源列表（category=industry）
 * - 按来源类型筛选（website/wechat/recruitment/conference）
 * - 创建、编辑、删除采集源
 * - 启用/禁用采集源
 * - 测试采集功能
 */
export default function PeerCrawlerPage() {
  const router = useRouter()
  const { data: session } = useSession()

  // 权限检查：只允许 admin 和 consultant 访问
  useEffect(() => {
    if (session?.user && !['admin', 'consultant'].includes(session.user.role)) {
      router.push('/')
    }
  }, [session, router])

  const [sources, setSources] = useState<RadarSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<RadarSource | null>(null)
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testingSource, setTestingSource] = useState<RadarSource | null>(null)
  const [testResult, setTestResult] = useState<any>(null)

  // 返回上一页
  const handleBack = () => {
    router.push('/dashboard')
  }

  // 加载同业采集源列表
  const loadSources = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getRadarSources({ category: 'industry' })
      setSources(response.data)
    } catch (err: any) {
      setError(err.message || '加载采集源失败')
      toast.error('加载采集源失败')
    } finally {
      setLoading(false)
    }
  }

  // 初始加载
  useEffect(() => {
    loadSources()
  }, [])

  // 打开创建表单
  const handleCreate = () => {
    setEditingSource(null)
    setFormOpen(true)
  }

  // 打开编辑表单
  const handleEdit = (source: RadarSource) => {
    setEditingSource(source)
    setFormOpen(true)
  }

  // 关闭表单
  const handleCloseForm = () => {
    setFormOpen(false)
    setEditingSource(null)
  }

  // 提交表单
  const handleSubmitForm = async (
    data: CreateRadarSourceData | UpdateRadarSourceData,
  ) => {
    try {
      if (editingSource) {
        // 更新
        await updateRadarSource(editingSource.id, data as UpdateRadarSourceData)
        toast.success('采集源更新成功')
      } else {
        // 创建（固定category为industry）
        await createRadarSource({
          ...(data as CreateRadarSourceData),
          category: 'industry',
        })
        toast.success('采集源创建成功')
      }
      await loadSources()
      handleCloseForm()
    } catch (err: any) {
      throw new Error(err.message || '操作失败')
    }
  }

  // 删除采集源
  const handleDelete = async (id: string) => {
    try {
      await deleteRadarSource(id)
      toast.success('采集源删除成功')
      await loadSources()
    } catch (err: any) {
      toast.error(err.message || '删除失败')
    }
  }

  // 切换启用状态
  const handleToggleActive = async (id: string) => {
    try {
      await toggleRadarSourceActive(id)
      toast.success('状态更新成功')
      await loadSources()
    } catch (err: any) {
      toast.error(err.message || '状态更新失败')
    }
  }

  // 测试采集
  const handleTestCrawl = async (source: RadarSource) => {
    setTestingSource(source)
    setTestDialogOpen(true)
    setTestResult(null)

    try {
      const result = await testRadarSourceCrawl(source.id)
      setTestResult(result.data)
    } catch (err: any) {
      toast.error(err.message || '测试采集失败')
      setTestResult({ success: false, error: err.message })
    }
  }

  // 关闭测试对话框
  const handleCloseTestDialog = () => {
    setTestDialogOpen(false)
    setTestingSource(null)
    setTestResult(null)
  }

  // 按类型筛选
  const filteredSources =
    typeFilter === 'all'
      ? sources
      : sources.filter((s) => s.type === typeFilter)

  return (
    <div className="max-w-7xl mx-auto py-16 px-6 bg-[#FEFDFB] min-h-screen">
      {/* 返回按钮 */}
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={handleBack}
          className="rounded-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
      </div>

      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#1E3A5F] font-[var(--font-plus-jakarta)]">
          同业采集源管理
        </h1>
        <p className="text-[#94A3B8] mt-1">
          配置和管理同业采集源（官网、公众号、知乎、会议等）
        </p>
      </div>

      {/* 类型筛选标签 */}
      <Tabs value={typeFilter} onValueChange={setTypeFilter} className="mb-6">
        <TabsList className="bg-[#E2E8F0] rounded-sm p-1">
          <TabsTrigger value="all" className="rounded-sm data-[state=active]:bg-[#1E3A5F] data-[state=active]:text-white">
            全部
          </TabsTrigger>
          <TabsTrigger value="website" className="rounded-sm data-[state=active]:bg-[#1E3A5F] data-[state=active]:text-white">
            官网
          </TabsTrigger>
          <TabsTrigger value="wechat" className="rounded-sm data-[state=active]:bg-[#1E3A5F] data-[state=active]:text-white">
            公众号
          </TabsTrigger>
          <TabsTrigger value="recruitment" className="rounded-sm data-[state=active]:bg-[#1E3A5F] data-[state=active]:text-white">
            招聘
          </TabsTrigger>
          <TabsTrigger value="conference" className="rounded-sm data-[state=active]:bg-[#1E3A5F] data-[state=active]:text-white">
            会议
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 采集源列表 */}
      <PeerCrawlerSourceList
        sources={filteredSources}
        loading={loading}
        error={error}
        onEdit={handleEdit}
        onCreate={handleCreate}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
        onTestCrawl={handleTestCrawl}
      />

      {/* 创建/编辑表单 */}
      <PeerCrawlerSourceForm
        open={formOpen}
        source={editingSource}
        onClose={handleCloseForm}
        onSubmit={handleSubmitForm}
      />

      {/* 测试采集对话框 */}
      <TestCrawlDialog
        open={testDialogOpen}
        source={testingSource}
        result={testResult}
        onClose={handleCloseTestDialog}
      />
    </div>
  )
}
