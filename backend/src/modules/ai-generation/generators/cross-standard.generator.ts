/**
 * 多标准交叉分析生成器
 * 跨监管机构标准的主题聚类 → 关系判定（冲突/重叠/互补/独有）→ 就高执行基线
 * 单来源主题程序化判定 UNIQUE（零 AI 成本），多来源主题 AI 批量分析
 */
import { Injectable, Logger } from '@nestjs/common'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'
import { ClusteringGenerator, Cluster } from './clustering.generator'
import { extractClauseInventoryFromContent } from '../utils/clause-id-utils'
import { parseJsonWithRecovery } from '../utils/json-recovery.util'
import {
  fillThemeRelationBatchPrompt,
  fillBaselineSummaryPrompt,
  ThemeForAnalysis,
} from '../prompts/cross-standard.prompts'

/** 主题关系分析批次字符预算 */
const THEME_BATCH_CHAR_BUDGET = 10000
/** 每批主题数上限 */
const THEME_BATCH_MAX_THEMES = 5
/** 文档总长超过此值时，聚类阶段改喂条款清单视图 */
const CLUSTERING_FULL_TEXT_MAX_LENGTH = 60000
/** 批间延迟 */
const BATCH_DELAY_MS = 500

export type CrossRelation = 'CONFLICT' | 'OVERLAP' | 'COMPLEMENT' | 'UNIQUE'

export interface CrossCompareOutput {
  documents: Array<{ id: string; name: string }>
  themes: Array<{
    theme_id: string
    theme_name: string
    category: string
    relation: CrossRelation
    relation_rationale: string
    requirements_by_document: Array<{
      document_id: string
      document_name: string
      clause_ids: string[]
      summary: string
      clauses: Array<{ clause_id: string; clause_text: string }>
    }>
    conflict_detail?: {
      conflict_points: Array<{
        aspect: string
        severity: 'HIGH' | 'MEDIUM' | 'LOW'
        positions: Array<{ document_id: string; position: string }>
      }>
    }
    unified_baseline: {
      requirement: string
      strictest_source_document_id?: string
      implementation_notes?: string
    }
  }>
  statistics: {
    total_themes: number
    conflict_count: number
    overlap_count: number
    complement_count: number
    unique_count: number
    documents_count: number
    ai_analyzed_themes: number
    ai_batch_failures: number
  }
  baseline_summary: string[]
  coverage_summary?: any
}

export interface CrossCompareProgress {
  current: number
  total: number
  batch: number
  totalBatches: number
  message: string
}

interface DocumentInput {
  id: string
  name: string
  content: string
}

interface ThemeDraft {
  theme_id: string
  theme_name: string
  category: string
  requirements_by_document: CrossCompareOutput['themes'][number]['requirements_by_document']
  sourceCount: number
}

@Injectable()
export class CrossStandardGenerator {
  private readonly logger = new Logger(CrossStandardGenerator.name)

  constructor(
    private readonly aiOrchestrator: AIOrchestrator,
    private readonly clusteringGenerator: ClusteringGenerator,
  ) {}

