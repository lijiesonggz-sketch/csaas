import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import PushDetailModal from './PushDetailModal'
import * as radarApi from '@/lib/api/radar'
import * as feedbackApi from '@/lib/api/feedback'

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: {
      accessToken: 'token-123',
      user: {
        id: 'user-123',
        organizationId: 'org-123',
      },
    },
  })),
}))

jest.mock('@/lib/api/radar', () => ({
  ...jest.requireActual('@/lib/api/radar'),
  getRadarPush: jest.fn(),
}))

jest.mock('@/lib/api/feedback', () => ({
  getUserFeedback: jest.fn(),
  submitPushFeedback: jest.fn(),
}))

jest.mock('@/components/compliance/ControlDetailDrawer', () => ({
  ControlDetailDrawer: ({ open, controlId }: { open: boolean; controlId: string }) =>
    open ? <div data-testid="mock-control-detail-drawer">{controlId}</div> : null,
}))

const mockGetRadarPush = radarApi.getRadarPush as jest.MockedFunction<typeof radarApi.getRadarPush>
const mockGetUserFeedback = feedbackApi.getUserFeedback as jest.MockedFunction<
  typeof feedbackApi.getUserFeedback
>

describe('PushDetailModal - Control Context Integration', () => {
  const basePush = {
    id: 'push-123',
    radarType: 'compliance' as const,
    title: '合规推送',
    summary: '摘要',
    relevanceScore: 0.95,
    relevanceLevel: 'high' as const,
    sentAt: '2026-03-31T00:00:00.000Z',
    readAt: null,
    isRead: false,
    controlId: null,
    matchedControls: [],
    sourceModule: 'radar' as const,
    sourceRecordId: 'push-123',
    sourceRoute: '/radar/compliance',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUserFeedback.mockResolvedValue(null)
  })

  it('shows control detail entry when detail payload returns matched controls', async () => {
    mockGetRadarPush.mockResolvedValue({
      pushId: 'push-123',
      radarType: 'compliance',
      title: '合规推送',
      summary: '摘要',
      relevanceScore: 0.95,
      priorityLevel: 1,
      weaknessCategories: [],
      url: '',
      publishDate: '2026-03-31T00:00:00.000Z',
      source: '测试来源',
      tags: [],
      targetAudience: '合规负责人',
      isRead: false,
      controlId: 'control-123',
      matchedControls: [
        {
          controlId: 'control-123',
          controlName: '测试控制点',
          packSource: '命中控制语义：测试',
          priority: 'HIGH',
        },
      ],
      sourceModule: 'radar',
      sourceRecordId: 'push-123',
      sourceRoute: '/radar/compliance',
    })

    render(<PushDetailModal open push={basePush} onClose={jest.fn()} />)

    await waitFor(() => {
      expect(mockGetRadarPush).toHaveBeenCalledWith('push-123')
    })

    const controlButton = await screen.findByRole('button', {
      name: /查看控制点详情: 测试控制点/i,
    })
    fireEvent.click(controlButton)

    expect(screen.getByTestId('mock-control-detail-drawer')).toHaveTextContent('control-123')
  })

  it('does not show control detail entry when detail payload has no matched controls', async () => {
    mockGetRadarPush.mockResolvedValue({
      pushId: 'push-123',
      radarType: 'compliance',
      title: '合规推送',
      summary: '摘要',
      relevanceScore: 0.95,
      priorityLevel: 1,
      weaknessCategories: [],
      url: '',
      publishDate: '2026-03-31T00:00:00.000Z',
      source: '测试来源',
      tags: [],
      targetAudience: '合规负责人',
      isRead: false,
      controlId: null,
      matchedControls: [],
      sourceModule: 'radar',
      sourceRecordId: 'push-123',
      sourceRoute: '/radar/compliance',
    })

    render(<PushDetailModal open push={basePush} onClose={jest.fn()} />)

    await waitFor(() => {
      expect(mockGetRadarPush).toHaveBeenCalledWith('push-123')
    })

    expect(screen.queryByRole('button', { name: /查看控制点详情/i })).not.toBeInTheDocument()
  })
})
