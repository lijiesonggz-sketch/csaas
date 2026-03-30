import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import ProjectsPage from '../page'
import { useRouter } from 'next/navigation'

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

jest.mock('@/components/projects/ProjectListShadcn', () => ({
  __esModule: true,
  default: ({ onProjectClick }: { onProjectClick?: (project: { id: string; name: string }) => void }) => (
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

  it('renders the current project list container', () => {
    render(<ProjectsPage />)
    expect(screen.getByTestId('project-list')).toBeInTheDocument()
  })

  it('navigates to project detail when a project is clicked', () => {
    render(<ProjectsPage />)

    fireEvent.click(screen.getByTestId('project-card'))

    expect(mockPush).toHaveBeenCalledWith('/projects/project-1')
  })
})