  async generate(input: {
    documents: DocumentInput[]
    temperature?: number
    onProgress?: (progress: CrossCompareProgress) => void
  }): Promise<{
    gpt4: CrossCompareOutput
    claude: CrossCompareOutput
    domestic: CrossCompareOutput
  }> {
    const { documents, temperature = 0.3, onProgress } = input
    if (!documents || documents.length < 2) {
      throw new Error('多标准交叉分析至少需要2个文档')
    }

    this.logger.log(`Cross-standard analysis: ${documents.length} documents`)
    onProgress?.({
      current: 5,
      total: 100,
      batch: 0,
      totalBatches: 0,
      message: '正在进行主题聚类...',
    })

    // Step 2: 主题聚类（强制 AI 模式，避免确定性聚类沿单文档层级展开）
    const clusteringDocs = this.buildClusteringDocuments(documents)
    const clusteringResult = await this.clusteringGenerator.generate({
      documents: clusteringDocs,
      clusteringMode: 'ai',
      temperature: 0.7,
    })
    const clustering = clusteringResult.gpt4
    if (!clustering?.categories?.length) {
      throw new Error('主题聚类失败，无法进行交叉分析')
    }

    onProgress?.({
      current: 35,
      total: 100,
      batch: 0,
      totalBatches: 0,
      message: '聚类完成，正在分析主题关系...',
    })

    // Step 3: 构建主题草稿，按来源数分流
    const drafts = this.buildThemeDrafts(clustering.categories, documents)
    const uniqueDrafts = drafts.filter((d) => d.sourceCount <= 1)
    const multiDrafts = drafts.filter((d) => d.sourceCount > 1)
    this.logger.log(
      `Themes: ${drafts.length} total, ${uniqueDrafts.length} unique (no AI), ${multiDrafts.length} multi-source (AI)`,
    )

    const output = await this.analyzeThemes(
      documents,
      drafts,
      multiDrafts,
      clustering.coverage_summary,
      temperature,
      onProgress,
    )

    onProgress?.({ current: 100, total: 100, batch: 0, totalBatches: 0, message: '交叉分析完成' })
    return { gpt4: output, claude: output, domestic: output }
  }

  /** 文档总长超限时，聚类阶段用条款清单视图替代全文（聚类只需主题信号） */
  private buildClusteringDocuments(documents: DocumentInput[]): DocumentInput[] {
    const totalLength = documents.reduce((sum, doc) => sum + doc.content.length, 0)
    if (totalLength <= CLUSTERING_FULL_TEXT_MAX_LENGTH) {
      return documents
    }

    this.logger.log(
      `Total length ${totalLength} > ${CLUSTERING_FULL_TEXT_MAX_LENGTH}, using inventory view for clustering`,
    )
    return documents.map((doc) => {
      const inventory = extractClauseInventoryFromContent(doc.content)
      if (inventory.length === 0) {
        return doc
      }
      const inventoryText = inventory
        .map((item: { id: string; text: string }) => `${item.id} ${item.text.substring(0, 300)}`)
        .join('\n')
      return { ...doc, content: inventoryText }
    })
  }

  /** 把聚类三层结构转为主题草稿（cluster=theme），条款按来源文档分组 */
  private buildThemeDrafts(
    categories: Array<{ name: string; clusters: Cluster[] }>,
    documents: DocumentInput[],
  ): ThemeDraft[] {
    const docNameById = new Map(documents.map((doc) => [doc.id, doc.name]))
    const drafts: ThemeDraft[] = []

    for (const category of categories) {
      for (const cluster of category.clusters || []) {
        const byDocument = new Map<string, Array<{ clause_id: string; clause_text: string }>>()
        for (const clause of cluster.clauses || []) {
          const docId = String(clause.source_document_id)
          if (!byDocument.has(docId)) byDocument.set(docId, [])
          byDocument
            .get(docId)!
            .push({ clause_id: clause.clause_id, clause_text: clause.clause_text })
        }

        drafts.push({
          theme_id: cluster.id,
          theme_name: cluster.name,
          category: category.name,
          sourceCount: byDocument.size,
          requirements_by_document: Array.from(byDocument.entries()).map(([docId, clauses]) => ({
            document_id: docId,
            document_name: docNameById.get(docId) || docId,
            clause_ids: clauses.map((c) => c.clause_id),
            summary: cluster.description || '',
            clauses,
          })),
        })
      }
    }

    return drafts
  }

