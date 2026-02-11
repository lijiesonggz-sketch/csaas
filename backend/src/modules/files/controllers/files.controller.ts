import {
  Controller,
  Post,
  Delete,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
  Body,
  Param,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { FilesService } from '../services/files.service'
import { StandardDocument } from '@/database/entities/standard-document.entity'
import { Project } from '@/database/entities/project.entity'
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard'

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  private readonly logger = new Logger(FilesController.name)

  constructor(
    private readonly filesService: FilesService,
    @InjectRepository(StandardDocument)
    private readonly standardDocumentRepo: Repository<StandardDocument>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

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

  /**
   * Upload and save standard document for a project
   * POST /files/projects/:projectId/documents
   */
  @Post('projects/:projectId/documents')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProjectDocument(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('standardName') standardName?: string,
  ) {
    this.logger.log(`收到项目文档上传请求: projectId=${projectId}, filename=${file?.originalname}`)

    if (!file) {
      throw new BadRequestException('请上传文件')
    }

    // 支持的文件类型
    const supportedTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]

    if (!supportedTypes.includes(file.mimetype)) {
      throw new BadRequestException('只支持 PDF、TXT、MD、DOCX 文件')
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('文件大小不能超过10MB')
    }

    try {
      // 提取文本内容
      let content = ''
      if (file.mimetype === 'application/pdf') {
        content = await this.filesService.parsePdf(file.buffer)
      } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // DOCX 文件 - 使用 mammoth 解析
        content = await this.filesService.parseDocx(file.buffer)
      } else {
        // 文本文件读取，处理编码问题
        try {
          // 尝试 UTF-8 解码，替换无效字符
          const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false })
          content = decoder.decode(file.buffer)

          // 移除 null 字节和其他控制字符（保留换行符 \n 和 \r）
          content = content.replace(/\x00/g, '')  // null 字节
          content = content.replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') // 其他控制字符

        } catch (decodeError) {
          this.logger.error('文件解码失败:', decodeError)
          throw new BadRequestException('文件编码错误，请确保文件是 UTF-8 编码')
        }
      }

      if (!content || content.trim().length === 0) {
        throw new BadRequestException('文件内容为空')
      }

      // 保存到标准文档表
      const doc = this.standardDocumentRepo.create({
        name: standardName || file.originalname,
        content,
        projectId,
        metadata: {
          original_filename: file.originalname,
          mime_type: file.mimetype,
          size: file.size,
          uploaded_at: new Date().toISOString(),
        },
      })

      await this.standardDocumentRepo.save(doc)

      // 更新项目 metadata 中的 uploadedDocuments
      const project = await this.projectRepo.findOne({ where: { id: projectId } })
      if (project) {
        const existingDocs = (project.metadata as any)?.uploadedDocuments || []
        const updatedDocs = [
          ...existingDocs,
          {
            id: doc.id,
            name: doc.name,
            filename: file.originalname,
            content: doc.content,
            uploadedAt: doc.createdAt,
          },
        ]
        project.metadata = {
          ...(project.metadata || {}),
          uploadedDocuments: updatedDocs,
        }
        await this.projectRepo.save(project)
        this.logger.log(`已更新项目 ${projectId} 的 uploadedDocuments，现有 ${updatedDocs.length} 个文档`)
      }

      this.logger.log(`文档上传成功: docId=${doc.id}, 字数=${content.length}`)

      return {
        success: true,
        data: {
          id: doc.id,
          name: doc.name,
          filename: file.originalname,
          size: file.size,
          charCount: content.length,
          createdAt: doc.createdAt,
        },
        message: '文档上传成功',
      }
    } catch (error) {
      this.logger.error('文档上传失败:', error)
      if (error instanceof BadRequestException) {
        throw error
      }
      throw new BadRequestException(
        `文档上传失败: ${error instanceof Error ? error.message : '未知错误'}`,
      )
    }
  }

  /**
   * Get documents for a project
   * GET /files/projects/:projectId/documents
   */
  @Post('projects/:projectId/documents/list')
  async getProjectDocuments(@Param('projectId') projectId: string) {
    this.logger.log(`获取项目文档列表: projectId=${projectId}`)

    const docs = await this.standardDocumentRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    })

    return {
      success: true,
      data: docs.map((doc) => ({
        id: doc.id,
        name: doc.name,
        charCount: doc.content.length,
        createdAt: doc.createdAt,
        metadata: doc.metadata,
      })),
    }
  }

  /**
   * Delete a document
   * DELETE /files/projects/:projectId/documents/:docId
   */
  @Delete('projects/:projectId/documents/:docId')
  async deleteDocument(
    @Param('projectId') projectId: string,
    @Param('docId') docId: string,
  ) {
    this.logger.log(`删除文档请求: projectId=${projectId}, docId=${docId}`)

    // 查找文档
    const doc = await this.standardDocumentRepo.findOne({
      where: { id: docId, projectId },
    })

    if (!doc) {
      throw new NotFoundException('文档不存在或已被删除')
    }

    // 删除文档
    await this.standardDocumentRepo.remove(doc)

    // 更新项目 metadata，移除已删除的文档
    const project = await this.projectRepo.findOne({ where: { id: projectId } })
    if (project) {
      const existingDocs = (project.metadata as any)?.uploadedDocuments || []
      const updatedDocs = existingDocs.filter((d: any) => d.id !== docId)
      project.metadata = {
        ...(project.metadata || {}),
        uploadedDocuments: updatedDocs,
      }
      await this.projectRepo.save(project)
      this.logger.log(`已从项目 ${projectId} 的 uploadedDocuments 中移除文档 ${docId}`)
    }

    this.logger.log(`文档删除成功: docId=${docId}`)

    return {
      success: true,
      message: '文档删除成功',
      data: {
        id: docId,
        name: doc.name,
      },
    }
  }
}
