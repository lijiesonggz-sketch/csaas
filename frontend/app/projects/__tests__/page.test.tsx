import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProjectsPage from '../page'
import { useRouter } from 'next/navigation'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock ProjectList component
jest.mock('@/components/projects/ProjectList', () => ({
  __esModule: true,
  default: ({ onProjectClick }: { onProjectClick?: (project: any) => void }) => (
    <div data-testid="project-list">
      <button
        data-testid="project-card"
        onClick={() => onProjectClick?.({ id: 'project-1', name: 'Test Project' })}
      >
        Test Project
      </button>
    </div>
  ),
}))

describe('ProjectsPage', () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })
  })

  it('should render ProjectList component', () => {
    render(<ProjectsPage />)
    expect(screen.getByTestId('project-list')).toBeInTheDocument()
  })

  it('should navigate to project detail when project is clicked', () => {
    render(<ProjectsPage />)

    fireEvent.click(screen.getByTestId('project-card'))

    expect(mockPush).toHaveBeenCalledWith('/projects/project-1')
  })

  it('should handle project click with correct project data', () => {
    render(<ProjectsPage />)

    fireEvent.click(screen.getByTestId('project-card'))

    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith('/projects/project-1')
  })
})
