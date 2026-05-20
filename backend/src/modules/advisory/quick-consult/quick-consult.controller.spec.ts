import { QuickConsultController } from './quick-consult.controller'

describe('QuickConsultController', () => {
  it('passes authenticated user and tenant context while ignoring body tenantId', async () => {
    const service = {
      startQuickConsult: jest.fn().mockResolvedValue({
        contextId: 'quick-consult-1',
        status: 'analysis_started',
      }),
    }
    const controller = new QuickConsultController(service as never)
    const user = {
      id: '770e8400-e29b-41d4-a716-446655440000',
      organizationId: '880e8400-e29b-41d4-a716-446655440000',
      role: 'consultant',
    }

    await expect(
      controller.startQuickConsult(user, '660e8400-e29b-41d4-a716-446655440000', {
        tenantId: '111e8400-e29b-41d4-a716-446655440000',
        problem: '请分析客户数据平台 ISO 27001 差距整改优先级。',
      }),
    ).resolves.toEqual({
      data: {
        contextId: 'quick-consult-1',
        status: 'analysis_started',
      },
    })

    expect(service.startQuickConsult).toHaveBeenCalledWith(
      expect.objectContaining({
        user,
        tenantId: '660e8400-e29b-41d4-a716-446655440000',
        problem: '请分析客户数据平台 ISO 27001 差距整改优先级。',
      }),
    )
    expect(service.startQuickConsult).not.toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '111e8400-e29b-41d4-a716-446655440000',
      }),
    )
  })

  it('forwards only whitelisted clarification context fields', async () => {
    const service = {
      startQuickConsult: jest.fn().mockResolvedValue({
        contextId: '550e8400-e29b-41d4-a716-446655440001',
        status: 'analysis_started',
      }),
    }
    const controller = new QuickConsultController(service as never)
    const user = {
      id: '770e8400-e29b-41d4-a716-446655440000',
      organizationId: '880e8400-e29b-41d4-a716-446655440000',
      role: 'consultant',
    }

    await controller.startQuickConsult(user, '660e8400-e29b-41d4-a716-446655440000', {
      problem: 'Help me with AI.',
      contextId: '550e8400-e29b-41d4-a716-446655440001',
      originalProblem: 'Help me with AI.',
      clarificationAnswers: [
        {
          question: 'What business decision are you trying to make?',
          answer: 'Prioritize enterprise compliance onboarding.',
        },
      ],
      tenantId: '111e8400-e29b-41d4-a716-446655440000',
    })

    expect(service.startQuickConsult).toHaveBeenCalledWith(
      expect.objectContaining({
        user,
        tenantId: '660e8400-e29b-41d4-a716-446655440000',
        problem: 'Help me with AI.',
        contextId: '550e8400-e29b-41d4-a716-446655440001',
        originalProblem: 'Help me with AI.',
        clarificationAnswers: [
          {
            question: 'What business decision are you trying to make?',
            answer: 'Prioritize enterprise compliance onboarding.',
          },
        ],
      }),
    )
  })

  it('passes manual browse requests through trusted tenant and user context only', async () => {
    const quickConsultService = {
      startQuickConsult: jest.fn(),
    }
    const methodBrowseService = {
      listManualBrowseCatalog: jest.fn().mockResolvedValue({
        workflows: [],
        methodChoices: [],
        methodCatalogStatus: 'available',
      }),
    }
    const controller = new QuickConsultController(
      quickConsultService as never,
      methodBrowseService as never,
    )
    const user = {
      id: '770e8400-e29b-41d4-a716-446655440000',
      organizationId: '880e8400-e29b-41d4-a716-446655440000',
      role: 'consultant',
    }

    await expect(
      controller.getManualBrowseCatalog(user, '660e8400-e29b-41d4-a716-446655440000', {
        tenantId: '111e8400-e29b-41d4-a716-446655440000',
        actorId: 'attacker-actor',
        quickConsultContextId: ' quick-consult-context-34 ',
      }),
    ).resolves.toEqual({
      data: {
        workflows: [],
        methodChoices: [],
        methodCatalogStatus: 'available',
      },
    })

    expect(methodBrowseService.listManualBrowseCatalog).toHaveBeenCalledWith(
      expect.objectContaining({
        user,
        tenantId: '660e8400-e29b-41d4-a716-446655440000',
        quickConsultContextId: 'quick-consult-context-34',
      }),
    )
    expect(methodBrowseService.listManualBrowseCatalog).not.toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '111e8400-e29b-41d4-a716-446655440000',
      }),
    )
  })

  it('passes recommendation feedback through trusted tenant and user context with whitelisted fields only', async () => {
    const quickConsultService = {
      startQuickConsult: jest.fn(),
    }
    const methodBrowseService = {
      listManualBrowseCatalog: jest.fn(),
    }
    const feedbackService = {
      submitRecommendationFeedback: jest.fn().mockResolvedValue({
        id: 'feedback-35',
        rating: 5,
      }),
    }
    const controller = new QuickConsultController(
      quickConsultService as never,
      methodBrowseService as never,
      feedbackService as never,
    )
    const user = {
      id: '770e8400-e29b-41d4-a716-446655440000',
      organizationId: '880e8400-e29b-41d4-a716-446655440000',
      role: 'consultant',
    }

    await expect(
      controller.submitRecommendationFeedback(user, '660e8400-e29b-41d4-a716-446655440000', {
        tenantId: 'attacker-tenant',
        actorId: 'attacker-actor',
        quickConsultContextId: ' quick-consult-context-35 ',
        recommendationIds: [' quick-consult-context-35:product-brief:1 ', '', 42],
        rating: 5,
        feedbackText: '  推荐方向有帮助。  ',
        rawProblem: 'drop me',
      } as never),
    ).resolves.toEqual({
      data: {
        id: 'feedback-35',
        rating: 5,
      },
    })

    expect(feedbackService.submitRecommendationFeedback).toHaveBeenCalledWith({
      user,
      tenantId: '660e8400-e29b-41d4-a716-446655440000',
      quickConsultContextId: 'quick-consult-context-35',
      recommendationIds: ['quick-consult-context-35:product-brief:1'],
      rating: 5,
      feedbackText: '推荐方向有帮助。',
    })
  })
})
