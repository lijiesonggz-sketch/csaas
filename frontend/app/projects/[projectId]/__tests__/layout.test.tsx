import { render, screen } from '@testing-library/react'
import { useParams, usePathname, useRouter } from 'next/navigation'

import ProjectWorkbenchLayout from '../layout'
import { apiFetch } from '@/lib/utils/api'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('@/lib/utils/api', () => ({
  apiFetch: jest.fn(),
}))

describe('ProjectWorkbenchLayout', () => {
  const mockApiFetch = apiFetch as jest.Mock
  const mockUseParams = useParams as jest.Mock
  const mockUsePathname = usePathname as jest.Mock
  const mockUseRouter = useRouter as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseParams.mockReturnValue({ projectId: 'project-1' })
    mockUsePathname.mockReturnValue('/projects/project-1/standard-interpretation')
    mockUseRouter.mockReturnValue({ push: jest.fn() })
    mockApiFetch.mockResolvedValue({
      id: 'project-1',
      name: '测试项目',
      clientName: '测试客户',
      standardName: 'AIMM',
      progress: 83,
    })
  })

  it('keeps project workbench containers full width instead of shrinking to active tab content', async () => {
    const { container } = render(
      <ProjectWorkbenchLayout>
        <section>标准解读内容</section>
      </ProjectWorkbenchLayout>
    )

    expect(await screen.findByText('标准解读内容')).toBeInTheDocument()

    const workbenchContainers = Array.from(container.querySelectorAll('div')).filter((element) =>
      element.className.includes('max-w-[1400px]')
    )

    expect(workbenchContainers).toHaveLength(3)
    workbenchContainers.forEach((element) => {
      expect(element).toHaveClass('w-full')
    })
  })
})
