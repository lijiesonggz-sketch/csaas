import * as XLSX from 'xlsx'

/**
 * Excel 文件解析工具
 *
 * 用于解析监管执法 Excel 文件（如"证券.xlsx"）
 * 支持将 Excel 数据映射到 RawContent 实体字段
 */

export interface ExcelRowData {
  region?: string      // 列1: 地区（如"深圳"）
  type?: string       // 列2: 类型（如"行政监管措施"）
  id?: string         // 列3: ID（如"bm56000001/2025-00014441"）
  date?: string       // 列5: 日期（如"2025-12-12 18:08:31"）
  title?: string      // 列6: 标题
  docNumber?: string  // 列7: 文号
  content?: string   // 列9: 完整内容
  url?: string       // 列10: URL
}

export interface ParseResult {
  success: boolean
  rows: ExcelRowData[]
  error?: string
}

/**
 * ExcelParser 工具类
 */
export class ExcelParser {
  private static readonly MAX_ROWS = 10000  // 增加到 10000 行，支持大批量数据导入
  private static readonly MAX_FILE_SIZE_MB = 50  // 增加到 50MB

  /**
   * 解析监管执法 Excel 文件
   *
   * @param filePath - Excel 文件路径
   * @returns 解析结果
   */
  static parseComplianceExcel(filePath: string): ParseResult {
    try {
      // 1. 读取 Excel 文件
      const workbook = XLSX.readFile(filePath)

      // 2. 获取第一个工作表
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        return {
          success: false,
          rows: [],
          error: 'Excel 文件为空，没有工作表',
        }
      }

      const worksheet = workbook.Sheets[firstSheetName]

      // 3. 解析为 JSON 数组
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

      // 验证数据
      if (!Array.isArray(jsonData) || jsonData.length === 0) {
        return {
          success: false,
          rows: [],
          error: 'Excel 文件没有数据行',
        }
      }

      // 检查行数限制
      const actualRows = jsonData.length - 1 // 减去标题行
      if (actualRows > this.MAX_ROWS) {
        return {
          success: false,
          rows: [],
          error: `Excel 文件行数超过限制：实际 ${actualRows} 行，最多允许 ${this.MAX_ROWS} 行`,
        }
      }

      // 4. 提取数据行（跳过第一行标题）
      const rows: ExcelRowData[] = []

      // 从第二行开始遍历（跳过标题行）
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i]

        // 跳过空行
        if (!row || row.length === 0) {
          continue
        }

        // 根据列索引提取数据
        const excelRow: ExcelRowData = {
          region: this.getStringValue(row[0]),     // 列1: 地区
          type: this.getStringValue(row[1]),      // 列2: 类型
          id: this.getStringValue(row[2]),        // 列3: ID
          // 跳过列4（可能是空白或不需要）
          date: this.getStringValue(row[4]),      // 列5: 日期
          title: this.getStringValue(row[5]),     // 列6: 标题
          docNumber: this.getStringValue(row[6]),  // 列7: 文号
          // 跳过列8（可能是空白或不需要）
          content: this.getStringValue(row[8]),    // 列9: 完整内容
          url: this.getStringValue(row[9]),       // 列10: URL
        }

        // 验证必填字段
        if (!excelRow.title || !excelRow.content) {
          continue // 跳过无效行
        }

        rows.push(excelRow)
      }

      if (rows.length === 0) {
        return {
          success: false,
          rows: [],
          error: 'Excel 文件没有有效的数据行',
        }
      }

      return {
        success: true,
        rows,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        rows: [],
        error: `解析 Excel 文件失败: ${errorMessage}`,
      }
    }
  }

  /**
   * 从单元格值获取字符串
   * 处理各种可能的单元格类型（字符串、数字、日期等）
   */
  private static getStringValue(value: any): string | undefined {
    if (value === null || value === undefined) {
      return undefined
    }

    // 如果是数字（可能是 Excel 日期序列号）
    if (typeof value === 'number') {
      // 检查是否是 Excel 日期序列号
      if (value > 20000 && value < 60000) {
        // 转换为日期
        const date = XLSX.SSF.parse_date_code(value)
        if (date) {
          const year = date.y
          const month = String(date.m).padStart(2, '0')
          const day = String(date.d).padStart(2, '0')
          const hours = String(date.H || 0).padStart(2, '0')
          const minutes = String(date.M || 0).padStart(2, '0')
          const seconds = String(date.S || 0).padStart(2, '0')
          return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
        }
      }
      // 普通数字直接转为字符串
      return String(value)
    }

    // 如果是日期对象
    if (value instanceof Date) {
      return value.toISOString()
    }

    // 字符串类型
    return String(value).trim() || undefined
  }

  /**
   * 从文号中提取机构名称
   *
   * 示例：
   * - "证监决定[2025]1号" → "证监会"
   * - "深证监处罚[2025]1号" → "深圳证监局"
   *
   * @param docNumber - 文号
   * @returns 机构名称
   */
  static extractInstitutionFromDocNumber(docNumber?: string): string | undefined {
    if (!docNumber) {
      return undefined
    }

    // 常见机构映射（按长度降序排列，先匹配更具体的前缀）
    const institutionMap: { [key: string]: string } = {
      '渝证监': '重庆证监局',
      '川证监': '四川证监局',
      '苏证监': '江苏证监局',
      '浙证监': '浙江证监局',
      '粤证监': '广东证监局',
      '京证监': '北京证监局',
      '上证监': '上海证监局',
      '深证监': '深圳证监局',
      '证监': '证监会',
    }

    // 查找匹配的机构简称
    for (const [prefix, fullName] of Object.entries(institutionMap)) {
      if (docNumber.includes(prefix)) {
        return fullName
      }
    }

    // 如果没有匹配，返回默认值
    return '证监会'
  }
}
