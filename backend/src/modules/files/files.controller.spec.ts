import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import * as request from 'supertest'
import { getRepositoryToken } from '@nestjs/typeorm'
import { FilesService } from './services/files.service'
import { FilesController } from './controllers/files.controller'
import { MulterModule } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import * as fs from 'fs'
import * as path from 'path'
import { StandardDocument } from '@/database/entities/standard-document.entity'
import { Project } from '@/database/entities/project.entity'
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard'

/**
 * FilesController E2E测试
 *
 * 测试完整的HTTP请求/响应流程
 * 注意：Mock FilesService以避免pdf-parse在Jest环境中的worker问题
 */

describe('FilesController (e2e)', () => {
  let app: INestApplication
  let standardDocumentRepo: {
    create: jest.Mock
    save: jest.Mock
    find: jest.Mock
  }
  let projectRepo: {
    findOne: jest.Mock
    save: jest.Mock
  }

  beforeAll(async () => {
    standardDocumentRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    }
    projectRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      imports: [
        MulterModule.register({
          storage: memoryStorage(),
          limits: {
            fileSize: 10 * 1024 * 1024, // 10MB
          },
        }),
      ],
      providers: [
        {
          provide: FilesService,
          useValue: {
            parsePdf: jest
              .fn()
              .mockResolvedValue(
                'Sample PDF content for testing\nThis is extracted text from the PDF file.',
              ),
          },
        },
        {
          provide: getRepositoryToken(StandardDocument),
          useValue: standardDocumentRepo,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: projectRepo,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe())
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    standardDocumentRepo.find.mockResolvedValue([])
    projectRepo.findOne.mockResolvedValue(null)
  })

  describe('POST /files/parse-pdf', () => {
    it('应该成功解析PDF文件并返回文本', async () => {
      // Arrange
      const testPdfPath = path.join(__dirname, '../../../test-fixtures/sample.pdf')
      const pdfBuffer = fs.readFileSync(testPdfPath)

      // Act
      const response = await request(app.getHttpServer())
        .post('/files/parse-pdf')
        .attach('file', testPdfPath, 'sample.pdf')
        .expect(201)

      // Assert
      expect(response.body).toMatchObject({
        success: true,
        data: {
          filename: 'sample.pdf',
          text: 'Sample PDF content for testing\nThis is extracted text from the PDF file.',
          size: pdfBuffer.length,
        },
      })
    })

    it('应该拒绝非PDF文件', async () => {
      // Arrange - 创建一个文本文件
      const textBuffer = Buffer.from('This is not a PDF')

      // Act
      const response = await request(app.getHttpServer())
        .post('/files/parse-pdf')
        .attach('file', textBuffer, { filename: 'test.txt', contentType: 'text/plain' })
        .expect(400)

      // Assert
      expect(response.body).toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('只支持PDF文件'),
      })
    })

    it('应该拒绝超过10MB的文件', async () => {
      // Arrange - 创建一个超大buffer
      const hugeBuffer = Buffer.alloc(11 * 1024 * 1024) // 11MB

      // Act
      const response = await request(app.getHttpServer())
        .post('/files/parse-pdf')
        .attach('file', hugeBuffer, { filename: 'huge.pdf', contentType: 'application/pdf' })
        .expect(413) // Express返回413 Payload Too Large

      // Assert
      expect(response.status).toBe(413)
    })

    it('应该拒绝没有上传文件的请求', async () => {
      // Act
      const response = await request(app.getHttpServer()).post('/files/parse-pdf').expect(400)

      // Assert
      expect(response.body).toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('请上传文件'),
      })
    })

    it('应该成功解析多页PDF', async () => {
      // Arrange
      const testPdfPath = path.join(__dirname, '../../../test-fixtures/multipage.pdf')

      // Act
      const response = await request(app.getHttpServer())
        .post('/files/parse-pdf')
        .attach('file', testPdfPath, 'multipage.pdf')
        .expect(201)

      // Assert
      expect(response.body.success).toBe(true)
      expect(response.body.data.filename).toBe('multipage.pdf')
      expect(response.body.data.text).toContain('Sample PDF content')
    })
  })

  describe('GET /files/projects/:projectId/documents/list', () => {
    it('应该从项目 metadata 兼容返回历史上传文档', async () => {
      standardDocumentRepo.find.mockResolvedValue([])
      projectRepo.findOne.mockResolvedValue({
        id: 'project-1',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        metadata: {
          uploadedDocuments: [
            {
              id: 'doc_legacy-1',
              name: '银行保险机构数据安全管理办法',
              content: '银行保险机构数据安全管理办法正文',
              uploadedAt: '2026-06-01T08:00:00.000Z',
            },
          ],
        },
      })

      const response = await request(app.getHttpServer())
        .get('/files/projects/project-1/documents/list')
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        data: [
          {
            id: 'doc_legacy-1',
            name: '银行保险机构数据安全管理办法',
            filename: '银行保险机构数据安全管理办法',
            charCount: 16,
            metadata: {
              legacySource: 'projects.metadata.uploadedDocuments',
            },
          },
        ],
      })
    })

    it('应该为标准文档列表补齐文件名和大小字段', async () => {
      standardDocumentRepo.find.mockResolvedValue([
        {
          id: 'doc-1',
          name: 'ISO 27001',
          content: 'standard content',
          createdAt: new Date('2026-06-01T08:00:00.000Z'),
          metadata: {
            original_filename: 'iso27001.pdf',
            size: 1024,
          },
        },
      ])
      projectRepo.findOne.mockResolvedValue({
        id: 'project-1',
        metadata: {
          uploadedDocuments: [],
        },
      })

      const response = await request(app.getHttpServer())
        .get('/files/projects/project-1/documents/list')
        .expect(200)

      expect(response.body.data).toEqual([
        expect.objectContaining({
          id: 'doc-1',
          name: 'ISO 27001',
          filename: 'iso27001.pdf',
          size: 1024,
          charCount: 16,
        }),
      ])
    })
  })

  describe('POST /files/projects/:projectId/documents/list', () => {
    it('应该兼容前端当前的 POST 文档列表请求', async () => {
      standardDocumentRepo.find.mockResolvedValue([
        {
          id: 'doc-1',
          name: 'GB/T 33136',
          content: 'standard content',
          createdAt: new Date('2026-06-02T06:13:44.796Z'),
          metadata: {
            original_filename: 'GBT+33136-2024.pdf',
            size: 8186606,
          },
        },
      ])
      projectRepo.findOne.mockResolvedValue({
        id: 'project-1',
        metadata: {
          uploadedDocuments: [],
        },
      })

      const response = await request(app.getHttpServer())
        .post('/files/projects/project-1/documents/list')
        .expect(200)

      expect(response.body.data).toEqual([
        expect.objectContaining({
          id: 'doc-1',
          name: 'GB/T 33136',
          filename: 'GBT+33136-2024.pdf',
          size: 8186606,
          charCount: 16,
        }),
      ])
    })
  })
})
