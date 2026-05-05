'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { RadarSourceList } from '@/components/admin/RadarSourceList'
import { RadarSourceForm } from '@/components/admin/RadarSourceForm'
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

/**
 * 雷达信息源配置管理页面
 *
 * Story 3.1: 配置行业雷达信息源
 *
 * 功能：
 * - 显示所有信息源配置
 * - 创建、编辑、删除信息源
 * - 启用/禁用信息源
 * - 测试爬虫功能
 */
export default function RadarSourcesPage() {
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
  const [formOpen, setFormOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<RadarSource | null>(null)

  // 加载信息源列表
  const loadSources = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getRadarSources()
      setSources(response.data)
    } catch (err: any) {
      setError(err.message || '加载信息源失败')
      toast.error('加载信息源失败')
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
  const handleSubmitForm = async (data: CreateRadarSourceData | UpdateRadarSourceData) => {
    try {
      if (editingSource) {
        // 更新
        await updateRadarSource(editingSource.id, data as UpdateRadarSourceData)
        toast.success('信息源更新成功')
      } else {
        // 创建
        await createRadarSource(data as CreateRadarSourceData)
        toast.success('信息源创建成功')
      }
      await loadSources()
      handleCloseForm()
    } catch (err: any) {
      throw new Error(err.message || '操作失败')
    }
  }

  // 删除信息源
  const handleDelete = async (id: string) => {
    try {
      await deleteRadarSource(id)
      toast.success('信息源删除成功')
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

  // 测试爬虫
  const handleTestCrawl = async (id: string) => {
    try {
      await testRadarSourceCrawl(id)
      toast.success('测试爬虫任务已加入队列', {
        description: '请稍后查看结果',
      })
    } catch (err: any) {
      toast.error(err.message || '测试爬虫失败')
    }
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-6 bg-[#FEFDFB] min-h-screen">
      {/* 信息源列表 */}
      <RadarSourceList
        sources={sources}
        loading={loading}
        error={error}
        onEdit={handleEdit}
        onCreate={handleCreate}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
        onTestCrawl={handleTestCrawl}
      />

      {/* 创建/编辑表单 */}
      <RadarSourceForm
        open={formOpen}
        source={editingSource}
        onClose={handleCloseForm}
        onSubmit={handleSubmitForm}
      />
    </div>
  )
}
