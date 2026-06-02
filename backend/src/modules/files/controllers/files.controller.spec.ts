import { FilesController } from './files.controller'

describe('FilesController', () => {
  const projectId = '0c34c901-82f1-42df-87a2-1aaac9da24a0'

  let filesService: {
    parsePdf: jest.Mock
    parseDocx: jest.Mock
    sanitizeTextForDatabase: jest.Mock
  }
  let standardDocumentRepo: {
    create: jest.Mock
    save: jest.Mock
    find: jest.Mock
    findOne: jest.Mock
    remove: jest.Mock
  }
  let projectRepo: {
    findOne: jest.Mock
    save: jest.Mock
  }
  let controller: FilesController

  beforeEach(() => {
    filesService = {
      parsePdf: jest.fn(),
      parseDocx: jest.fn(),
      sanitizeTextForDatabase: jest.fn((value: string) =>
        value.replace(/\x00/g, '').replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ''),
      ),
    }

    standardDocumentRepo = {
      create: jest.fn((input) => ({
        id: 'doc-1',
        createdAt: new Date('2026-06-02T08:30:00.000Z'),
        ...input,
      })),
      save: jest.fn(async (doc) => doc),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    }

    projectRepo = {
      findOne: jest.fn(async () => ({ id: projectId, metadata: {} })),
      save: jest.fn(async (project) => project),
    }

    controller = new FilesController(
      filesService as never,
      standardDocumentRepo as never,
      projectRepo as never,
    )
  })

  it.each([
    {
      name: 'PDF',
      mimetype: 'application/pdf',
      filename: 'nul-byte.pdf',
      parser: 'parsePdf' as const,
    },
    {
      name: 'DOCX',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      filename: 'nul-byte.docx',
      parser: 'parseDocx' as const,
    },
  ])(
    'removes null bytes from parsed $name content before saving to PostgreSQL text/jsonb fields',
    async ({ mimetype, filename, parser }) => {
      filesService[parser].mockResolvedValue('文档\u0000内容\u0001保留\n换行\r回车\t制表')

      await controller.uploadProjectDocument(projectId, {
        buffer: Buffer.from('file-content'),
        mimetype,
        originalname: filename,
        size: 12,
      } as Express.Multer.File)

      const savedDocument = standardDocumentRepo.save.mock.calls[0][0]
      expect(savedDocument.content).toBe('文档内容保留\n换行\r回车\t制表')
      expect(savedDocument.content).not.toContain('\u0000')

      const savedProject = projectRepo.save.mock.calls[0][0]
      expect(savedProject.metadata.uploadedDocuments[0].content).toBe(savedDocument.content)
      expect(savedProject.metadata.uploadedDocuments[0].content).not.toContain('\u0000')
    },
  )

  it('returns persisted document content in project document lists for downstream coverage recalculation', async () => {
    standardDocumentRepo.find.mockResolvedValue([
      {
        id: 'doc-1',
        name: 'AIMM.pdf',
        content: '5.1.2 过程描述\na) 利益相关者分析',
        createdAt: new Date('2026-06-02T08:30:00.000Z'),
        metadata: {
          original_filename: 'AIMM.pdf',
          size: 128,
        },
      },
    ])
    projectRepo.findOne.mockResolvedValue({ id: projectId, metadata: {} })

    const result = await controller.getProjectDocuments(projectId)

    expect(result.data[0]).toMatchObject({
      id: 'doc-1',
      name: 'AIMM.pdf',
      filename: 'AIMM.pdf',
      charCount: expect.any(Number),
      content: '5.1.2 过程描述\na) 利益相关者分析',
    })
  })
})
