/**
 * 文件解析工具
 * 支持 TXT, MD, PDF, DOCX 格式
 *
 * 注意：使用动态导入避免 Next.js SSR 错误
 */

/**
 * 解析文本文件（TXT, MD）
 */
async function parseTextFile(file: File): Promise<string> {
  return await file.text()
}

/**
 * 解析PDF文件（使用服务端API）
 *
 * 将PDF上传到后端进行解析，避免客户端webpack兼容性问题
 */
async function parsePdfFile(file: File): Promise<string> {
  try {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

    // 创建FormData
    const formData = new FormData()
    formData.append('file', file)

    console.log('📤 正在上传PDF到后端解析:', file.name)

    // 调用后端API
    const response = await fetch(`${API_BASE_URL}/files/parse-pdf`, {
      method: 'POST',
      body: formData,
      // 不设置Content-Type，让浏览器自动设置multipart/form-data边界
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || `PDF解析失败: ${response.statusText}`)
    }

    const result = await response.json()

    if (!result.success || !result.data?.text) {
      throw new Error('PDF解析返回数据格式错误')
    }

    console.log('✅ PDF解析成功，提取文本长度:', result.data.text.length)

    return result.data.text
  } catch (error) {
    console.error('PDF解析错误:', error)
    throw new Error(`PDF解析失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 解析DOCX文件
 * 使用mammoth的convertToHtml方法来保留Word的自动编号和格式
 */
async function parseDocxFile(file: File): Promise<string> {
  try {
    // 动态导入 mammoth（仅在客户端）
    const mammoth = await import('mammoth')

    const arrayBuffer = await file.arrayBuffer()

    // ✅ 改用convertToHtml来保留Word的自动编号、列表等格式
    const result = await mammoth.default.convertToHtml({
      arrayBuffer,
      // 保留样式信息，帮助识别编号
      styleMap: [
        // 保留段落样式
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Heading 1'] => h2:fresh",
        "p[style-name='Heading 2'] => h3:fresh",
      ]
    })

    if (result.messages.length > 0) {
      console.warn('DOCX解析警告:', result.messages)
    }

    // 从HTML中提取文本，同时保留结构
    const html = result.value

    // 处理HTML，保留文本内容和基本结构
    let text = html

    // 保留列表项的编号（<ol><li>会转换为"1. "格式）
    text = text.replace(/<ol[^>]*>/gi, '')
    text = text.replace(/<\/ol>/gi, '\n')
    text = text.replace(/<ul[^>]*>/gi, '')
    text = text.replace(/<\/ul>/gi, '\n')
    text = text.replace(/<li[^>]*>/gi, '\n• ')
    text = text.replace(/<\/li>/gi, '\n')

    // 保留标题
    text = text.replace(/<h1[^>]*>/gi, '\n\n')
    text = text.replace(/<\/h1>/gi, '\n\n')
    text = text.replace(/<h2[^>]*>/gi, '\n\n')
    text = text.replace(/<\/h2>/gi, '\n\n')
    text = text.replace(/<h3[^>]*>/gi, '\n\n')
    text = text.replace(/<\/h3>/gi, '\n\n')

    // 移除其他HTML标签但保留文本
    text = text.replace(/<p[^>]*>/gi, '\n')
    text = text.replace(/<\/p>/gi, '\n')
    text = text.replace(/<div[^>]*>/gi, '\n')
    text = text.replace(/<\/div>/gi, '\n')
    text = text.replace(/<span[^>]*>/gi, '')
    text = text.replace(/<\/span>/gi, '')
    text = text.replace(/<strong[^>]*>/gi, '')
    text = text.replace(/<\/strong>/gi, '')
    text = text.replace(/<b[^>]*>/gi, '')
    text = text.replace(/<\/b>/gi, '')
    text = text.replace(/<em[^>]*>/gi, '')
    text = text.replace(/<\/em>/gi, '')
    text = text.replace(/<i[^>]*>/gi, '')
    text = text.replace(/<\/i>/gi, '')

    // 移除剩余的所有HTML标签
    text = text.replace(/<[^>]+>/g, '')

    // 清理多余的空白字符
    text = text.replace(/&nbsp;/gi, ' ')
    text = text.replace(/&amp;/gi, '&')
    text = text.replace(/&lt;/gi, '<')
    text = text.replace(/&gt;/gi, '>')
    text = text.replace(/&quot;/gi, '"')
    text = text.replace(/\n{3,}/g, '\n\n') // 多个连续换行压缩为两个

    return text.trim()
  } catch (error) {
    throw new Error(`DOCX解析失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 获取文件扩展名
 */
function getFileExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

/**
 * 统一的文件解析接口
 * @param file 要解析的文件
 * @returns 解析后的文本内容
 */
export async function parseFile(file: File): Promise<string> {
  const ext = getFileExtension(file.name)

  switch (ext) {
    case 'txt':
    case 'md':
      return await parseTextFile(file)

    case 'pdf':
      return await parsePdfFile(file)

    case 'docx':
      return await parseDocxFile(file)

    case 'doc':
      // DOC格式较老，mammoth也支持但效果可能不如DOCX
      // 建议用户转换为DOCX格式以获得更好的解析效果
      try {
        return await parseDocxFile(file)
      } catch (error) {
        throw new Error('DOC文件解析失败，建议转换为DOCX格式后重试')
      }

    default:
      throw new Error(`不支持的文件格式: .${ext}。当前支持的格式: .txt, .md, .pdf, .docx, .doc`)
  }
}

/**
 * 验证文件格式是否支持
 */
export function isSupportedFileType(filename: string): boolean {
  const ext = getFileExtension(filename)
  return ['txt', 'md', 'pdf', 'docx', 'doc'].includes(ext)
}

/**
 * 获取支持的文件扩展名列表（用于Upload组件的accept属性）
 */
export const SUPPORTED_FILE_EXTENSIONS = '.txt,.md,.pdf,.docx,.doc'

/**
 * 检测文本内容质量（用于识别扫描PDF或解析失败）
 */
export function detectTextQuality(text: string): {
  isValid: boolean
  quality: 'good' | 'poor' | 'empty'
  issue?: string
  suggestion?: string
} {
  if (!text || text.length === 0) {
    return {
      isValid: false,
      quality: 'empty',
      issue: '文档内容为空',
      suggestion: 'PDF文件可能已损坏或使用特殊编码'
    }
  }

  // 检测乱码比例（非可打印字符）
  const controlChars = text.replace(/[\x20-\x7E\u4E00-\u9FFF\u3000-\u303F]/g, '').length
  const controlCharRatio = controlChars / text.length

  if (controlCharRatio > 0.3) {
    return {
      isValid: false,
      quality: 'poor',
      issue: '文档内容包含大量乱码',
      suggestion: 'PDF文件是扫描件（图片格式），需要使用OCR工具转换为可搜索的PDF'
    }
  }

  // 检测是否包含中英文内容
  const hasChinese = /[\u4E00-\u9FFF]/.test(text)
  const hasEnglish = /[a-zA-Z]{3,}/.test(text)

  if (!hasChinese && !hasEnglish) {
    return {
      isValid: false,
      quality: 'poor',
      issue: '文档内容无法识别',
      suggestion: 'PDF可能是扫描件或使用了特殊编码，建议尝试其他格式的文档'
    }
  }

  // 检测有效字符密度
  const meaningfulChars = text.replace(/\s+/g, '').length
  const density = meaningfulChars / text.length

  if (density < 0.3) {
    return {
      isValid: false,
      quality: 'poor',
      issue: '文档内容稀疏',
      suggestion: 'PDF解析可能不完整，建议检查PDF文件或尝试重新上传'
    }
  }

  return {
    isValid: true,
    quality: 'good'
  }
}
