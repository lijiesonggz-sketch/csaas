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

  it('renders previously uploaded documents returned by the list API', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: 'doc_legacy-1',
            name: '银行保险机构数据安全管理办法',
            filename: '银行保险机构数据安全管理办法',
            size: 1024,
            charCount: 17,
            createdAt: '2026-06-01T08:00:00.000Z',
          },
        ],
      }),
    })

    render(<UploadPage />)

    expect(await screen.findByText('已上传文档 (1)')).toBeInTheDocument()
    expect(screen.getByText('银行保险机构数据安全管理办法')).toBeInTheDocument()
  })
})
