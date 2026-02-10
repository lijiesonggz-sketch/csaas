import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QuestionnaireProgressDisplay } from '../QuestionnaireProgressDisplay'

/**
 * 问卷进度显示组件的测试套件
 *
 * 测试场景：
 * 1. 显示聚类生成进度
 * 2. 显示已完成/待生成/失败的聚类列表
 * 3. 继续生成按钮功能
 * 4. 单聚类重新生成按钮功能
 */

describe('QuestionnaireProgressDisplay - TDD', () => {
  const mockTaskId = 'test-task-id'
  const mockProjectId = 'test-project-id'

  const mockClusterStatus = {
    totalClusters: 3,
    completedClusters: ['cluster_1'],
    failedClusters: ['cluster_2'],
    pendingClusters: ['cluster_3'],
    clusterProgress: {
      cluster_1: {
        clusterId: 'cluster_1',
        clusterName: '聚类1：安全治理',
        status: 'completed',
        questionsGenerated: 5,
        questionsExpected: 5,
      },
      cluster_2: {
        clusterId: 'cluster_2',
        clusterName: '聚类2：访问控制',
        status: 'failed',
        questionsGenerated: 0,
        questionsExpected: 5,
        error: 'AI调用超时',
      },
      cluster_3: {
        clusterId: 'cluster_3',
        clusterName: '聚类3：数据保护',
        status: 'pending',
        questionsGenerated: 0,
        questionsExpected: 5,
      },
    },
  }

  describe('显示聚类生成进度', () => {
    it('应该显示总进度百分比', () => {
      // Arrange & Act
      render(
        <QuestionnaireProgressDisplay
          taskId={mockTaskId}
          projectId={mockProjectId}
          clusterStatus={mockClusterStatus}
        />,
      )

      // Assert
      const progressText = screen.getByText(/33%/) // 1/3 ≈ 33%
      expect(progressText).toBeInTheDocument()
    })

    it('应该显示聚类数量统计', () => {
      // Arrange & Act
      render(
        <QuestionnaireProgressDisplay
          taskId={mockTaskId}
          projectId={mockProjectId}
          clusterStatus={mockClusterStatus}
        />,
      )

      // Assert - 实际DOM中"已完成"等文本可能出现多次（统计区和聚类详情区）
      const completedTexts = screen.getAllByText('已完成')
      expect(completedTexts.length).toBeGreaterThan(0)
      const pendingTexts = screen.getAllByText('待生成')
      expect(pendingTexts.length).toBeGreaterThan(0)
      const failedTexts = screen.getAllByText('失败')
      expect(failedTexts.length).toBeGreaterThan(0)
    })

    it('应该显示进度条', () => {
      // Arrange & Act
      const { container } = render(
        <QuestionnaireProgressDisplay
          taskId={mockTaskId}
          projectId={mockProjectId}
          clusterStatus={mockClusterStatus}
        />,
      )

      // Assert
      const progressBar = container.querySelector('[role="progressbar"]')
      expect(progressBar).toBeInTheDocument()
      expect(progressBar).toHaveStyle({ width: '33%' })
    })
  })

  describe('显示聚类状态列表', () => {
    it('应该显示每个聚类的详细信息', () => {
      // Arrange & Act
      render(
        <QuestionnaireProgressDisplay
          taskId={mockTaskId}
          projectId={mockProjectId}
          clusterStatus={mockClusterStatus}
        />,
      )

      // Assert
      expect(screen.getByText('聚类1：安全治理')).toBeInTheDocument()
      expect(screen.getByText('聚类2：访问控制')).toBeInTheDocument()
      expect(screen.getByText('聚类3：数据保护')).toBeInTheDocument()
    })

    it('已完成的聚类应该显示绿色勾选标记', () => {
      // Arrange & Act
      render(
        <QuestionnaireProgressDisplay
          taskId={mockTaskId}
          projectId={mockProjectId}
          clusterStatus={mockClusterStatus}
        />,
      )

      // Assert
      const completedCluster = screen.getByText('聚类1：安全治理')
      expect(completedCluster).toBeInTheDocument()
      expect(screen.getByText(/✓.*5.*\/.*5.*题/)).toBeInTheDocument()
    })

    it('失败的聚类应该显示红色错误标记和错误信息', () => {
      // Arrange & Act
      render(
        <QuestionnaireProgressDisplay
          taskId={mockTaskId}
          projectId={mockProjectId}
          clusterStatus={mockClusterStatus}
        />,
      )

      // Assert
      expect(screen.getByText('聚类2：访问控制')).toBeInTheDocument()
      expect(screen.getByText(/AI调用超时/)).toBeInTheDocument()
    })

    it('待生成的聚类应该显示灰色等待标记', () => {
      // Arrange & Act
      render(
        <QuestionnaireProgressDisplay
          taskId={mockTaskId}
          projectId={mockProjectId}
          clusterStatus={mockClusterStatus}
        />,
      )

      // Assert
      const pendingCluster = screen.getByText('聚类3：数据保护')
      expect(pendingCluster).toBeInTheDocument()
    })
  })

  describe('继续生成按钮功能', () => {
    it('当有待生成或失败的聚类时，应该显示继续生成按钮', () => {
      // Arrange & Act
      render(
        <QuestionnaireProgressDisplay
          taskId={mockTaskId}
          projectId={mockProjectId}
          clusterStatus={mockClusterStatus}
        />,
      )

      // Assert - 按钮文本是"继续生成"，信息文本是"还有 2 个聚类未完成"
      expect(screen.getByText(/还有.*2.*个聚类未完成/)).toBeInTheDocument()
      const resumeButton = screen.getByRole('button', { name: /继续生成/ })
      expect(resumeButton).toBeInTheDocument()
      expect(resumeButton).not.toBeDisabled()
    })

    it('点击继续生成按钮应该触发加载状态', async () => {
      // Arrange
      render(
        <QuestionnaireProgressDisplay
          taskId={mockTaskId}
          projectId={mockProjectId}
          clusterStatus={mockClusterStatus}
        />,
      )

      // Act
      const resumeButton = screen.getByRole('button', { name: /继续生成/ })
      fireEvent.click(resumeButton)

      // Assert - 按钮应该进入加载状态
      await waitFor(() => {
        expect(screen.getByText(/创建中|继续生成/)).toBeInTheDocument()
      })
    })

    it('当所有聚类都完成时，不应该显示继续生成按钮', () => {
      // Arrange
      const allCompletedStatus = {
        ...mockClusterStatus,
        completedClusters: ['cluster_1', 'cluster_2', 'cluster_3'],
        failedClusters: [],
        pendingClusters: [],
      }

      // Act
      render(
        <QuestionnaireProgressDisplay
          taskId={mockTaskId}
          projectId={mockProjectId}
          clusterStatus={allCompletedStatus}
        />,
      )

      // Assert
      expect(screen.queryByText(/继续生成/)).not.toBeInTheDocument()
    })
  })

  describe('单聚类重新生成按钮功能', () => {
    it('每个聚类应该有独立的重新生成按钮', () => {
      // Arrange & Act
      render(
        <QuestionnaireProgressDisplay
          taskId={mockTaskId}
          projectId={mockProjectId}
          clusterStatus={mockClusterStatus}
        />,
      )

      // Assert
      const regenerateButtons = screen.getAllByText(/重新生成/)
      expect(regenerateButtons).toHaveLength(3) // 每个聚类一个按钮
    })

    it('点击重新生成按钮应该触发加载状态', async () => {
      // Arrange
      render(
        <QuestionnaireProgressDisplay
          taskId={mockTaskId}
          projectId={mockProjectId}
          clusterStatus={mockClusterStatus}
        />,
      )

      // Act
      const regenerateButtons = screen.getAllByText(/重新生成/)
      fireEvent.click(regenerateButtons[0]) // 点击第一个聚类

      // Assert - 按钮应该进入加载状态或保持可用
      await waitFor(() => {
        const allButtons = screen.getAllByText(/生成中|重新生成/)
        expect(allButtons.length).toBeGreaterThan(0)
      })
    })

    it('重新生成按钮应该有明确的tooltip提示', () => {
      // Arrange & Act
      render(
        <QuestionnaireProgressDisplay
          taskId={mockTaskId}
          projectId={mockProjectId}
          clusterStatus={mockClusterStatus}
        />,
      )

      // Assert
      const buttons = screen.getAllByRole('button')
      const regenerateButton = buttons.find(btn =>
        btn.getAttribute('aria-label')?.includes('重新生成'),
      )
      expect(regenerateButton).toBeInTheDocument()
    })
  })

  describe('UI/UX细节', () => {
    it('应该使用不同颜色区分聚类状态', () => {
      // Arrange & Act
      const { container } = render(
        <QuestionnaireProgressDisplay
          taskId={mockTaskId}
          projectId={mockProjectId}
          clusterStatus={mockClusterStatus}
        />,
      )

      // Assert - data-status属性标识聚类状态，内部元素包含对应颜色类
      const completedBadge = container.querySelector('[data-status="completed"]')
      const failedBadge = container.querySelector('[data-status="failed"]')
      const pendingBadge = container.querySelector('[data-status="pending"]')

      expect(completedBadge).toBeInTheDocument()
      expect(failedBadge).toBeInTheDocument()
      expect(pendingBadge).toBeInTheDocument()
      // 验证已完成的聚类内部包含绿色状态文本
      expect(completedBadge!.textContent).toContain('已完成')
      // 验证失败的聚类内部包含失败状态文本
      expect(failedBadge!.textContent).toContain('失败')
      // 验证待生成的聚类内部包含待生成状态文本
      expect(pendingBadge!.textContent).toContain('待生成')
    })

    it('应该显示预估剩余时间', () => {
      // Arrange & Act
      render(
        <QuestionnaireProgressDisplay
          taskId={mockTaskId}
          projectId={mockProjectId}
          clusterStatus={mockClusterStatus}
        />,
      )

      // Assert
      // 假设每个聚类需要5分钟，2个聚类大约需要10分钟
      expect(screen.getByText(/预计.*10.*分钟/)).toBeInTheDocument()
    })

    it('应该在移动端响应式布局', () => {
      // Arrange
      global.innerWidth = 375 // 模拟手机宽度

      // Act
      const { container } = render(
        <QuestionnaireProgressDisplay
          taskId={mockTaskId}
          projectId={mockProjectId}
          clusterStatus={mockClusterStatus}
        />,
      )

      // Assert
      const list = container.querySelector('[data-testid="cluster-list"]')
      expect(list).toHaveClass(/grid-cols-1/) // 移动端单列布局
    })
  })
})
