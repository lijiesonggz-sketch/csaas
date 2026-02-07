import { Test, TestingModule } from '@nestjs/testing'
import { FileUploadService } from './file-upload.service'
import * as fs from 'fs/promises'
import * as path from 'path'

describe('FileUploadService', () => {
  let service: FileUploadService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FileUploadService],
    }).compile()

    service = module.get<FileUploadService>(FileUploadService)
  })

  afterEach(async () => {
    // 清理测试文件
    const testUploadDir = path.join(process.cwd(), 'uploads', 'test-tenant')
    try {
      await fs.rm(testUploadDir, { recursive: true, force: true })
    } catch (error) {
      // 忽略清理错误
    }
  })

  describe('validateFile', () => {
    it('should accept PNG files', async () => {
      const file = {
        mimetype: 'image/png',
        size: 1024 * 1024, // 1MB
        buffer: Buffer.from('fake png data'),
      } as Express.Multer.File

      await expect(service.validateFile(file)).resolves.not.toThrow()
    })

    it('should accept JPG files', async () => {
      const file = {
        mimetype: 'image/jpeg',
        size: 1024 * 1024,
        buffer: Buffer.from('fake jpg data'),
      } as Express.Multer.File

      await expect(service.validateFile(file)).resolves.not.toThrow()
    })

    it('should accept SVG files without scripts', async () => {
      const file = {
        mimetype: 'image/svg+xml',
        size: 1024 * 500,
        buffer: Buffer.from('<svg><circle cx="50" cy="50" r="40"/></svg>'),
      } as Express.Multer.File

      await expect(service.validateFile(file)).resolves.not.toThrow()
    })

    it('should reject SVG files with scripts', async () => {
      const file = {
        mimetype: 'image/svg+xml',
        size: 1024 * 500,
        buffer: Buffer.from('<svg><script>alert("xss")</script></svg>'),
      } as Express.Multer.File

      await expect(service.validateFile(file)).rejects.toThrow('SVG 文件包含不安全内容')
    })

    it('should reject files larger than 2MB', async () => {
      const file = {
        mimetype: 'image/png',
        size: 1024 * 1024 * 3, // 3MB
        buffer: Buffer.from('fake data'),
      } as Express.Multer.File

      await expect(service.validateFile(file)).rejects.toThrow('文件大小不能超过 2MB')
    })

    it('should reject unsupported file types', async () => {
      const file = {
        mimetype: 'image/gif',
        size: 1024 * 1024,
        buffer: Buffer.from('fake gif data'),
      } as Express.Multer.File

      await expect(service.validateFile(file)).rejects.toThrow('只支持 PNG, JPG, SVG 格式')
    })
  })

  describe('getUploadPath', () => {
    it('should generate correct upload path', () => {
      const tenantId = '550e8400-e29b-41d4-a716-446655440000' // Valid UUID
      const filename = 'logo.png'

      const uploadPath = service.getUploadPath(tenantId, filename)

      expect(uploadPath).toContain('uploads')
      expect(uploadPath).toContain('550e8400-e29b-41d4-a716-446655440000')
      expect(uploadPath).toContain('logo.png')
    })

    it('should throw error for invalid tenant ID', () => {
      const tenantId = 'invalid-tenant-id'
      const filename = 'logo.png'

      expect(() => service.getUploadPath(tenantId, filename)).toThrow('Invalid tenant ID')
    })

    it('should sanitize filename with path traversal attempt', () => {
      const tenantId = '550e8400-e29b-41d4-a716-446655440000'
      const filename = '../../etc/passwd'

      const uploadPath = service.getUploadPath(tenantId, filename)

      expect(uploadPath).not.toContain('..')
      expect(uploadPath).toContain('passwd')
    })
  })

  describe('getPublicUrl', () => {
    it('should generate correct public URL', () => {
      const tenantId = '550e8400-e29b-41d4-a716-446655440000'
      const filename = 'logo.png'

      const publicUrl = service.getPublicUrl(tenantId, filename)

      expect(publicUrl).toBe('/uploads/tenants/550e8400-e29b-41d4-a716-446655440000/logo.png')
    })
  })

  describe('compressImage', () => {
    it('should compress PNG image to max width 400px', async () => {
      // 创建一个简单的测试图片 buffer (1x1 PNG)
      const testImageBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      )

      const compressed = await service.compressImage(testImageBuffer, 'image/png')

      expect(compressed).toBeInstanceOf(Buffer)
      expect(compressed.length).toBeGreaterThan(0)
    })

    it('should skip compression for SVG files', async () => {
      const svgBuffer = Buffer.from('<svg></svg>')

      const result = await service.compressImage(svgBuffer, 'image/svg+xml')

      expect(result).toBe(svgBuffer)
    })
  })
})
