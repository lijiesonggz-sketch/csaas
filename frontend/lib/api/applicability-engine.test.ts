import { resolveControls } from './applicability-engine'
import { apiFetch } from '../utils/api'

jest.mock('../utils/api', () => ({
  apiFetch: jest.fn(),
}))

describe('applicability-engine api', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should call resolve-controls with POST payload', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue({
      organizationId: 'org-1',
      controls: [],
      matchedPacks: [],
      matchedRules: [],
      influencingProfileFields: [],
      summary: {
        totalControls: 0,
        mandatoryCount: 0,
        matchedPacks: 0,
        matchedRules: 0,
        excludedControls: 0,
      },
      debugLog: [],
    })

    await resolveControls({
      organizationId: 'org-1',
      scene: 'quick-gap-analysis',
    })

    expect(apiFetch).toHaveBeenCalledWith('/applicability-engine/resolve-controls', {
      method: 'POST',
      body: JSON.stringify({
        organizationId: 'org-1',
        scene: 'quick-gap-analysis',
      }),
    })
  })
})
