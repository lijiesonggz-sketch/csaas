import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import * as chokidar from 'chokidar'
import * as matter from 'gray-matter'
import * as fs from 'fs/promises'
import * as path from 'path'
import { RawContentService } from './raw-content.service'
import { VALID_CONTENT_TYPES, MAX_PEER_NAME_LENGTH, EXCEL_IMPORT_MAX_SIZE_MB } from '../constants/content.constants'
import { ExcelParser, ExcelRowData } from '../utils/excel-parser.util'

/**
 * FileWatcherService
 *
 * 监控文件导入目录，自动处理新文件
 *
 * Story 2.1: 爬虫和文件导入机制
 */
@Injectable()
export class FileWatcherService implements OnModuleDestroy {
  private readonly logger = new Logger(FileWatcherService.name)
  private watcher: chokidar.FSWatcher | null = null

  constructor(
    private readonly rawContentService: RawContentService,
    @InjectQueue('radar-ai-analysis')
    private readonly aiAnalysisQueue: Queue,
  ) {}

  /**
   * 启动文件监控
   */
  async startWatching(): Promise<void> {
    const watchPaths = [
      path.join(process.cwd(), 'data-import', 'website-crawl'),
      path.join(process.cwd(), 'data-import', 'wechat-articles'),
    ]

    this.logger.log(`Starting file watcher for: ${watchPaths.join(', ')}`)

    this.watcher = chokidar.watch(watchPaths, {
      ignored: /processed|failed/,
      persistent: true,
      ignoreInitial: true, // 只监控新文件，不处理已存在的文件
    })

    this.watcher.on('add', async (filePath: string) => {
      const ext = path.extname(filePath).toLowerCase()
      if (['.md', '.txt', '.xlsx', '.xls'].includes(ext)) {
        this.logger.log(`New file detected: ${filePath}`)
        await this.processFile(filePath)
      }
    })

    this.logger.log('File watcher started successfully')
  }

