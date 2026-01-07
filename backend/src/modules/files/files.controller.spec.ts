import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import * as request from 'supertest'
import { FilesModule } from './files.module'
import { FilesService } from './services/files.service'
import { MulterModule } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import * as fs from 'fs'
import * as path from 'path'

/**
 * FilesController E2E测试
 *
 * 测试完整的HTTP请求/响应流程
 * 注意：Mock FilesService以避免pdf-parse在Jest环境中的worker问题
 */

describe('FilesController (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        FilesModule,
        MulterModule.register({
          storage: memoryStorage(),
          limits: {
            fileSize: 10 * 1024 * 1024, // 10MB
          },
        }),
      ],
    })
      .overrideProvider(FilesService)
      .useValue({
        parsePdf: jest.fn().mockResolvedValue(
          'Sample PDF content for testing\nThis is extracted text from the PDF file.'
        ),
      })
      .compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe())
    await app.init()
  })

  afterAll(async () => {
    await app.close()
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
      const response = await request(app.getHttpServer())
        .post('/files/parse-pdf')
        .expect(400)

      // Assert
      expect(response.body).toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('请上传文件'),
      })
    })

    it('应该成功解析多页PDF', async () => {
      // Arrange
      const testPdfPath = path.join(__dirname, '../../../test-fixtures/multipage.pdf')
      const pdfBuffer = fs.readFileSync(testPdfPath)

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
})
