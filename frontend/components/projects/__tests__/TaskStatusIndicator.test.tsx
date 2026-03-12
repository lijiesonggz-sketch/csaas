import { render, screen } from '@testing-library/react'
import TaskStatusIndicator from '../TaskStatusIndicator'

// Mock StatusBadge component
jest.mock('@/components/ui/status-badge', () => ({
  StatusBadge: ({ status, text, size }: any) => (
    <span data-testid="status-badge" data-status={status} data-size={size}>{text}</span>
  ),
}))

describe('TaskStatusIndicator', () => {
  it('should render completed status correctly', () => {
    render(<TaskStatusIndicator status="completed" />)

    const badge = screen.getByTestId('status-badge')
    expect(badge).toHaveAttribute('data-status', 'success')
    expect(badge).toHaveTextContent('已完成')
  })

  it('should render processing status correctly', () => {
    render(<TaskStatusIndicator status="processing" />)

    const badge = screen.getByTestId('status-badge')
    expect(badge).toHaveAttribute('data-status', 'info')
    expect(badge).toHaveTextContent('处理中')
  })

  it('should render failed status correctly', () => {
    render(<TaskStatusIndicator status="failed" />)

    const badge = screen.getByTestId('status-badge')
    expect(badge).toHaveAttribute('data-status', 'error')
    expect(badge).toHaveTextContent('失败')
  })

  it('should render pending status correctly', () => {
    render(<TaskStatusIndicator status="pending" />)

    const badge = screen.getByTestId('status-badge')
    expect(badge).toHaveAttribute('data-status', 'pending')
    expect(badge).toHaveTextContent('待处理')
  })

  it('should use pending as default for unknown status', () => {
    render(<TaskStatusIndicator status={'unknown' as any} />)

    const badge = screen.getByTestId('status-badge')
    expect(badge).toHaveAttribute('data-status', 'pending')
    expect(badge).toHaveTextContent('待处理')
  })

  it('should render with custom label', () => {
    render(<TaskStatusIndicator status="completed" label="Custom Label" />)

    expect(screen.getByTestId('status-badge')).toHaveTextContent('Custom Label')
  })

  it('should render without icon when showIcon is false', () => {
    const { container } = render(<TaskStatusIndicator status="completed" showIcon={false} />)

    expect(screen.queryByTestId('status-badge')).not.toBeInTheDocument()
    expect(container.querySelector('span')).toHaveTextContent('已完成')
  })

  it('should render with sm size by default', () => {
    render(<TaskStatusIndicator status="completed" />)

    expect(screen.getByTestId('status-badge')).toHaveAttribute('data-size', 'sm')
  })

  it('should render with md size when specified', () => {
    render(<TaskStatusIndicator status="completed" size="md" />)

    expect(screen.getByTestId('status-badge')).toHaveAttribute('data-size', 'md')
  })

  it('should render with sm size when specified', () => {
    render(<TaskStatusIndicator status="completed" size="sm" />)

    expect(screen.getByTestId('status-badge')).toHaveAttribute('data-size', 'sm')
  })
})
