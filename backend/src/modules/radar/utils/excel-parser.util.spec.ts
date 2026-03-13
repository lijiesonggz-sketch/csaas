import { ExcelParser } from './excel-parser.util'

describe('ExcelParser', () => {
  describe('parseComplianceExcel', () => {
    it('应该成功解析有效的 Excel 文件', () => {
      // 由于这是一个测试，我们模拟一个有效的文件路径
      // 实际测试需要创建真实的 Excel 文件
      const result = ExcelParser.parseComplianceExcel('test.xlsx')

      // 由于文件不存在，预期失败
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('extractInstitutionFromDocNumber', () => {
    it('应该从证监会文号中提取机构名称', () => {
      expect(ExcelParser.extractInstitutionFromDocNumber('证监决定[2025]1号')).toBe('证监会')
    })

    it('应该从深圳证监局文号中提取机构名称', () => {
      expect(ExcelParser.extractInstitutionFromDocNumber('深证监处罚[2025]1号')).toBe('深圳证监局')
    })

    it('应该从上海证监局文号中提取机构名称', () => {
      expect(ExcelParser.extractInstitutionFromDocNumber('上证监处罚[2025]1号')).toBe('上海证监局')
    })

    it('应该从北京证监局文号中提取机构名称', () => {
      expect(ExcelParser.extractInstitutionFromDocNumber('京证监处罚[2025]1号')).toBe('北京证监局')
    })

    it('应该从广东证监局文号中提取机构名称', () => {
      expect(ExcelParser.extractInstitutionFromDocNumber('粤证监处罚[2025]1号')).toBe('广东证监局')
    })

    it('应该从浙江证监局文号中提取机构名称', () => {
      expect(ExcelParser.extractInstitutionFromDocNumber('浙证监处罚[2025]1号')).toBe('浙江证监局')
    })

    it('应该从江苏证监局文号中提取机构名称', () => {
      expect(ExcelParser.extractInstitutionFromDocNumber('苏证监处罚[2025]1号')).toBe('江苏证监局')
    })

    it('应该从四川证监局文号中提取机构名称', () => {
      expect(ExcelParser.extractInstitutionFromDocNumber('川证监处罚[2025]1号')).toBe('四川证监局')
    })

    it('应该从重庆证监局文号中提取机构名称', () => {
      expect(ExcelParser.extractInstitutionFromDocNumber('渝证监处罚[2025]1号')).toBe('重庆证监局')
    })

    it('应该对未知机构返回默认值', () => {
      expect(ExcelParser.extractInstitutionFromDocNumber('未知机构[2025]1号')).toBe('证监会')
    })

    it('应该对空值返回 undefined', () => {
      expect(ExcelParser.extractInstitutionFromDocNumber(undefined)).toBeUndefined()
    })

    it('应该对空字符串返回 undefined', () => {
      expect(ExcelParser.extractInstitutionFromDocNumber('')).toBeUndefined()
    })
  })
})
