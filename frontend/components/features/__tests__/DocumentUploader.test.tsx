import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DocumentUploader from '../DocumentUploader'
import { toast } from 'sonner'

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}))

// Mock mammoth for docx parsing
jest.mock('mammoth', () => ({
  extractRawText: jest.fn(),
}))

const mockOnDocumentChange = jest.fn()

describe('DocumentUploader', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('[P0] renders text input mode by default', () => {
    render(<DocumentUploader onDocumentChange={mockOnDocumentChange} />)

    // Check for mode buttons
    expect(screen.getByRole('button', { name: '文本输入' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '文件上传' })).toBeInTheDocument()

    // Text input mode should be active (contained variant)
    const textButton = screen.getByRole('button', { name: '文本输入' })
    expect(textButton).toHaveClass('MuiButton-contained')

    // Textarea should be visible
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('[P0] switches to file upload mode when clicked', () => {
    render(<DocumentUploader onDocumentChange={mockOnDocumentChange} />)

    // Click file upload button
    fireEvent.click(screen.getByRole('button', { name: '文件上传' }))

    // File upload area should be visible
    expect(screen.getByText('点击或拖拽文件到此区域上传')).toBeInTheDocument()
    expect(screen.getByText(/支持格式/)).toBeInTheDocument()
  })

  it('[P0] textarea accepts text input', () => {
    render(<DocumentUploader onDocumentChange={mockOnDocumentChange} />)

    const textarea = screen.getByRole('textbox')
    const testContent = '这是一段测试文档内容'

    // Textarea should accept input
    fireEvent.change(textarea, { target: { value: testContent } })

    // Value should be updated in the textarea
    expect(textarea).toHaveValue(testContent)
  })

  it('[P1] displays help text', () => {
    render(<DocumentUploader onDocumentChange={mockOnDocumentChange} />)

    expect(screen.getByText(/请上传完整的IT标准文档/)).toBeInTheDocument()
    expect(screen.getByText(/建议文档长度在1000-10000字之间/)).toBeInTheDocument()
  })

  it('[P1] disables inputs when disabled prop is true', () => {
    render(<DocumentUploader onDocumentChange={mockOnDocumentChange} disabled={true} />)

    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: '文本输入' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '文件上传' })).toBeDisabled()
  })

  it('[P1] displays file requirements', () => {
    render(<DocumentUploader onDocumentChange={mockOnDocumentChange} />)

    // Switch to file upload mode
    fireEvent.click(screen.getByRole('button', { name: '文件上传' }))

    expect(screen.getByText(/支持格式/)).toBeInTheDocument()
    expect(screen.getByText(/最大文件大小/)).toBeInTheDocument()
  })

  it('[P2] textarea has monospace font styling', () => {
    render(<DocumentUploader onDocumentChange={mockOnDocumentChange} />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveClass('MuiInputBase-inputMultiline')
  })

  it('[P2] displays placeholder text in textarea', () => {
    render(<DocumentUploader onDocumentChange={mockOnDocumentChange} />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('placeholder', expect.stringContaining('请粘贴标准文档内容'))
  })
})
