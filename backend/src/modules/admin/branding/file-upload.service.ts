import { Injectable, BadRequestException } from '@nestjs/common'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as sharp from 'sharp'

/**
 * File Upload Service
 *
 * Handles file uploads for branding assets (logos).
 *
 * @story 6-3
 */
@Injectable()
export class FileUploadService {
  private readonly UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'tenants')
  private readonly MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
  private readonly ALLOWED_MIMETYPES = ['image/png', 'image/jpeg', 'image/svg+xml']
  private readonly MAX_WIDTH = 400 // Maximum width for compressed images

  /**
   * Validate uploaded file
   *
   * @param file - Uploaded file
   * @throws BadRequestException if validation fails
   */
  async validateFile(file: Express.Multer.File): Promise<void> {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException('文件大小不能超过 2MB')
    }

    // Check file type
    if (!this.ALLOWED_MIMETYPES.includes(file.mimetype)) {
      throw new BadRequestException('只支持 PNG, JPG, SVG 格式')
    }

    // SVG special handling: check for malicious scripts
    if (file.mimetype === 'image/svg+xml') {
      const svgContent = file.buffer.toString('utf-8')
      if (/<script/i.test(svgContent) || /javascript:/i.test(svgContent) || /on\w+=/i.test(svgContent)) {
        throw new BadRequestException('SVG 文件包含不安全内容')
      }
    }
  }

  /**
   * Compress image to maximum width while maintaining aspect ratio
   *
   * @param buffer - Image buffer
   * @param mimetype - Image MIME type
   * @returns Compressed image buffer
   */
  async compressImage(buffer: Buffer, mimetype: string): Promise<Buffer> {
    // Skip compression for SVG files
    if (mimetype === 'image/svg+xml') {
      return buffer
    }

    // Compress using sharp
    return sharp(buffer)
      .resize(this.MAX_WIDTH, null, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer()
  }

  /**
   * Get upload path for a file
   *
   * @param tenantId - Tenant ID
   * @param filename - Original filename
   * @returns Full upload path
   */
  getUploadPath(tenantId: string, filename: string): string {
    // Validate tenantId format (UUID)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new BadRequestException('Invalid tenant ID')
    }

    // Sanitize filename - remove path separators
    const safeFilename = path.basename(filename)
    const uploadPath = path.join(this.UPLOAD_DIR, tenantId, safeFilename)

    // Verify final path is within allowed directory
    if (!uploadPath.startsWith(this.UPLOAD_DIR)) {
      throw new BadRequestException('Invalid file path')
    }

    return uploadPath
  }

  /**
   * Get public URL for an uploaded file
   *
   * @param tenantId - Tenant ID
   * @param filename - Filename
   * @returns Public URL path
   */
  getPublicUrl(tenantId: string, filename: string): string {
    return `/uploads/tenants/${tenantId}/${filename}`
  }

  /**
   * Ensure upload directory exists
   *
   * @param tenantId - Tenant ID
   */
  async ensureUploadDir(tenantId: string): Promise<void> {
    const uploadPath = path.join(this.UPLOAD_DIR, tenantId)
    await fs.mkdir(uploadPath, { recursive: true })
  }

  /**
   * Save uploaded file
   *
   * @param file - Uploaded file
   * @param tenantId - Tenant ID
   * @returns Public URL of saved file
   */
  async saveFile(file: Express.Multer.File, tenantId: string): Promise<string> {
    // Validate file
    await this.validateFile(file)

    // Compress image
    const compressedBuffer = await this.compressImage(file.buffer, file.mimetype)

    // Ensure directory exists
    await this.ensureUploadDir(tenantId)

    // Generate safe filename
    const ext = path.extname(file.originalname)
    const filename = `logo${ext}`

    // Save file
    const uploadPath = this.getUploadPath(tenantId, filename)
    await fs.writeFile(uploadPath, compressedBuffer)

    // Return public URL
    return this.getPublicUrl(tenantId, filename)
  }

  /**
   * Delete file
   *
   * @param tenantId - Tenant ID
   * @param filename - Filename to delete
   */
  async deleteFile(tenantId: string, filename: string): Promise<void> {
    const uploadPath = this.getUploadPath(tenantId, filename)
    try {
      await fs.unlink(uploadPath)
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }
}
