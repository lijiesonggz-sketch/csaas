import { fireEvent, render, screen } from '@testing-library/react'

import UploadPage from '../page'
import { useParams, useRouter } from 'next/navigation'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('@/lib/message', () => ({
  message: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/lib/utils/jwt', () => ({
  getAuthHeadersAsync: jest.fn().mockResolvedValue({}),
}))

describe('UploadPage', () => {
  const mockBack = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useParams as jest.Mock).mockReturnValue({ projectId: 'project-1' })
    ;(useRouter as jest.Mock).mockReturnValue({ back: mockBack })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, data: [] }),
    }) as any
  })

  it('renders the current upload header and helper copy', () => {
    render(<UploadPage />)

    expect(screen.getByText('上传文档')).toBeInTheDocument()
    expect(screen.getByText('选择文件或拖拽到此处')).toBeInTheDocument()
    expect(screen.getByText(/支持 PDF、TXT、MD、DOCX 格式/)).toBeInTheDocument()
  })

  it('renders the current file input contract', () => {
    render(<UploadPage />)

    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInTheDocument()
    expect(fileInput).toHaveAttribute('accept', '.pdf,.txt,.md,.docx')
  })

  it('navigates back from the current header action', () => {
    render(<UploadPage />)

    fireEvent.click(screen.getByRole('button', { name: /返回/ }))
    expect(mockBack).toHaveBeenCalledTimes(1)
  })
})
