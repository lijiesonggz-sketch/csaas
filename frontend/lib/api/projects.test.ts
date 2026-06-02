import { ProjectsAPI } from './projects'
import { getAuthHeadersAsync } from '@/lib/utils/jwt'

jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn(),
}))

const mockGetAuthHeadersAsync = getAuthHeadersAsync as jest.MockedFunction<
  typeof getAuthHeadersAsync
>

describe('ProjectsAPI.rerunTask', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    mockGetAuthHeadersAsync.mockResolvedValue({
      'Content-Type': 'application/json',
      Authorization: 'Bearer token',
    })
    global.fetch = jest.fn()
  })

  it('includes the route project id in the rerun request body', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'new-task-1' } }),
    })

    await expect(ProjectsAPI.rerunTask('project-1', { type: 'matrix' })).resolves.toEqual({
      id: 'new-task-1',
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/projects/project-1/rerun',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ projectId: 'project-1', type: 'matrix' }),
      })
    )
  })

  it('formats structured validation errors instead of surfacing object strings', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({
        statusCode: 400,
        message: [
          {
            property: 'projectId',
            constraints: {
              isNotEmpty: 'projectId should not be empty',
              isString: 'projectId must be a string',
            },
          },
        ],
      }),
    })

    await expect(ProjectsAPI.rerunTask('project-1', { type: 'matrix' })).rejects.toThrow(
      'projectId should not be empty；projectId must be a string'
    )
  })
})
