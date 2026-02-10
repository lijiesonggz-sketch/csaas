/**
 * PDF导出工具函数
 * 使用CSS Print + window.print()方案
 */

/**
 * PDF导出选项
 */
export interface PDFExportOptions {
  /** 项目名称（用于文件名） */
  projectName: string
  /** 报告类型 */
  reportType?: string
  /** 是否在新窗口打开 */
  openInNewWindow?: boolean
  /** 打印前回调 */
  onBeforePrint?: () => void
  /** 打印后回调 */
  onAfterPrint?: () => void
}

/**
 * 生成PDF文件名
 * @param projectName - 项目名称
 * @param reportType - 报告类型
 * @returns 格式化的文件名
 */
export function generatePDFFilename(
  projectName: string,
  reportType: string = '差距分析报告'
): string {
  const date = new Date()
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  return `${projectName}-${reportType}-${dateStr}.pdf`
}

/**
 * 格式化日期为中文格式
 * @param date - 日期对象或日期字符串
 * @returns 格式化后的日期字符串
 */
export function formatReportDate(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * 打开报告预览窗口
 * @param url - 报告页面URL
 * @param projectName - 项目名称
 * @returns 打开的窗口引用
 */
export function openReportPreview(
  url: string,
  projectName: string
): Window | null {
  const windowName = `report-preview-${Date.now()}`
  const features = [
    'width=1200',
    'height=800',
    'menubar=yes',
    'toolbar=yes',
    'location=yes',
    'status=yes',
    'scrollbars=yes',
    'resizable=yes',
  ].join(',')

  const previewWindow = window.open(url, windowName, features)

  if (previewWindow) {
    // 设置窗口标题（在新窗口加载完成后）
    previewWindow.onload = () => {
      previewWindow.document.title = `${projectName} - 差距分析报告`
    }
  }

  return previewWindow
}

/**
 * 触发浏览器打印对话框
 * @param options - 打印选项
 */
export function triggerPrint(options: PDFExportOptions): void {
  const { onBeforePrint, onAfterPrint } = options

  // 打印前回调
  if (onBeforePrint) {
    onBeforePrint()
  }

  // 延迟执行打印，确保样式已应用
  setTimeout(() => {
    window.print()

    // 打印后回调
    if (onAfterPrint) {
      onAfterPrint()
    }
  }, 500)
}

/**
 * 导出PDF主函数
 * 在新窗口打开报告并触发打印
 * @param url - 报告页面URL
 * @param options - 导出选项
 * @returns 是否成功打开预览窗口
 */
export function exportToPDF(url: string, options: PDFExportOptions): boolean {
  const { projectName, openInNewWindow = true } = options

  if (openInNewWindow) {
    const previewWindow = openReportPreview(url, projectName)

    if (!previewWindow) {
      console.error('无法打开预览窗口，请检查是否被浏览器拦截')
      return false
    }

    // 等待新窗口加载完成后触发打印
    const checkAndPrint = () => {
      if (previewWindow.document.readyState === 'complete') {
        previewWindow.print()
      } else {
        setTimeout(checkAndPrint, 100)
      }
    }

    setTimeout(checkAndPrint, 1000)
    return true
  } else {
    // 在当前页面直接打印
    triggerPrint(options)
    return true
  }
}

/**
 * 创建报告页面的URL
 * @param baseUrl - 基础URL
 * @param projectId - 项目ID
 * @param params - 额外参数
 * @returns 完整的报告URL
 */
export function createReportUrl(
  baseUrl: string,
  projectId: string,
  params?: Record<string, string>
): string {
  const url = new URL(baseUrl, window.location.origin)
  url.searchParams.set('projectId', projectId)
  url.searchParams.set('mode', 'print')

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return url.toString()
}

/**
 * 检查浏览器是否支持打印
 * @returns 是否支持打印
 */
export function isPrintSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.print === 'function'
}

/**
 * 添加打印完成监听器
 * @param callback - 打印完成回调函数
 * @returns 取消监听的函数
 */
export function onPrintComplete(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  // 使用 matchMedia 监听打印状态
  const mediaQueryList = window.matchMedia('print')

  const handleChange = (mql: MediaQueryListEvent) => {
    if (!mql.matches) {
      // 打印结束（从打印状态变为非打印状态）
      callback()
    }
  }

  // 对于不支持 addEventListener 的浏览器使用 addListener
  if (mediaQueryList.addEventListener) {
    mediaQueryList.addEventListener('change', handleChange)
  } else if ((mediaQueryList as any).addListener) {
    ;(mediaQueryList as any).addListener(handleChange)
  }

  // 返回取消监听的函数
  return () => {
    if (mediaQueryList.removeEventListener) {
      mediaQueryList.removeEventListener('change', handleChange)
    } else if ((mediaQueryList as any).removeListener) {
      ;(mediaQueryList as any).removeListener(handleChange)
    }
  }
}

/**
 * 准备打印内容
 * 克隆当前内容并创建适合打印的文档
 * @param content - 要打印的HTML内容
 * @param title - 文档标题
 * @param styles - 额外的CSS样式
 * @returns 完整的HTML文档字符串
 */
export function preparePrintDocument(
  content: string,
  title: string,
  styles: string = ''
): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    /* 基础打印样式 */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      background: white;
    }

    /* 隐藏非打印元素 */
    .no-print {
      display: none !important;
    }

    /* 打印专用元素 */
    .print-only {
      display: block !important;
    }

    /* 分页控制 */
    .print-page-break {
      page-break-after: always;
    }

    .print-avoid-break {
      page-break-inside: avoid;
    }

    /* 页眉页脚 */
    @page {
      margin: 2cm;
      @top-center {
        content: attr(data-project-name);
        font-size: 10pt;
        color: #666;
      }
      @bottom-center {
        content: "第 " counter(page) " 页";
        font-size: 10pt;
        color: #666;
      }
    }

    ${styles}
  </style>
</head>
<body>
  ${content}
</body>
</html>
  `.trim()
}

/**
 * 下载HTML内容为文件
 * @param content - HTML内容
 * @param filename - 文件名
 */
export function downloadHTML(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
