import { Injectable, BadRequestException, Logger } from '@nestjs/common'

// 使用require导入pdf-parse v2
// pdf-parse v2使用PDFParse类，支持data参数加载buffer
const pdfParseModule = require('pdf-parse')

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name)
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

  /**
   * Parse PDF file and extract text content
   * @param fileBuffer Buffer containing PDF file data
   * @returns Extracted text content
   */
  async parsePdf(fileBuffer: Buffer): Promise<string> {
    // 验证输入
    if (!fileBuffer) {
      throw new BadRequestException('PDF文件内容不能为空')
    }

    if (fileBuffer.length === 0) {
      throw new BadRequestException('PDF文件大小为0')
    }

    if (fileBuffer.length > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `PDF文件过大。最大支持${this.MAX_FILE_SIZE / 1024 / 1024}MB`
      )
    }

    let parser: any = null

    try {
      this.logger.log(`开始解析PDF，大小: ${fileBuffer.length} bytes`)

      // 使用pdf-parse v2解析PDF
      // 必须传入{ data: buffer }参数
      const { PDFParse, VerbosityLevel } = pdfParseModule
      parser = new PDFParse({
        data: fileBuffer,
        verbosity: VerbosityLevel.ERRORS, // 只显示错误信息
      })

      // 提取文本
      const result = await parser.getText()

      this.logger.log(
        `PDF解析成功，页数: ${result.total}，文本长度: ${result.text.length}`
      )

      // 清理资源
      await parser.destroy()

      // 返回提取的文本
      return result.text
    } catch (error) {
      this.logger.error('PDF解析失败:', error)

      // 确保清理资源
      if (parser) {
        try {
          await parser.destroy()
        } catch (cleanupError) {
          this.logger.warn('清理parser资源失败:', cleanupError)
        }
      }

      if (error instanceof BadRequestException) {
        throw error
      }

      throw new BadRequestException(
        `PDF解析失败: ${error instanceof Error ? error.message : '未知错误'}`
      )
    }
  }
}
