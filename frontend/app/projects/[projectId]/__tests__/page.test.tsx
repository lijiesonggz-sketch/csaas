import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import ProjectWorkbenchPage from '../page'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/utils/api'
import { AITasksAPI } from '@/lib/api/ai-tasks'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('@/lib/utils/api', () => ({
  apiFetch: jest.fn(),
}))

jest.mock('@/lib/api/ai-tasks', () => ({
  AITasksAPI: {
    getTasksByProject: jest.fn(),
  },
}))

describe('ProjectWorkbenchPage', () => {
  const mockPush = jest.fn()
  const mockUseParams = useParams as jest.Mock
  const mockUseRouter = useRouter as jest.Mock
  const mockApiFetch = apiFetch as jest.Mock
  const mockGetTasksByProject = AITasksAPI.getTasksByProject as jest.Mock

  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    description: 'Test Description',
    status: 'ACTIVE',
    progress: 50,
    clientName: 'Test Client',
    standardName: 'ISO 27001',
    organizationId: 'org-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    metadata: {
      uploadedDocuments: [{ id: 'doc-1', name: 'Test Doc' }],
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseParams.mockReturnValue({ projectId: 'project-1' })
    mockUseRouter.mockReturnValue({ push: mockPush })
    mockApiFetch.mockResolvedValue(mockProject)
    mockGetTasksByProject.mockResolvedValue([])
  })

  it('shows the current loading state before data is ready', () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {}))
    mockGetTasksByProject.mockImplementation(() => new Promise(() => {}))

    render(<ProjectWorkbenchPage />)

    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('renders the current header, quick entry actions, and project details', async () => {
    render(<ProjectWorkbenchPage />)

    expect(await screen.findByText('Test Project')).toBeInTheDocument()
    expect(screen.getByText('KG 准备入口')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /机构画像/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /适用控制点/ })).toBeInTheDocument()
    expect(screen.getByText('项目详情')).toBeInTheDocument()
    expect(screen.getByText('进行中')).toBeInTheDocument()
  })

  it('renders the current module cards including radar service', async () => {
    render(<ProjectWorkbenchPage />)

    expect(await screen.findByText('上传文档')).toBeInTheDocument()
    expect(screen.getByText('综述生成')).toBeInTheDocument()
    expect(screen.getByText('审核工作台')).toBeInTheDocument()
    expect(screen.getByText('Radar Service')).toBeInTheDocument()
  })

  it('navigates to quick entry routes from the KG prep section', async () => {
    render(<ProjectWorkbenchPage />)

    await screen.findByRole('button', { name: /机构画像/ })

    fireEvent.click(screen.getByRole('button', { name: /机构画像/ }))
    fireEvent.click(screen.getByRole('button', { name: /适用控制点/ }))

    expect(mockPush).toHaveBeenCalledWith('/organizations/org-1/profile')
    expect(mockPush).toHaveBeenCalledWith('/organizations/org-1/applicable-controls')
  })

  it('navigates to module routes from the workbench cards', async () => {
    render(<ProjectWorkbenchPage />)

    const uploadCard = await screen.findByRole('link', { name: /上传文档/ })
    const summaryCard = screen.getByRole('link', { name: /综述生成/ })
    const radarCard = screen.getByRole('link', { name: /Radar Service/ })

    fireEvent.click(uploadCard)
    fireEvent.click(summaryCard)
    fireEvent.click(radarCard)

    expect(mockPush).toHaveBeenCalledWith('/projects/project-1/upload')
    expect(mockPush).toHaveBeenCalledWith('/projects/project-1/summary')
    expect(mockPush).toHaveBeenCalledWith('/radar?orgId=org-1')
  })

  it('navigates back to the projects list from the current header action', async () => {
    render(<ProjectWorkbenchPage />)

    fireEvent.click(await screen.findByRole('button', { name: /返回项目列表/ }))
    expect(mockPush).toHaveBeenCalledWith('/projects')
  })

  it('switches project status labels for different project states', async () => {
    mockApiFetch.mockResolvedValueOnce({ ...mockProject, status: 'COMPLETED' })

    render(<ProjectWorkbenchPage />)

    const completedBadges = await screen.findAllByText('已完成')
    expect(completedBadges.length).toBeGreaterThan(0)
  })

  it('updates module CTA copy when summary is already completed', async () => {
    mockGetTasksByProject.mockResolvedValueOnce([
      { type: 'summary', status: 'completed', createdAt: '2024-01-01T00:00:00Z' },
    ])

    render(<ProjectWorkbenchPage />)

    await waitFor(() => {
      expect(screen.getAllByText('查看').length).toBeGreaterThan(0)
    })
  })
})
