/**
 * RadarSettingsPage单元测试 (Story 5.1 - Task 4.3)
 *
 * 测试覆盖：
 * - 加载并显示关注领域列表
 * - 显示空状态
 * - 打开添加弹窗
 * - 成功添加关注领域
 * - 显示删除确认对话框
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import RadarSettingsPage from './page'
import * as radarApi from '@/lib/api/radar'

// Mock API模块
jest.mock('@/lib/api/radar')
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

// Mock Ant Design的message和Modal
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  message: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
  Modal: {
    confirm: jest.fn(),
  },
}))

const mockGetWatchedTopics = radarApi.getWatchedTopics as jest.MockedFunction<typeof radarApi.getWatchedTopics>
const mockCreateWatchedTopic = radarApi.createWatchedTopic as jest.MockedFunction<typeof radarApi.createWatchedTopic>
const mockDeleteWatchedTopic = radarApi.deleteWatchedTopic as jest.MockedFunction<typeof radarApi.deleteWatchedTopic>

describe('RadarSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'test-org-id'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    })
  })

  it('应该加载并显示关注领域列表', async () => {
    const mockTopics = [
      {
        id: '1',
        organizationId: 'test-org-id',
        topicName: '云原生',
        topicType: 'tech' as const,
        createdAt: '2026-01-31T00:00:00Z',
        relatedPushCount: 5,
      },
      {
        id: '2',
        organizationId: 'test-org-id',
        topicName: 'AI应用',
        topicType: 'tech' as const,
        createdAt: '2026-01-30T00:00:00Z',
        relatedPushCount: 3,
      },
    ]

    mockGetWatchedTopics.mockResolvedValue(mockTopics)

    render(<RadarSettingsPage />)

    // 等待加载完成
    await waitFor(() => {
      expect(screen.getByText('云原生')).toBeInTheDocument()
      expect(screen.getByText('AI应用')).toBeInTheDocument()
    })

    // 验证API调用
    expect(mockGetWatchedTopics).toHaveBeenCalledWith('test-org-id')

    // 验证推送数量显示
    expect(screen.getByText('已推送 5 条相关内容')).toBeInTheDocument()
    expect(screen.getByText('已推送 3 条相关内容')).toBeInTheDocument()
  })

  it('应该显示空状态', async () => {
    mockGetWatchedTopics.mockResolvedValue([])

    render(<RadarSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('暂无关注领域,点击上方按钮添加')).toBeInTheDocument()
    })
  })

  it('应该打开添加弹窗', async () => {
    mockGetWatchedTopics.mockResolvedValue([])

    render(<RadarSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('暂无关注领域,点击上方按钮添加')).toBeInTheDocument()
    })

    // 点击添加按钮（使用role查找）
    const addButton = screen.getByRole('button', { name: /添加关注领域/i })
    fireEvent.click(addButton)

    // 验证弹窗打开（查找弹窗中的标题）
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '添加关注领域' })).toBeInTheDocument()
      expect(screen.getByText('容器化、微服务、Kubernetes等')).toBeInTheDocument()
    })
  })

  it('应该成功添加关注领域（预设选项）', async () => {
    mockGetWatchedTopics.mockResolvedValue([])
    mockCreateWatchedTopic.mockResolvedValue({
      id: '1',
      organizationId: 'test-org-id',
      topicName: '云原生',
      topicType: 'tech',
      createdAt: '2026-01-31T00:00:00Z',
    })

    const { message } = require('antd')

    render(<RadarSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('暂无关注领域,点击上方按钮添加')).toBeInTheDocument()
    })

    // 打开弹窗
    const addButton = screen.getByRole('button', { name: /添加关注领域/i })
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByText('容器化、微服务、Kubernetes等')).toBeInTheDocument()
    })

    // 选择预设选项
    const radioButtons = screen.getAllByRole('radio')
    fireEvent.click(radioButtons[0]) // 选择"云原生"

    // 点击确认（使用role查找弹窗中的确认按钮）
    const confirmButton = screen.getByRole('button', { name: '确认' })
    fireEvent.click(confirmButton)

    // 验证API调用
    await waitFor(() => {
      expect(mockCreateWatchedTopic).toHaveBeenCalledWith('test-org-id', {
        topicName: '云原生',
        topicType: 'tech',
      })
      expect(message.success).toHaveBeenCalledWith('已添加关注领域!系统将推送相关技术趋势')
    })
  })

  it('应该成功添加关注领域（自定义输入）', async () => {
    mockGetWatchedTopics.mockResolvedValue([])
    mockCreateWatchedTopic.mockResolvedValue({
      id: '1',
      organizationId: 'test-org-id',
      topicName: '量子计算',
      topicType: 'tech',
      createdAt: '2026-01-31T00:00:00Z',
    })

    const { message } = require('antd')

    render(<RadarSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('暂无关注领域,点击上方按钮添加')).toBeInTheDocument()
    })

    // 打开弹窗
    const addButton = screen.getByRole('button', { name: /添加关注领域/i })
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByLabelText('自定义领域名称')).toBeInTheDocument()
    })

    // 输入自定义领域
    const customInput = screen.getByLabelText('自定义领域名称')
    fireEvent.change(customInput, { target: { value: '量子计算' } })

    // 点击确认
    const confirmButton = screen.getByRole('button', { name: '确认' })
    fireEvent.click(confirmButton)

    // 验证API调用
    await waitFor(() => {
      expect(mockCreateWatchedTopic).toHaveBeenCalledWith('test-org-id', {
        topicName: '量子计算',
        topicType: 'tech',
      })
      expect(message.success).toHaveBeenCalledWith('已添加关注领域!系统将推送相关技术趋势')
    })
  })

  it('应该显示删除确认对话框', async () => {
    const mockTopics = [
      {
        id: '1',
        organizationId: 'test-org-id',
        topicName: '云原生',
        topicType: 'tech' as const,
        createdAt: '2026-01-31T00:00:00Z',
      },
    ]

    mockGetWatchedTopics.mockResolvedValue(mockTopics)

    const { Modal } = require('antd')

    render(<RadarSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('云原生')).toBeInTheDocument()
    })

    // 点击删除按钮
    const deleteButtons = screen.getAllByTestId('DeleteIcon')
    fireEvent.click(deleteButtons[0].parentElement!)

    // 验证Modal.confirm被调用
    await waitFor(() => {
      expect(Modal.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '确定取消关注该领域吗?',
          content: '取消后,系统将不再推送"云原生"相关内容',
        })
      )
    })
  })

  it('应该处理加载错误', async () => {
    mockGetWatchedTopics.mockRejectedValue(new Error('网络错误'))

    const { message } = require('antd')

    render(<RadarSettingsPage />)

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('网络错误')
    })
  })

  it('应该处理添加错误', async () => {
    mockGetWatchedTopics.mockResolvedValue([])
    mockCreateWatchedTopic.mockRejectedValue(new Error('该领域已在关注列表中'))

    const { message } = require('antd')

    render(<RadarSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('暂无关注领域,点击上方按钮添加')).toBeInTheDocument()
    })

    // 打开弹窗并添加
    const addButton = screen.getByRole('button', { name: /添加关注领域/i })
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByLabelText('自定义领域名称')).toBeInTheDocument()
    })

    const customInput = screen.getByLabelText('自定义领域名称')
    fireEvent.change(customInput, { target: { value: '云原生' } })

    const confirmButton = screen.getByRole('button', { name: '确认' })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('该领域已在关注列表中')
    })
  })
})