  /** 主流程：UNIQUE 程序化 + 多来源 AI 批量 + 基线汇总 */
  private async analyzeThemes(
    documents: DocumentInput[],
    allDrafts: ThemeDraft[],
    multiDrafts: ThemeDraft[],
    coverageSummary: any,
    temperature: number,
    onProgress?: (progress: CrossCompareProgress) => void,
  ): Promise<CrossCompareOutput> {
    const documentNames = documents.map((doc) => doc.name)
    let aiBatchFailures = 0

    // 多来源主题分批 AI 分析
    const batches = this.packThemeBatches(multiDrafts)
    const aiResultByThemeId = new Map<string, any>()

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      const themesForPrompt: ThemeForAnalysis[] = batch.map((draft) => ({
        theme_id: draft.theme_id,
        theme_name: draft.theme_name,
        requirements_by_document: draft.requirements_by_document.map((req) => ({
          document_id: req.document_id,
          document_name: req.document_name,
          clauses: req.clauses,
        })),
      }))

      const prompt = fillThemeRelationBatchPrompt(themesForPrompt, documentNames)
      const content = await this.callAi(prompt, temperature)
      const parsed = content
        ? parseJsonWithRecovery<{ themes: any[] }>(content, (v) => Array.isArray(v?.themes))
        : null

      if (parsed) {
        parsed.themes.forEach((theme) => aiResultByThemeId.set(String(theme.theme_id), theme))
      } else {
        aiBatchFailures++
        this.logger.warn(`Theme relation batch ${batchIndex + 1} failed, falling back to OVERLAP`)
      }

      const percent = 35 + Math.floor((50 * (batchIndex + 1)) / Math.max(batches.length, 1))
      onProgress?.({
        current: percent,
        total: 100,
        batch: batchIndex + 1,
        totalBatches: batches.length,
        message: `主题关系分析批次 ${batchIndex + 1}/${batches.length}`,
      })
      await this.delay()
    }

    // 组装主题结果
    const themes = allDrafts.map((draft) => this.buildTheme(draft, aiResultByThemeId))

    // 程序化统计
    const statistics = {
      total_themes: themes.length,
      conflict_count: themes.filter((t) => t.relation === 'CONFLICT').length,
      overlap_count: themes.filter((t) => t.relation === 'OVERLAP').length,
      complement_count: themes.filter((t) => t.relation === 'COMPLEMENT').length,
      unique_count: themes.filter((t) => t.relation === 'UNIQUE').length,
      documents_count: documents.length,
      ai_analyzed_themes: multiDrafts.length,
      ai_batch_failures: aiBatchFailures,
    }

    // 基线汇总（AI 失败时程序化兜底）
    onProgress?.({
      current: 90,
      total: 100,
      batch: 0,
      totalBatches: 0,
      message: '正在生成合规基线...',
    })
    let baselineSummary = await this.generateBaselineSummary(
      documentNames,
      statistics,
      themes,
      temperature,
    )
    if (!baselineSummary) {
      aiBatchFailures++
      statistics.ai_batch_failures = aiBatchFailures
      baselineSummary = themes
        .filter((t) => t.relation === 'CONFLICT')
        .slice(0, 5)
        .map((t) => `【冲突】${t.theme_name}：${t.unified_baseline.requirement}`)
      if (baselineSummary.length === 0) {
        baselineSummary = ['各标准要求无直接冲突，按各自规定执行并保留证据']
      }
    }

