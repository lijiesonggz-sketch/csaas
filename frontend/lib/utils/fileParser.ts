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
 * 解析PDF文件
 */
async function parsePdfFile(file: File): Promise<string> {
  try {
    // 动态导入 pdfjs-dist（仅在客户端）
    const pdfjsLib = await import('pdfjs-dist')

    // 配置 PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    let fullText = ''

    // 逐页提取文本
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')

      fullText += pageText + '\n'
    }

    return fullText.trim()
  } catch (error) {
    throw new Error(`PDF解析失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 解析DOCX文件
 */
async function parseDocxFile(file: File): Promise<string> {
  try {
    // 动态导入 mammoth（仅在客户端）
    const mammoth = await import('mammoth')

    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.default.extractRawText({ arrayBuffer })

    if (result.messages.length > 0) {
      console.warn('DOCX解析警告:', result.messages)
    }

    return result.value.trim()
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
      throw new Error(`不支持的文件格式: .${ext}。支持的格式: .txt, .md, .pdf, .docx, .doc`)
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