  /**
   * 停止文件监控
   */
  async stopWatching(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.logger.log('File watcher stopped')
    }
  }

  /**
   * 处理文件
   */
  async processFile(filePath: string): Promise<void> {
    try {
      // 验证文件大小（最大50MB）
      const stats = await fs.stat(filePath)
      const fileSizeMB = stats.size / (1024 * 1024)
      if (fileSizeMB > EXCEL_IMPORT_MAX_SIZE_MB) {
        throw new Error(`File size ${fileSizeMB.toFixed(2)}MB exceeds ${EXCEL_IMPORT_MAX_SIZE_MB}MB limit`)
      }

      // 根据文件扩展名选择处理方式
      const ext = path.extname(filePath).toLowerCase()

      if (ext === '.xlsx' || ext === '.xls') {
        await this.processExcelFile(filePath)
      } else if (ext === '.md' || ext === '.txt') {
        await this.processMarkdownFile(filePath)
      } else {
        throw new Error(`Unsupported file type: ${ext}`)
      }
    } catch (error) {
      this.logger.error(`Failed to process file ${filePath}:`, error.stack)

      // 移动失败的文件到failed文件夹
      await this.moveToFailed(filePath, error.message)
    }
  }

  /**
   * 处理 Excel 文件（支持 .xlsx 和 .xls）
   */
  private async processExcelFile(filePath: string): Promise<void> {
    this.logger.log(`Processing Excel file: ${filePath}`)

    // 解析 Excel 文件
    const parseResult = ExcelParser.parseComplianceExcel(filePath)

    if (!parseResult.success) {
      throw new Error(parseResult.error || 'Failed to parse Excel file')
    }

    this.logger.log(`Parsed ${parseResult.rows.length} rows from Excel file`)

    // 处理每一行数据
    let processedCount = 0
    for (const row of parseResult.rows) {
      try {
        await this.processExcelRow(row)
        processedCount++
      } catch (rowError) {
        this.logger.error(`Failed to process Excel row: ${row.title}`, rowError.stack)
        // 继续处理下一行
      }
    }

    this.logger.log(`Processed ${processedCount}/${parseResult.rows.length} rows from Excel file`)

    // 移动到processed文件夹
    await this.moveToProcessed(filePath)
  }

  /**
   * 处理 Excel 单行数据
   */
  private async processExcelRow(row: ExcelRowData): Promise<void> {
    // 1. 构建合规雷达数据
    const penaltyDate = row.date ? new Date(row.date) : undefined
    const publishDate = penaltyDate

    // 根据地区获取机构名称（优先使用地区字段）
    const penaltyInstitution = this.getInstitutionFromRegion(row.region)

    const complianceData = {
      type: 'penalty' as const,
      penaltyInstitution,
      penaltyDate,
      policyBasis: row.type, // 类型作为政策依据（如"行政监管措施"）
    }

    // 2. 创建 RawContent 记录
    const source = `${row.region || '证监会'}${row.type || '监管措施'}`
    const summary = row.title ? row.title.substring(0, 200) : null

    const rawContent = await this.rawContentService.create({
      source,
      category: 'compliance',
      title: row.title || 'Untitled',
      summary,
      fullContent: row.content || '',
      url: row.url || null,
      publishDate,
      author: null, // Excel 文件不包含作者信息
      organizationId: null, // 公共内容
      complianceData,
    })

    this.logger.log(`Created RawContent from Excel row: ${rawContent.id} - ${row.title}`)

    // 3. 触发 AI 分析任务
    await this.aiAnalysisQueue.add('analyze-content', {
      contentId: rawContent.id,
    })

    this.logger.log(`AI analysis task queued for content: ${rawContent.id}`)
  }

  /**
   * 根据地区字段获取机构名称
   */
  private getInstitutionFromRegion(region?: string): string {
    if (!region) {
      return '证监会'
    }

    // 地区到机构的映射
    const regionMap: { [key: string]: string } = {
      '深圳': '深圳证监局',
      '上海': '上海证监局',
      '北京': '北京证监局',
      '广东': '广东证监局',
      '浙江': '浙江证监局',
      '江苏': '江苏证监局',
      '四川': '四川证监局',
      '重庆': '重庆证监局',
    }

    return regionMap[region] || '证监会'
  }

  /**
   * 处理 Markdown/TXT 文件（原有逻辑）
   */
  private async processMarkdownFile(filePath: string): Promise<void> {
    // 读取文件内容
    const content = await fs.readFile(filePath, 'utf-8')

    // 解析frontmatter
    const { data: frontmatter, content: body } = matter(content)

    // 验证必填字段
    if (!frontmatter.source || !frontmatter.category) {
      throw new Error('Missing required frontmatter fields: source, category')
    }

    // 验证内容质量（最小100字符）
    if (body.trim().length < 100) {
      throw new Error('Content too short (minimum 100 characters required)')
    }

    // 提取标题
    const title = this.extractTitle(body)

    // 验证 contentType (Story 3.1)
    const contentType =
      frontmatter.contentType && VALID_CONTENT_TYPES.includes(frontmatter.contentType)
        ? frontmatter.contentType
        : null

    // 验证 peerName 长度 (Story 3.1)
    const peerName = frontmatter.peerName
      ? String(frontmatter.peerName).substring(0, MAX_PEER_NAME_LENGTH)
      : null

    // Story 4.1: 提取合规雷达数据
    let complianceData = null
    if (frontmatter.category === 'compliance') {
      complianceData = this.extractComplianceData(body, frontmatter)
    }

    // 保存到RawContent表
    const rawContent = await this.rawContentService.create({
      source: frontmatter.source,
      category: frontmatter.category,
      url: frontmatter.url || null,
      title,
      summary: frontmatter.summary || null,
      fullContent: body,
      publishDate: frontmatter.publishDate ? new Date(frontmatter.publishDate) : null,
      author: frontmatter.author || null,
      organizationId: null, // 公共内容
      // Story 3.1: 支持行业雷达字段
      contentType,
      peerName,
      // Story 4.1: 支持合规雷达字段
      complianceData,
    })

    this.logger.log(`File processed successfully: ${filePath}`)

    // 触发AI分析任务
    await this.aiAnalysisQueue.add('analyze-content', {
      contentId: rawContent.id,
    })

    this.logger.log(`AI analysis task queued for content: ${rawContent.id}`)

    // 移动到processed文件夹
    await this.moveToProcessed(filePath)
  }

  /**
   * 移动文件到processed文件夹
   */
  private async moveToProcessed(filePath: string): Promise<void> {
    const dir = path.dirname(filePath)
    const filename = path.basename(filePath)
    const processedDir = path.join(dir, 'processed')

    await fs.mkdir(processedDir, { recursive: true })
    await fs.rename(filePath, path.join(processedDir, filename))

    this.logger.log(`File moved to processed: ${filename}`)
  }

  /**
   * 移动文件到failed文件夹
   */
  private async moveToFailed(filePath: string, errorMessage: string): Promise<void> {
    try {
      const dir = path.dirname(filePath)
      const filename = path.basename(filePath)
      const failedDir = path.join(dir, 'failed')

      await fs.mkdir(failedDir, { recursive: true })

      // 创建错误日志文件
      const errorLogPath = path.join(failedDir, `${filename}.error.txt`)
      await fs.writeFile(
        errorLogPath,
        `Error: ${errorMessage}\nTimestamp: ${new Date().toISOString()}`,
      )

      // 移动原文件
      await fs.rename(filePath, path.join(failedDir, filename))

      this.logger.warn(`File moved to failed: ${filename}`)
    } catch (moveError) {
      this.logger.error(`Failed to move file to failed folder: ${filePath}`, moveError.stack)
    }
  }

  /**
   * 从markdown内容提取标题
   */
  extractTitle(content: string): string {
    const lines = content.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('# ')) {
        return trimmed.substring(2).trim()
      }
    }
    return 'Untitled'
  }

  /**
   * 提取合规雷达数据（Story 4.1）
   *
   * 从frontmatter和正文内容中提取合规雷达特定字段
   */
  private extractComplianceData(
    fullContent: string,
    frontmatter: any,
  ): {
    type: 'penalty' | 'policy_draft'
    penaltyInstitution?: string
    penaltyReason?: string
    penaltyAmount?: string
    penaltyDate?: Date
    policyBasis?: string
    policyTitle?: string
    commentDeadline?: Date
    mainRequirements?: string
    expectedImplementationDate?: Date
  } {
    // 验证type字段
    if (!frontmatter.type || !['penalty', 'policy_draft'].includes(frontmatter.type)) {
      throw new Error('Invalid type for compliance radar: must be "penalty" or "policy_draft"')
    }

    const data: any = {
      type: frontmatter.type,
    }

    // 从frontmatter提取字段（如果有）
    if (frontmatter.penaltyInstitution) {
      data.penaltyInstitution = frontmatter.penaltyInstitution
    }
    if (frontmatter.penaltyReason) {
      data.penaltyReason = frontmatter.penaltyReason
    }
    if (frontmatter.penaltyAmount) {
      data.penaltyAmount = frontmatter.penaltyAmount
    }
    if (frontmatter.penaltyDate) {
      data.penaltyDate = new Date(frontmatter.penaltyDate)
    }
    if (frontmatter.policyBasis) {
      data.policyBasis = frontmatter.policyBasis
    }
    if (frontmatter.policyTitle) {
      data.policyTitle = frontmatter.policyTitle
    }
    if (frontmatter.commentDeadline) {
      data.commentDeadline = new Date(frontmatter.commentDeadline)
    }
    if (frontmatter.mainRequirements) {
      data.mainRequirements = frontmatter.mainRequirements
    }
    if (frontmatter.expectedImplementationDate) {
      data.expectedImplementationDate = new Date(frontmatter.expectedImplementationDate)
    }

    // 从正文内容提取（使用正则表达式）
    if (frontmatter.type === 'penalty') {
      // 提取处罚相关字段
      if (!data.penaltyInstitution) {
        const penaltyInstitutionMatch = fullContent.match(/被处罚机构[：:]\s*([^\n]+)/)
        if (penaltyInstitutionMatch) {
          data.penaltyInstitution = penaltyInstitutionMatch[1].trim()
        }
      }

      if (!data.penaltyReason) {
        const penaltyReasonMatch = fullContent.match(/处罚原因[：:]\s*([^\n]+)/)
        if (penaltyReasonMatch) {
          data.penaltyReason = penaltyReasonMatch[1].trim()
        }
      }

      if (!data.penaltyAmount) {
        const penaltyAmountMatch = fullContent.match(/处罚金额[：:]\s*([^\n]+)/)
        if (penaltyAmountMatch) {
          data.penaltyAmount = penaltyAmountMatch[1].trim()
        }
      }

      if (!data.policyBasis) {
        const policyBasisMatch = fullContent.match(/政策依据[：:]\s*([^\n]+)/)
        if (policyBasisMatch) {
          data.policyBasis = policyBasisMatch[1].trim()
        }
      }
    } else if (frontmatter.type === 'policy_draft') {
      // 提取政策相关字段
      if (!data.policyTitle) {
        const policyTitleMatch = fullContent.match(/^#\s+(.+)$/m)
        if (policyTitleMatch) {
          data.policyTitle = policyTitleMatch[1].trim()
        }
      }

      if (!data.commentDeadline) {
        const commentDeadlineMatch = fullContent.match(/征求意见截止[：:]\s*([^\n]+)/)
        if (commentDeadlineMatch) {
          data.commentDeadline = new Date(commentDeadlineMatch[1].trim())
        }
      }

      if (!data.mainRequirements) {
        const mainRequirementsMatch = fullContent.match(/主要要求[：:]\s*([^\n]+)/)
        if (mainRequirementsMatch) {
          data.mainRequirements = mainRequirementsMatch[1].trim()
        }
      }

      if (!data.expectedImplementationDate) {
        const expectedDateMatch = fullContent.match(/预计实施[：:]\s*([^\n]+)/)
        if (expectedDateMatch) {
          data.expectedImplementationDate = new Date(expectedDateMatch[1].trim())
        }
      }
    }

    return data
  }

  /**
   * 模块销毁时停止监控
   */
  async onModuleDestroy() {
    await this.stopWatching()
  }
}