    return {
      documents: documents.map((doc) => ({ id: doc.id, name: doc.name })),
      themes: this.sortThemes(themes),
      statistics,
      baseline_summary: baselineSummary,
      coverage_summary: coverageSummary,
    }
  }

  /** 单主题组装：UNIQUE 程序化 / 多来源用 AI 结果或保守兜底 */
  private buildTheme(
    draft: ThemeDraft,
    aiResultByThemeId: Map<string, any>,
  ): CrossCompareOutput['themes'][number] {
    const base = {
      theme_id: draft.theme_id,
      theme_name: draft.theme_name,
      category: draft.category,
      requirements_by_document: draft.requirements_by_document,
    }

    if (draft.sourceCount <= 1) {
      const docName = draft.requirements_by_document[0]?.document_name || '单一标准'
      return {
        ...base,
        relation: 'UNIQUE',
        relation_rationale: `仅《${docName}》覆盖该主题，无跨标准冲突`,
        unified_baseline: {
          requirement: draft.requirements_by_document[0]?.summary || draft.theme_name,
          strictest_source_document_id: draft.requirements_by_document[0]?.document_id,
          implementation_notes: '按该标准要求直接执行',
        },
      }
    }

    const ai = aiResultByThemeId.get(draft.theme_id)
    if (!ai) {
      return {
        ...base,
        relation: 'OVERLAP',
        relation_rationale: 'AI分析失败，保守判定为重叠，请人工复核各标准要求',
        unified_baseline: {
          requirement: '请人工比对各标准条款并按就高原则确定执行口径',
          implementation_notes: '需人工复核',
        },
      }
    }

    const relation: CrossRelation = ['CONFLICT', 'OVERLAP', 'COMPLEMENT'].includes(ai.relation)
      ? ai.relation
      : 'OVERLAP'

    // AI 的 document_positions.summary 回填各文档摘要
    const positionByDocId = new Map<string, string>(
      (ai.document_positions || []).map((p: any) => [
        String(p.document_id),
        String(p.summary || ''),
      ]),
    )

    return {
      ...base,
      requirements_by_document: draft.requirements_by_document.map((req) => ({
        ...req,
        summary: positionByDocId.get(req.document_id) || req.summary,
      })),
      relation,
      relation_rationale: ai.relation_rationale || '',
      conflict_detail:
        relation === 'CONFLICT' &&
        Array.isArray(ai.conflict_points) &&
        ai.conflict_points.length > 0
          ? { conflict_points: ai.conflict_points }
          : undefined,
      unified_baseline: {
        requirement: ai.unified_baseline?.requirement || '请人工确定统一执行口径',
        strictest_source_document_id: ai.unified_baseline?.strictest_source_document_id,
        implementation_notes: ai.unified_baseline?.implementation_notes,
      },
    }
  }

  /** 主题装箱：字符预算 + 条数上限 */
  private packThemeBatches(drafts: ThemeDraft[]): ThemeDraft[][] {
    const batches: ThemeDraft[][] = []
    let current: ThemeDraft[] = []
    let currentChars = 0

    for (const draft of drafts) {
      const draftChars = draft.requirements_by_document.reduce(
        (sum, req) =>
          sum + req.clauses.reduce((s, c) => s + Math.min(c.clause_text.length, 600), 0),
        0,
      )
      if (
        current.length > 0 &&
        (current.length >= THEME_BATCH_MAX_THEMES ||
          currentChars + draftChars > THEME_BATCH_CHAR_BUDGET)
      ) {
        batches.push(current)
        current = []
        currentChars = 0
      }
      current.push(draft)
      currentChars += draftChars
    }
    if (current.length > 0) batches.push(current)
    return batches
  }

  /** 冲突置顶排序：CONFLICT > OVERLAP > COMPLEMENT > UNIQUE */
  private sortThemes(themes: CrossCompareOutput['themes']): CrossCompareOutput['themes'] {
    const order: Record<CrossRelation, number> = {
      CONFLICT: 0,
      OVERLAP: 1,
      COMPLEMENT: 2,
      UNIQUE: 3,
    }
    return [...themes].sort((a, b) => order[a.relation] - order[b.relation])
  }

  private async generateBaselineSummary(
    documentNames: string[],
    stats: CrossCompareOutput['statistics'],
    themes: CrossCompareOutput['themes'],
    temperature: number,
  ): Promise<string[] | null> {
    const prompt = fillBaselineSummaryPrompt({
      documentNames,
      stats: {
        total: stats.total_themes,
        conflict: stats.conflict_count,
        overlap: stats.overlap_count,
        complement: stats.complement_count,
        unique: stats.unique_count,
      },
      conflictThemes: themes
        .filter((t) => t.relation === 'CONFLICT')
        .map((t) => ({ theme_name: t.theme_name, rationale: t.relation_rationale })),
    })

    const content = await this.callAi(prompt, temperature)
    if (!content) return null
    const parsed = parseJsonWithRecovery<{ baseline_summary: string[] }>(
      content,
      (v) => Array.isArray(v?.baseline_summary) && v.baseline_summary.length > 0,
    )
    return parsed?.baseline_summary || null
  }

  private async callAi(prompt: string, temperature: number): Promise<string | null> {
    try {
      const result = await this.aiOrchestrator.generate(
        { prompt, temperature, maxTokens: 8000 },
        AIModel.GPT4,
      )
      return result.content
    } catch (error) {
      this.logger.error(`AI call failed: ${error.message}`)
      return null
    }
  }

  private delay(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return Promise.resolve()
    return new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
  }
}
