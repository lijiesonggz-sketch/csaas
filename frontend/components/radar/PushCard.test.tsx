import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import { PushCard } from './PushCard'
import type { RadarPush } from '@/lib/api/radar'

describe('PushCard', () => {
  const buildPush = (overrides: Partial<RadarPush> = {}): RadarPush => ({
    pushId: 'push-1',
    radarType: 'compliance',
    title: '监管处罚动态',
    summary: '测试摘要内容',
    relevanceScore: 0.95,
    priorityLevel: 1,
    weaknessCategories: ['数据安全'],
    url: 'https://example.com',
    publishDate: '2026-03-30T00:00:00.000Z',
    source: '测试来源',
    tags: [],
    targetAudience: '合规负责人',
    isRead: false,
    controlId: null,
    matchedControls: [],
    sourceModule: 'radar',
    sourceRecordId: 'push-1',
    sourceRoute: '/radar/compliance',
    ...overrides,
  })

  it('renders the current compliance card content', () => {
    render(<PushCard push={buildPush()} variant="compliance" onViewDetail={jest.fn()} />)

    expect(screen.getByText('监管处罚动态')).toBeInTheDocument()
    expect(screen.getByText('测试摘要内容')).toBeInTheDocument()
    expect(screen.getByText('来源: 测试来源')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看应对剧本' })).toBeInTheDocument()
  })

  it('fires the primary CTA callback for compliance cards', () => {
    const onViewDetail = jest.fn()

    render(<PushCard push={buildPush()} variant="compliance" onViewDetail={onViewDetail} />)

    fireEvent.click(screen.getByRole('button', { name: '查看应对剧本' }))

    expect(onViewDetail).toHaveBeenCalledWith('push-1')
  })

  it('shows the control detail entry only when matchedControls exist', () => {
    const { rerender } = render(
      <PushCard push={buildPush()} variant="compliance" onViewDetail={jest.fn()} onViewControlDetail={jest.fn()} />,
    )

    expect(screen.queryByRole('button', { name: '查看控制点详情' })).not.toBeInTheDocument()

    rerender(
      <PushCard
        push={buildPush({
          matchedControls: [
            {
              controlId: 'ctrl-001',
              controlName: '测试控制点',
              packSource: '测试包',
              priority: 'high',
            },
          ],
        })}
        variant="compliance"
        onViewDetail={jest.fn()}
        onViewControlDetail={jest.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '查看控制点详情' })).toBeInTheDocument()
  })

  it('uses the first matched control when opening the shared drawer', () => {
    const onViewControlDetail = jest.fn()

    render(
      <PushCard
        push={buildPush({
          matchedControls: [
            {
              controlId: 'ctrl-001',
              controlName: '控制点 1',
              packSource: '包 1',
              priority: 'high',
            },
            {
              controlId: 'ctrl-002',
              controlName: '控制点 2',
              packSource: '包 2',
              priority: 'medium',
            },
          ],
        })}
        variant="compliance"
        onViewDetail={jest.fn()}
        onViewControlDetail={onViewControlDetail}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /查看控制点详情/ }))

    expect(onViewControlDetail).toHaveBeenCalledWith('ctrl-001')
    expect(screen.getByText('(2)')).toBeInTheDocument()
  })

  it('renders ROI fallback for tech cards without ROI analysis', () => {
    render(
      <PushCard
        push={buildPush({
          radarType: 'tech',
          controlId: null,
          matchedControls: [],
        })}
        variant="tech"
        onViewDetail={jest.fn()}
      />,
    )

    expect(screen.getByText('ROI分析中...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看详情' })).toBeInTheDocument()
  })

  it('renders industry-specific fields without showing the tech ROI block', () => {
    render(
      <PushCard
        push={buildPush({
          radarType: 'industry',
          peerName: '某股份制银行',
          practiceDescription: '行业实践描述',
          estimatedCost: '300-500万',
          implementationPeriod: '6-12个月',
          technicalEffect: '处理效率提升',
        })}
        variant="industry"
        onViewDetail={jest.fn()}
      />,
    )

    expect(screen.getByText('某股份制银行')).toBeInTheDocument()
    expect(screen.getByText('投入成本')).toBeInTheDocument()
    expect(screen.queryByText('ROI分析')).not.toBeInTheDocument()
  })
})
