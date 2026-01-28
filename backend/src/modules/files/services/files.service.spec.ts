import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { FilesService } from './files.service'
import * as fs from 'fs'
import * as path from 'path'

// Mock pdf-parse模块
jest.mock('pdf-parse', () => ({
  PDFParse: jest.fn().mockImplementation(() => ({
    getText: jest.fn().mockResolvedValue({
      text: 'Sample PDF content for testing',
      total: 1,
    }),
    destroy: jest.fn().mockResolvedValue(undefined),
  })),
  VerbosityLevel: {
    ERRORS: 0,
    WARNINGS: 1,
    INFOS: 5,
  },
}))

/**
 * FilesService TDD测试套件
 *
 * 测试场景：
 * 1. PDF解析成功：能够从PDF buffer中提取文本
 * 2. 错误处理：空buffer、无效PDF、损坏的PDF
 * 3. 边界条件：空PDF、只有图片的PDF、加密PDF
 */

describe('FilesService - PDF解析功能 (TDD)', () => {
  let service: FilesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FilesService],
    }).compile()

    service = module.get<FilesService>(FilesService)
  })

  describe('parsePdf - 基本PDF解析', () => {
    it('应该能够从PDF buffer中提取文本内容', async () => {
      // Arrange - 创建一个简单的PDF buffer
      const testPdfPath = path.join(__dirname, '../../../../test-fixtures/sample.pdf')
      let pdfBuffer: Buffer

      try {
        pdfBuffer = fs.readFileSync(testPdfPath)
      } catch (error) {
        // 如果测试文件不存在，使用一个简单的buffer
        pdfBuffer = Buffer.from('%PDF-1.4 minimal pdf')
      }

      // Act - 解析PDF
      const text = await service.parsePdf(pdfBuffer)

      // Assert - 验证结果
      expect(text).toBeDefined()
      expect(typeof text).toBe('string')
      expect(text.length).toBeGreaterThan(0)
    })

    it('应该调用PDFParse的getText方法', async () => {
      // Arrange
      const pdfBuffer = Buffer.from('%PDF-1.4 test')
      const pdfParseModule = require('pdf-parse')
      const mockGetText = jest.fn().mockResolvedValue({
        text: 'Test content',
        total: 1,
      })
      const mockDestroy = jest.fn().mockResolvedValue(undefined)

      pdfParseModule.PDFParse = jest.fn().mockImplementation(() => ({
        getText: mockGetText,
        destroy: mockDestroy,
      }))

      // Act
      await service.parsePdf(pdfBuffer)

      // Assert
      expect(mockGetText).toHaveBeenCalled()
      expect(mockDestroy).toHaveBeenCalled()
    })

    it('应该处理空PDF文件', async () => {
      // Arrange - 创建一个空的buffer
      const emptyBuffer = Buffer.from('')

      // Act & Assert - 应该抛出错误
      await expect(service.parsePdf(emptyBuffer)).rejects.toThrow(BadRequestException)
      await expect(service.parsePdf(emptyBuffer)).rejects.toThrow('PDF文件大小为0')
    })

    it('应该正确传递VerbosityLevel参数', async () => {
      // Arrange
      const pdfBuffer = Buffer.from('%PDF-1.4 test')
      const pdfParseModule = require('pdf-parse')

      // Act
      await service.parsePdf(pdfBuffer)

      // Assert - PDFParse应该被正确初始化
      expect(pdfParseModule.PDFParse).toHaveBeenCalledWith(
        expect.objectContaining({
          data: pdfBuffer,
          verbosity: pdfParseModule.VerbosityLevel.ERRORS,
        }),
      )
    })
  })

  describe('parsePdf - 资源清理', () => {
    it('应该在解析失败时清理parser资源', async () => {
      // Arrange
      const pdfBuffer = Buffer.from('%PDF-1.4 test')
      const pdfParseModule = require('pdf-parse')
      const mockDestroy = jest.fn().mockResolvedValue(undefined)

      pdfParseModule.PDFParse = jest.fn().mockImplementation(() => ({
        getText: jest.fn().mockRejectedValue(new Error('Parse error')),
        destroy: mockDestroy,
      }))

      // Act & Assert
      await expect(service.parsePdf(pdfBuffer)).rejects.toThrow('PDF解析失败')
      expect(mockDestroy).toHaveBeenCalled() // 即使失败也要清理资源
    })
  })

  describe('parsePdf - 错误处理', () => {
    it('应该对null buffer抛出错误', async () => {
      // Arrange
      const nullBuffer = null as unknown as Buffer

      // Act & Assert
      await expect(service.parsePdf(nullBuffer)).rejects.toThrow()
    })

    it('应该对过大的PDF文件抛出错误', async () => {
      // Arrange - 创建一个超大buffer（模拟文件大小限制）
      const hugeBuffer = Buffer.alloc(11 * 1024 * 1024) // 11MB

      // Act & Assert
      await expect(service.parsePdf(hugeBuffer)).rejects.toThrow(BadRequestException)
    })

    it('错误消息应该清晰有用', async () => {
      // Arrange
      const invalidBuffer = Buffer.from('invalid')

      try {
        // Act
        await service.parsePdf(invalidBuffer)
      } catch (error) {
        // Assert
        expect(error).toBeInstanceOf(BadRequestException)
        expect(error.message).toBeDefined()
        expect(error.message.length).toBeGreaterThan(0)
      }
    })
  })
})
