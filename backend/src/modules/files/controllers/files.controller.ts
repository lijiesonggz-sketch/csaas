import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { FilesService } from '../services/files.service'

@Controller('files')
export class FilesController {
  private readonly logger = new Logger(FilesController.name)

  constructor(private readonly filesService: FilesService) {}

  /**
   * Parse PDF file and extract text content
   * POST /files/parse-pdf
   *
   * This endpoint accepts a PDF file upload and returns the extracted text content.
   * It's used by the frontend to avoid client-side PDF parsing issues with Next.js.
   */
  @Post('parse-pdf')
  @UseInterceptors(FileInterceptor('file'))
  async parsePdf(@UploadedFile() file: Express.Multer.File) {
    this.logger.log(`收到PDF解析请求: ${file?.originalname}, 大小: ${file?.size} bytes`)

    if (!file) {
      throw new BadRequestException('请上传文件')
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('只支持PDF文件')
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB
      throw new BadRequestException('文件大小不能超过10MB')
    }

    try {
      const text = await this.filesService.parsePdf(file.buffer)

      this.logger.log(`PDF解析成功，提取文本长度: ${text.length}`)

      return {
        success: true,
        data: {
          text,
          filename: file.originalname,
          size: file.size,
        },
      }
    } catch (error) {
      this.logger.error('PDF解析失败:', error)
      throw error
    }
  }
}
