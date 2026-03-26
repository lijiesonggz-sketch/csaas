import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import * as XLSX from 'xlsx'
import { RawContent } from '../../../database/entities/raw-content.entity'
import { ComplianceCaseService } from '../../knowledge-graph/services/compliance-case.service'
import { CaseImportService } from './case-import.service'

jest.mock('xlsx', () => ({
  readFile: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
  },
  SSF: {
    parse_date_code: jest.fn(),
  },
}))

describe('CaseImportService', () => {
  let service: CaseImportService

  const complianceCaseService = {
    createCase: jest.fn(),
  }

  const rawContentRepository = {
    findOne: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseImportService,
        {
          provide: ComplianceCaseService,
          useValue: complianceCaseService,
        },
        {
          provide: getRepositoryToken(RawContent),
          useValue: rawContentRepository,
        },
      ],
    }).compile()

    service = module.get(CaseImportService)
    jest.clearAllMocks()
    ;(XLSX.readFile as jest.Mock).mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: {
        Sheet1: {},
      },
    })
  })

  it('should normalize multiple source header variants into compliance cases', async () => {
    ;(XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue([
      {
        案件编号: '银罚字2026第1号',
        处罚对象: '示例银行',
        处罚事宜: '客户身份识别不到位',
        处罚原因: '违反反洗钱管理要求',
        处罚日期: '2026-03-01',
        原文链接: 'https://example.com/case-1',
      },
      {
        case_number: 'CASE-002',
        penalized_entity: '示例保险',
        violation_summary: '数据报送迟报',
        violation_reason: '内部控制失效',
        penalty_date: '2026/3/2',
        raw_content_id: '11111111-1111-4111-8111-111111111111',
      },
      {
        行政处罚决定书文号: 'CASE-003',
        被处罚机构: '示例券商',
        主要违法违规事实: '日志留痕缺失',
        处罚依据: '网络安全管理不到位',
        决定日期: '45200',
      },
    ])
    rawContentRepository.findOne.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
    })
    ;(XLSX.SSF.parse_date_code as jest.Mock).mockReturnValue({
      y: 2023,
      m: 10,
      d: 1,
    })

    const result = await service.importCases({
      filePath: 'D:/imports/cases.xlsx',
      regulatorCode: 'pboc',
    })

    expect(result.importedCount).toBe(3)
    expect(result.failedCount).toBe(0)
    expect(rawContentRepository.findOne).toHaveBeenCalledWith({
      where: { url: 'https://example.com/case-1' },
    })
    expect(complianceCaseService.createCase).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        caseCode: 'PBOC-2026-1',
        regulatorCode: 'PBOC',
        sourceOrg: '示例银行',
        caseFacts: '客户身份识别不到位',
        penaltyReason: '违反反洗钱管理要求',
        rawContentId: '22222222-2222-4222-8222-222222222222',
        status: 'pending',
      }),
    )
    expect(complianceCaseService.createCase).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        caseCode: 'PBOC-CASE-002',
        rawContentId: '11111111-1111-4111-8111-111111111111',
        caseDate: '2026-03-02',
      }),
    )
    expect(complianceCaseService.createCase).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        caseCode: 'PBOC-CASE-003',
        caseDate: '2023-10-01',
      }),
    )
  })

  it('should continue importing when a row fails validation or persistence', async () => {
    ;(XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue([
      {
        case_number: 'CASE-001',
        violation_summary: '有效记录',
      },
      {
        case_number: 'CASE-002',
      },
      {
        case_number: 'CASE-003',
        violation_summary: '重复案例',
      },
    ])
    complianceCaseService.createCase
      .mockResolvedValueOnce({
        caseId: 'case-1',
      })
      .mockRejectedValueOnce(new Error('case_code PBOC-CASE-003 already exists'))

    const result = await service.importCases({
      filePath: 'D:/imports/cases.xlsx',
      regulatorCode: 'PBOC',
    })

    expect(result.totalRows).toBe(3)
    expect(result.importedCount).toBe(1)
    expect(result.failedCount).toBe(2)
    expect(result.failures).toEqual([
      {
        rowNumber: 3,
        caseNumber: 'CASE-002',
        message: 'Row 3: violation summary or penalty reason is required',
      },
      {
        rowNumber: 4,
        caseNumber: 'CASE-003',
        message: 'case_code PBOC-CASE-003 already exists',
      },
    ])
    expect(complianceCaseService.createCase).toHaveBeenCalledTimes(2)
  })

  it('should fail a row when raw_content_id is not a uuid', async () => {
    ;(XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue([
      {
        case_number: 'CASE-001',
        violation_summary: '有效记录',
        raw_content_id: 'not-a-uuid',
      },
    ])

    const result = await service.importCases({
      filePath: 'D:/imports/cases.xlsx',
      regulatorCode: 'NFRA',
    })

    expect(result.importedCount).toBe(0)
    expect(result.failedCount).toBe(1)
    expect(result.failures[0]).toEqual({
      rowNumber: 2,
      caseNumber: 'CASE-001',
      message: 'Row 2: raw_content_id must be a valid UUID',
    })
    expect(complianceCaseService.createCase).not.toHaveBeenCalled()
  })
})
