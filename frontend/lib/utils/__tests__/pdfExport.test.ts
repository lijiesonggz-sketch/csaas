/**
 * PDF导出工具函数的测试套件
 *
 * 测试场景：
 * 1. 验证文件名生成函数正确格式化
 * 2. 验证日期格式化函数返回中文格式
 * 3. 验证报告预览窗口正确打开
 * 4. 验证打印触发功能
 * 5. 验证PDF导出主流程
 * 6. 验证URL创建函数
 * 7. 验证打印支持检测
 * 8. 验证打印完成监听
 * 9. 验证打印文档准备
 * 10. 验证HTML下载功能
 */

import {
  generatePDFFilename,
  formatReportDate,
  openReportPreview,
  triggerPrint,
  exportToPDF,
  createReportUrl,
  isPrintSupported,
  onPrintComplete,
  preparePrintDocument,
  downloadHTML,
  PDFExportOptions,
} from '../pdfExport'

// Mock window.open and other window methods will be done via jest.spyOn

describe('pdfExport - 文件名生成', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generatePDFFilename', () => {
    it('应该生成包含项目名称和日期的文件名', () => {
      // Arrange
      const projectName = '测试项目'
      const reportType = '差距分析报告'

      // Act
      const filename = generatePDFFilename(projectName, reportType)

      // Assert
      expect(filename).toContain('测试项目')
      expect(filename).toContain('差距分析报告')
      expect(filename).toMatch(/\d{8}\.pdf$/)
    })

    it('应该使用默认报告类型', () => {
      // Arrange
      const projectName = '我的项目'

      // Act
      const filename = generatePDFFilename(projectName)

      // Assert
      expect(filename).toContain('我的项目')
      expect(filename).toContain('差距分析报告')
    })

    it('应该处理特殊字符的项目名称', () => {
      // Arrange
      const projectName = '项目_2024-v1.0'

      // Act
      const filename = generatePDFFilename(projectName)

      // Assert
      expect(filename).toContain('项目_2024-v1.0')
    })

    it('应该生成正确的日期格式', () => {
      // Arrange
      const projectName = '测试项目'
      const beforeDate = new Date()

      // Act
      const filename = generatePDFFilename(projectName)

      // Arrange
      const afterDate = new Date()
      const year = beforeDate.getFullYear()
      const month = String(beforeDate.getMonth() + 1).padStart(2, '0')
      const day = String(beforeDate.getDate()).padStart(2, '0')
      const expectedDateStr = `${year}${month}${day}`

      // Assert
      expect(filename).toContain(expectedDateStr)
    })
  })
})

describe('pdfExport - 日期格式化', () => {
  describe('formatReportDate', () => {
    it('应该将Date对象格式化为中文日期', () => {
      // Arrange
      const date = new Date(2024, 0, 15) // 2024年1月15日

      // Act
      const formatted = formatReportDate(date)

      // Assert
      expect(formatted).toContain('2024年')
      expect(formatted).toContain('1月')
      expect(formatted).toContain('15日')
    })

    it('应该处理字符串日期', () => {
      // Arrange
      const dateStr = '2024-03-20'

      // Act
      const formatted = formatReportDate(dateStr)

      // Assert
      expect(formatted).toContain('2024年')
      expect(formatted).toContain('3月')
      expect(formatted).toContain('20日')
    })

    it('应该使用当前日期作为默认值', () => {
      // Arrange
      const beforeDate = new Date()

      // Act
      const formatted = formatReportDate()

      // Arrange
      const afterDate = new Date()
      const currentYear = beforeDate.getFullYear()

      // Assert
      expect(formatted).toContain(`${currentYear}年`)
    })

    it('应该正确补零月份和日期', () => {
      // Arrange
      const date = new Date(2024, 8, 5) // 2024年9月5日

      // Act
      const formatted = formatReportDate(date)

      // Assert
      expect(formatted).toBe('2024年9月5日')
    })
  })
})

describe('pdfExport - 报告预览窗口', () => {
  let mockWindow: Partial<Window>

  beforeEach(() => {
    mockWindow = {
      onload: null,
      document: {
        title: '',
      } as Document,
    }
    window.open = jest.fn().mockReturnValue(mockWindow)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('openReportPreview', () => {
    it('应该使用正确的窗口特性打开新窗口', () => {
      // Arrange
      const url = '/report/123'
      const projectName = '测试项目'

      // Act
      openReportPreview(url, projectName)

      // Assert
      expect(window.open).toHaveBeenCalledWith(
        url,
        expect.stringContaining('report-preview-'),
        expect.stringContaining('width=1200')
      )
      expect(window.open).toHaveBeenCalledWith(
        url,
        expect.any(String),
        expect.stringContaining('height=800')
      )
    })

    it('应该返回窗口引用', () => {
      // Arrange
      const url = '/report/123'
      const projectName = '测试项目'

      // Act
      const result = openReportPreview(url, projectName)

      // Assert
      expect(result).toBe(mockWindow)
    })

    it('应该在窗口加载完成后设置标题', () => {
      // Arrange
      const url = '/report/123'
      const projectName = '测试项目'

      // Act
      openReportPreview(url, projectName)

      // Simulate onload
      if (mockWindow.onload && typeof mockWindow.onload === 'function') {
        ;(mockWindow.onload as () => void)()
      }

      // Assert
      expect(mockWindow.document?.title).toBe('测试项目 - 差距分析报告')
    })

    it('应该处理窗口打开失败的情况', () => {
      // Arrange
      window.open = jest.fn().mockReturnValue(null)
      const url = '/report/123'
      const projectName = '测试项目'

      // Act
      const result = openReportPreview(url, projectName)

      // Assert
      expect(result).toBeNull()
    })
  })
})

describe('pdfExport - 打印触发', () => {
  let mockPrint: jest.Mock

  beforeEach(() => {
    mockPrint = jest.fn()
    window.print = mockPrint
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  describe('triggerPrint', () => {
    it('应该在延迟后触发打印', () => {
      // Arrange
      const options: PDFExportOptions = {
        projectName: '测试项目',
      }

      // Act
      triggerPrint(options)

      // Assert - print should not be called immediately
      expect(mockPrint).not.toHaveBeenCalled()

      // Fast-forward timers
      jest.advanceTimersByTime(500)

      // Assert - print should be called after delay
      expect(mockPrint).toHaveBeenCalled()
    })

    it('应该在打印前调用回调', () => {
      // Arrange
      const onBeforePrint = jest.fn()
      const options: PDFExportOptions = {
        projectName: '测试项目',
        onBeforePrint,
      }

      // Act
      triggerPrint(options)

      // Assert
      expect(onBeforePrint).toHaveBeenCalled()
    })

    it('应该在打印后调用回调', () => {
      // Arrange
      const onAfterPrint = jest.fn()
      const options: PDFExportOptions = {
        projectName: '测试项目',
        onAfterPrint,
      }

      // Act
      triggerPrint(options)
      jest.advanceTimersByTime(500)

      // Assert
      expect(onAfterPrint).toHaveBeenCalled()
    })

    it('应该在没有回调的情况下正常工作', () => {
      // Arrange
      const options: PDFExportOptions = {
        projectName: '测试项目',
      }

      // Act
      triggerPrint(options)
      jest.advanceTimersByTime(500)

      // Assert
      expect(mockPrint).toHaveBeenCalled()
    })
  })
})

describe('pdfExport - PDF导出主函数', () => {
  let mockWindow: Partial<Window>
  let mockPrint: jest.Mock

  beforeEach(() => {
    mockPrint = jest.fn()
    mockWindow = {
      onload: null,
      document: {
        readyState: 'complete',
        title: '',
      } as Document,
      print: mockPrint,
    }
    window.open = jest.fn().mockReturnValue(mockWindow)
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  describe('exportToPDF', () => {
    it('应该在新窗口打开报告', () => {
      // Arrange
      const url = '/report/123'
      const options: PDFExportOptions = {
        projectName: '测试项目',
        openInNewWindow: true,
      }

      // Act
      exportToPDF(url, options)

      // Assert
      expect(window.open).toHaveBeenCalled()
    })

    it('应该在新窗口加载完成后触发打印', () => {
      // Arrange
      const url = '/report/123'
      const options: PDFExportOptions = {
        projectName: '测试项目',
        openInNewWindow: true,
      }

      // Act
      exportToPDF(url, options)

      // Fast-forward timers to trigger checkAndPrint
      jest.advanceTimersByTime(1000)

      // Assert
      expect(mockPrint).toHaveBeenCalled()
    })

    it('应该在当前页面触发打印（当openInNewWindow为false）', () => {
      // Arrange
      window.print = jest.fn()
      const url = '/report/123'
      const options: PDFExportOptions = {
        projectName: '测试项目',
        openInNewWindow: false,
      }

      // Act
      exportToPDF(url, options)
      jest.advanceTimersByTime(500)

      // Assert
      expect(window.print).toHaveBeenCalled()
    })

    it('应该在窗口打开失败时返回false', () => {
      // Arrange
      window.open = jest.fn().mockReturnValue(null)
      const url = '/report/123'
      const options: PDFExportOptions = {
        projectName: '测试项目',
        openInNewWindow: true,
      }

      // Act
      const result = exportToPDF(url, options)

      // Assert
      expect(result).toBe(false)
    })

    it('应该在成功时返回true', () => {
      // Arrange
      const url = '/report/123'
      const options: PDFExportOptions = {
        projectName: '测试项目',
        openInNewWindow: true,
      }

      // Act
      const result = exportToPDF(url, options)

      // Assert
      expect(result).toBe(true)
    })

    it('应该处理文档未加载完成的情况', () => {
      // Arrange
      ;(mockWindow as any).document = {
        readyState: 'loading',
      } as Document
      const url = '/report/123'
      const options: PDFExportOptions = {
        projectName: '测试项目',
        openInNewWindow: true,
      }

      // Act
      exportToPDF(url, options)
      jest.advanceTimersByTime(1000)

      // Assert - print should not be called yet
      expect(mockPrint).not.toHaveBeenCalled()

      // Change readyState and advance time again
      ;(mockWindow as any).document.readyState = 'complete'
      jest.advanceTimersByTime(100)

      // Assert - print should be called now
      expect(mockPrint).toHaveBeenCalled()
    })
  })
})

describe('pdfExport - URL创建', () => {
  const originalLocation = window.location

  beforeEach(() => {
    // @ts-ignore
    delete window.location
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:3000',
      },
      writable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    })
  })

  describe('createReportUrl', () => {
    it('应该创建包含projectId的URL', () => {
      // Arrange
      const baseUrl = '/report'
      const projectId = 'proj-123'

      // Act
      const url = createReportUrl(baseUrl, projectId)

      // Assert
      expect(url).toContain('projectId=proj-123')
      expect(url).toContain('mode=print')
    })

    it('应该添加额外参数', () => {
      // Arrange
      const baseUrl = '/report'
      const projectId = 'proj-123'
      const params = { format: 'pdf', lang: 'zh' }

      // Act
      const url = createReportUrl(baseUrl, projectId, params)

      // Assert
      expect(url).toContain('format=pdf')
      expect(url).toContain('lang=zh')
    })

    it('应该正确处理相对URL', () => {
      // Arrange
      const baseUrl = '/projects/123/gap-analysis/report'
      const projectId = 'proj-456'

      // Act
      const url = createReportUrl(baseUrl, projectId)

      // Assert
      expect(url).toContain('/projects/123/gap-analysis/report')
    })
  })
})

describe('pdfExport - 打印支持检测', () => {
  describe('isPrintSupported', () => {
    it('应该在支持打印的环境中返回true', () => {
      // Arrange - window.print is already mocked
      window.print = jest.fn()

      // Act
      const result = isPrintSupported()

      // Assert
      expect(result).toBe(true)
    })

    it('应该在不支持打印的环境中返回false', () => {
      // Arrange
      const originalPrint = window.print
      // @ts-ignore
      window.print = undefined

      // Act
      const result = isPrintSupported()

      // Assert
      expect(result).toBe(false)

      // Restore
      window.print = originalPrint
    })
  })
})

describe('pdfExport - 打印完成监听', () => {
  let mockMediaQueryList: {
    matches: boolean
    addEventListener: jest.Mock
    removeEventListener: jest.Mock
    addListener: jest.Mock
    removeListener: jest.Mock
  }

  beforeEach(() => {
    mockMediaQueryList = {
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }
    window.matchMedia = jest.fn().mockReturnValue(mockMediaQueryList)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('onPrintComplete', () => {
    it('应该添加媒体查询监听器', () => {
      // Arrange
      const callback = jest.fn()

      // Act
      onPrintComplete(callback)

      // Assert
      expect(window.matchMedia).toHaveBeenCalledWith('print')
    })

    it('应该在支持addEventListener的浏览器中使用它', () => {
      // Arrange
      const callback = jest.fn()

      // Act
      onPrintComplete(callback)

      // Assert
      expect(mockMediaQueryList.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      )
    })

    it('应该在不支持addEventListener的浏览器中使用addListener', () => {
      // Arrange
      mockMediaQueryList.addEventListener = undefined as any
      const callback = jest.fn()

      // Act
      onPrintComplete(callback)

      // Assert
      expect(mockMediaQueryList.addListener).toHaveBeenCalledWith(expect.any(Function))
    })

    it('应该在打印结束时调用回调', () => {
      // Arrange
      const callback = jest.fn()
      let changeHandler: Function | null = null

      mockMediaQueryList.addEventListener = jest.fn((_event: string, handler: EventListener) => {
        changeHandler = handler as Function
      })

      onPrintComplete(callback)

      // Act - simulate print ending (matches goes from true to false)
      if (changeHandler && typeof changeHandler === 'function') {
        ;(changeHandler as Function)({ matches: false } as MediaQueryListEvent)
      }

      // Assert
      expect(callback).toHaveBeenCalled()
    })

    it('不应该在打印开始时调用回调', () => {
      // Arrange
      const callback = jest.fn()
      let changeHandler: Function | null = null

      mockMediaQueryList.addEventListener = jest.fn((_event: string, handler: EventListener) => {
        changeHandler = handler as Function
      })

      onPrintComplete(callback)

      // Act - simulate print starting (matches is true)
      if (changeHandler && typeof changeHandler === 'function') {
        ;(changeHandler as Function)({ matches: true } as MediaQueryListEvent)
      }

      // Assert
      expect(callback).not.toHaveBeenCalled()
    })

    it('应该返回取消监听函数', () => {
      // Arrange
      const callback = jest.fn()

      // Act
      const unsubscribe = onPrintComplete(callback)

      // Assert
      expect(typeof unsubscribe).toBe('function')
    })

    it('应该使用removeEventListener取消监听', () => {
      // Arrange
      const callback = jest.fn()
      const unsubscribe = onPrintComplete(callback)

      // Act
      unsubscribe()

      // Assert
      expect(mockMediaQueryList.removeEventListener).toHaveBeenCalled()
    })

    it('应该在旧浏览器中使用removeListener取消监听', () => {
      // Arrange
      mockMediaQueryList.removeEventListener = undefined as any
      const callback = jest.fn()
      const unsubscribe = onPrintComplete(callback)

      // Act
      unsubscribe()

      // Assert
      expect(mockMediaQueryList.removeListener).toHaveBeenCalled()
    })

    it('应该在SSR环境中返回空函数', () => {
      // Arrange
      const originalWindow = global.window
      // @ts-ignore
      global.window = undefined

      // Act
      const unsubscribe = onPrintComplete(() => {})

      // Assert
      expect(typeof unsubscribe).toBe('function')

      // Restore
      global.window = originalWindow
    })
  })
})

describe('pdfExport - 打印文档准备', () => {
  describe('preparePrintDocument', () => {
    it('应该生成完整的HTML文档', () => {
      // Arrange
      const content = '<div>Test Content</div>'
      const title = 'Test Report'

      // Act
      const html = preparePrintDocument(content, title)

      // Assert
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<html lang="zh-CN">')
      expect(html).toContain('<head>')
      expect(html).toContain('<title>Test Report</title>')
      expect(html).toContain('<div>Test Content</div>')
    })

    it('应该包含打印样式', () => {
      // Arrange
      const content = '<div>Test</div>'
      const title = 'Test Report'

      // Act
      const html = preparePrintDocument(content, title)

      // Assert
      expect(html).toContain('.no-print')
      expect(html).toContain('.print-only')
      expect(html).toContain('.print-page-break')
      expect(html).toContain('.print-avoid-break')
      expect(html).toContain('@page')
    })

    it('应该添加自定义样式', () => {
      // Arrange
      const content = '<div>Test</div>'
      const title = 'Test Report'
      const customStyles = '.custom { color: red; }'

      // Act
      const html = preparePrintDocument(content, title, customStyles)

      // Assert
      expect(html).toContain('.custom { color: red; }')
    })

    it('应该包含基础CSS重置', () => {
      // Arrange
      const content = '<div>Test</div>'
      const title = 'Test Report'

      // Act
      const html = preparePrintDocument(content, title)

      // Assert
      expect(html).toContain('box-sizing: border-box')
      expect(html).toContain('margin: 0')
      expect(html).toContain('padding: 0')
    })

    it('应该设置中文字体', () => {
      // Arrange
      const content = '<div>Test</div>'
      const title = 'Test Report'

      // Act
      const html = preparePrintDocument(content, title)

      // Assert
      expect(html).toContain('PingFang SC')
      expect(html).toContain('Microsoft YaHei')
    })
  })
})

describe('pdfExport - HTML下载', () => {
  let mockLink: HTMLAnchorElement
  let mockBlob: jest.Mock
  let mockCreateObjectURL: jest.Mock
  let mockRevokeObjectURL: jest.Mock

  beforeEach(() => {
    mockLink = document.createElement('a')
    mockLink.click = jest.fn()
    jest.spyOn(document, 'createElement').mockReturnValue(mockLink)
    jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink)
    jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink)

    mockBlob = jest.fn()
    global.Blob = mockBlob as any

    mockCreateObjectURL = jest.fn().mockReturnValue('blob:mock-url')
    mockRevokeObjectURL = jest.fn()
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('downloadHTML', () => {
    it('应该创建Blob对象', () => {
      // Arrange
      const content = '<html><body>Test</body></html>'
      const filename = 'test.html'

      // Act
      downloadHTML(content, filename)

      // Assert
      expect(mockBlob).toHaveBeenCalledWith([content], { type: 'text/html;charset=utf-8' })
    })

    it('应该创建下载链接', () => {
      // Arrange
      const content = '<html><body>Test</body></html>'
      const filename = 'test.html'

      // Act
      downloadHTML(content, filename)

      // Assert
      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockLink.href).toBe('blob:mock-url')
      expect(mockLink.download).toBe('test.html')
    })

    it('应该触发点击下载', () => {
      // Arrange
      const content = '<html><body>Test</body></html>'
      const filename = 'test.html'
      const clickSpy = jest.spyOn(mockLink, 'click')

      // Act
      downloadHTML(content, filename)

      // Assert
      expect(clickSpy).toHaveBeenCalled()
    })

    it('应该清理资源', () => {
      // Arrange
      const content = '<html><body>Test</body></html>'
      const filename = 'test.html'

      // Act
      downloadHTML(content, filename)

      // Assert
      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink)
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    })
  })
})
