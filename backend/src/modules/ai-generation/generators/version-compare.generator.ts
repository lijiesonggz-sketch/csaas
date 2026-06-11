/**
 * 版本比对生成器（增强版）
 * 程序化条款对齐 + 指纹过滤 + 重编号匹配，仅变更部分调 AI，
 * 解除旧实现的 8000 字符截断限制。
 */
import { Injectable, Logger } from '@nestjs/common'
import { AIOrchestrator } from '../../ai-clients/ai-orchestrator.service'
import { AIModel } from '../../../database/entities/ai-generation-event.entity'
import {
  extractAlignableUnits,
  alignUnits,
  AlignmentResult,
  RenumberedPair,
} from '../utils/clause-alignment.util'
import { parseJsonWithRecovery } from '../utils/json-recovery.util'
import {
  fillModifiedPairsBatchPrompt,
  fillAddedDeletedBatchPrompt,
  fillCompareSummaryPrompt,
  fillFullDocComparePrompt,
  ModifiedPairInput,
} from '../prompts/version-compare.prompts'

/** 变更对批次：字符预算与条数上限 */
const MODIFIED_BATCH_CHAR_BUDGET = 12000
const MODIFIED_BATCH_MAX_PAIRS = 8
/** 增删批次上限 */
const ADDED_DELETED_BATCH_MAX_ITEMS = 15
const ADDED_DELETED_BATCH_CHAR_BUDGET = 10000
/** 非结构化且两侧总长低于此值时走整文直比 */
const AI_FALLBACK_MAX_TOTAL_LENGTH = 16000
/** 批间延迟（防限流） */
const BATCH_DELAY_MS = 500

export interface VersionCompareProgress {
  current: number
  total: number
  batch: number
  totalBatches: number
  message: string
}

export interface EnhancedVersionCompareOutput {
  version_info: { old_version: string; new_version: string; comparison_summary: string }
  added_clauses: Array<{
    clause_id: string
    clause_text: string
    impact: string
    action_required: string
  }>
  modified_clauses: Array<{
    clause_id: string
    old_text: string
    new_text: string
    change_type: 'MINOR' | 'MAJOR'
    impact: string
    migration_guide: string
    old_clause_id?: string
    new_clause_id?: string
    change_summary?: string
  }>
  deleted_clauses: Array<{
    clause_id: string
    old_text: string
    impact: string
    alternative: string
  }>
  statistics: {
    total_added: number
    total_modified: number
    total_deleted: number
    change_percentage: number
    total_unchanged?: number
    total_renumbered?: number
  }
  migration_recommendations: string[]
  renumbered_clauses?: Array<{
    old_clause_id: string
    new_clause_id: string
    similarity: number
    text_changed: boolean
  }>
  alignment_meta?: {
    mode: 'clause' | 'paragraph' | 'ai_fallback'
    old_unit_count: number
    new_unit_count: number
    unchanged_count: number
    ai_analyzed_pairs: number
    ai_batch_failures: number
  }
}

interface DocumentInput {
  id: string
  name: string
  content: string
}

interface PairToAnalyze extends ModifiedPairInput {
  oldClauseId?: string
  newClauseId?: string
}

@Injectable()
export class VersionCompareGenerator {
  private readonly logger = new Logger(VersionCompareGenerator.name)

  constructor(private readonly aiOrchestrator: AIOrchestrator) {}

  async compareVersionsEnhanced(input: {
    oldVersion: DocumentInput
    newVersion: DocumentInput
    temperature?: number
    onProgress?: (progress: VersionCompareProgress) => void
  }): Promise<{
    gpt4: EnhancedVersionCompareOutput
    claude: EnhancedVersionCompareOutput
    domestic: EnhancedVersionCompareOutput
  }> {
    const { oldVersion, newVersion, temperature = 0.3, onProgress } = input
    this.logger.log(
      `Enhanced version compare: old=${oldVersion.content.length} chars, new=${newVersion.content.length} chars`,
    )

    onProgress?.({ current: 5, total: 100, batch: 0, totalBatches: 0, message: '正在提取条款...' })

    const oldExtract = extractAlignableUnits(oldVersion.content)
    const newExtract = extractAlignableUnits(newVersion.content)
    const totalLength = oldVersion.content.length + newVersion.content.length

    // 降级二：非结构化小文档整文直比
    if (
      (oldExtract.mode === 'paragraph' || newExtract.mode === 'paragraph') &&
      totalLength < AI_FALLBACK_MAX_TOTAL_LENGTH
    ) {
      this.logger.log('Using ai_fallback mode (unstructured small documents)')
      const result = await this.compareWholeDocuments(
        oldVersion,
        newVersion,
        temperature,
        onProgress,
      )
      return { gpt4: result, claude: result, domestic: result }
    }

    const alignment = alignUnits(oldExtract.units, newExtract.units)
    const mode =
      oldExtract.mode === 'clause' && newExtract.mode === 'clause' ? 'clause' : 'paragraph'
    this.logger.log(
      `Alignment done (${mode}): unchanged=${alignment.unchanged.length}, modified=${alignment.modified.length}, ` +
        `renumbered=${alignment.renumbered.length}, added=${alignment.added.length}, deleted=${alignment.deleted.length}`,
    )
    onProgress?.({
      current: 15,
      total: 100,
      batch: 0,
      totalBatches: 0,
      message: `条款对齐完成：未变${alignment.unchanged.length}，待分析${alignment.modified.length + alignment.added.length + alignment.deleted.length}`,
    })

    const result = await this.analyzeAlignment(
      oldVersion,
      newVersion,
      alignment,
      mode,
      oldExtract.units.length,
      newExtract.units.length,
      temperature,
      onProgress,
    )

    onProgress?.({ current: 100, total: 100, batch: 0, totalBatches: 0, message: '版本比对完成' })
    return { gpt4: result, claude: result, domestic: result }
  }

  /** 主流程：对齐结果 → AI 批量分析 → 程序化组装 */
  private async analyzeAlignment(
    oldVersion: DocumentInput,
    newVersion: DocumentInput,
    alignment: AlignmentResult,
    mode: 'clause' | 'paragraph',
    oldUnitCount: number,
    newUnitCount: number,
    temperature: number,
    onProgress?: (progress: VersionCompareProgress) => void,
  ): Promise<EnhancedVersionCompareOutput> {
    let aiBatchFailures = 0

    // 待 AI 分析的变更对：同ID修改 + 重编号且正文有变
    const pairs: PairToAnalyze[] = [
      ...alignment.modified.map((m) => ({
        clause_id: m.id,
        old_text: m.oldText,
        new_text: m.newText,
      })),
      ...alignment.renumbered
        .filter((r) => r.textChanged)
        .map((r) => ({
          clause_id: r.newId,
          old_text: r.oldText,
          new_text: r.newText,
          oldClauseId: r.oldId,
          newClauseId: r.newId,
        })),
    ]

    const pairBatches = this.packPairBatches(pairs)
    const addedDeletedBatches = this.packAddedDeletedBatches(alignment.added, alignment.deleted)
    const totalBatches = pairBatches.length + addedDeletedBatches.length

    // 批量分析变更对
    const modifiedClauses: EnhancedVersionCompareOutput['modified_clauses'] = []
    const changeSummaries: string[] = []
    let batchIndex = 0

    for (const batch of pairBatches) {
      batchIndex++
      const { results, failed } = await this.analyzePairBatch(batch, newVersion.name, temperature)
      if (failed) aiBatchFailures++
      changeSummaries.push(...results.map((r) => r.change_summary).filter(Boolean))
      modifiedClauses.push(...results)
      this.emitBatchProgress(onProgress, batchIndex, totalBatches)
      await this.delay()
    }

    // 批量分析新增/删除
    const addedClauses: EnhancedVersionCompareOutput['added_clauses'] = []
    const deletedClauses: EnhancedVersionCompareOutput['deleted_clauses'] = []

    for (const batch of addedDeletedBatches) {
      batchIndex++
      const { added, deleted, failed } = await this.analyzeAddedDeletedBatch(
        batch,
        newVersion.name,
        temperature,
      )
      if (failed) aiBatchFailures++
      addedClauses.push(...added)
      deletedClauses.push(...deleted)
      this.emitBatchProgress(onProgress, batchIndex, totalBatches)
      await this.delay()
    }

    // 程序化统计
    const stats = {
      added: alignment.added.length,
      modified: pairs.length,
      deleted: alignment.deleted.length,
      renumbered: alignment.renumbered.length,
      unchanged: alignment.unchanged.length,
    }
    const changeCount = stats.added + stats.modified + stats.deleted + stats.renumbered
    const changePercentage = Math.round((changeCount / Math.max(oldUnitCount, 1)) * 10000) / 10000

    // 总体摘要（无变更时程序化生成，不调 AI）
    let comparisonSummary = '两版本条款内容一致，未发现实质性变更。'
    let migrationRecommendations = ['无需迁移动作', '保持现有合规措施', '持续关注标准后续修订']
    if (changeCount > 0) {
      onProgress?.({
        current: 90,
        total: 100,
        batch: 0,
        totalBatches: 0,
        message: '正在生成总体结论...',
      })
      const summary = await this.generateSummary(
        oldVersion.name,
        newVersion.name,
        stats,
        changeSummaries,
        temperature,
      )
      if (summary) {
        comparisonSummary = summary.comparison_summary || comparisonSummary
        if (
          Array.isArray(summary.migration_recommendations) &&
          summary.migration_recommendations.length >= 3
        ) {
          migrationRecommendations = summary.migration_recommendations
        }
      } else {
        aiBatchFailures++
        comparisonSummary = `程序化比对：新增${stats.added}条，修改${stats.modified}条，删除${stats.deleted}条，重编号${stats.renumbered}条，未变${stats.unchanged}条。`
        migrationRecommendations = [
          '请人工复核各变更条款的影响',
          '按新增条款补充制度与流程',
          '按删除条款清理失效引用',
        ]
      }
    }

    return {
      version_info: {
        old_version: oldVersion.name,
        new_version: newVersion.name,
        comparison_summary: comparisonSummary,
      },
      added_clauses: addedClauses,
      modified_clauses: modifiedClauses,
      deleted_clauses: deletedClauses,
      statistics: {
        total_added: stats.added,
        total_modified: stats.modified,
        total_deleted: stats.deleted,
        change_percentage: changePercentage,
        total_unchanged: stats.unchanged,
        total_renumbered: stats.renumbered,
      },
      migration_recommendations: migrationRecommendations,
      renumbered_clauses: alignment.renumbered.map((r: RenumberedPair) => ({
        old_clause_id: r.oldId,
        new_clause_id: r.newId,
        similarity: r.similarity,
        text_changed: r.textChanged,
      })),
      alignment_meta: {
        mode,
        old_unit_count: oldUnitCount,
        new_unit_count: newUnitCount,
        unchanged_count: stats.unchanged,
        ai_analyzed_pairs: pairs.length,
        ai_batch_failures: aiBatchFailures,
      },
    }
  }

  /** 变更对装箱：字符预算 + 条数上限 */
  private packPairBatches(pairs: PairToAnalyze[]): PairToAnalyze[][] {
    const batches: PairToAnalyze[][] = []
    let current: PairToAnalyze[] = []
    let currentChars = 0
    for (const pair of pairs) {
      const pairChars = pair.old_text.length + pair.new_text.length
      if (
        current.length > 0 &&
        (current.length >= MODIFIED_BATCH_MAX_PAIRS ||
          currentChars + pairChars > MODIFIED_BATCH_CHAR_BUDGET)
      ) {
        batches.push(current)
        current = []
        currentChars = 0
      }
      current.push(pair)
      currentChars += pairChars
    }
    if (current.length > 0) batches.push(current)
    return batches
  }

  /** 增删条款装箱 */
  private packAddedDeletedBatches(
    added: Array<{ id: string; text: string }>,
    deleted: Array<{ id: string; text: string }>,
  ): Array<{
    added: Array<{ clause_id: string; text: string }>
    deleted: Array<{ clause_id: string; text: string }>
  }> {
    const items = [
      ...added.map((u) => ({ kind: 'added' as const, clause_id: u.id, text: u.text })),
      ...deleted.map((u) => ({ kind: 'deleted' as const, clause_id: u.id, text: u.text })),
    ]
    if (items.length === 0) return []

    const batches: Array<{ added: any[]; deleted: any[] }> = []
    let current = { added: [] as any[], deleted: [] as any[] }
    let count = 0
    let chars = 0
    for (const item of items) {
      if (
        count > 0 &&
        (count >= ADDED_DELETED_BATCH_MAX_ITEMS ||
          chars + item.text.length > ADDED_DELETED_BATCH_CHAR_BUDGET)
      ) {
        batches.push(current)
        current = { added: [], deleted: [] }
        count = 0
        chars = 0
      }
      current[item.kind].push({ clause_id: item.clause_id, text: item.text })
      count++
      chars += item.text.length
    }
    if (count > 0) batches.push(current)
    return batches
  }

  /** 分析一批变更对，失败时启发式兜底 */
  private async analyzePairBatch(
    batch: PairToAnalyze[],
    standardName: string,
    temperature: number,
  ): Promise<{ results: EnhancedVersionCompareOutput['modified_clauses']; failed: boolean }> {
    const prompt = fillModifiedPairsBatchPrompt(batch, standardName)
    const aiResults = await this.callAi(prompt, temperature)
    const parsed = aiResults
      ? parseJsonWithRecovery<{ results: any[] }>(aiResults, (v) => Array.isArray(v?.results))
      : null

    const byId = new Map<string, any>()
    if (parsed) {
      parsed.results.forEach((r) => byId.set(String(r.clause_id), r))
    }

    const results = batch.map((pair) => {
      const ai = byId.get(pair.clause_id)
      return {
        clause_id: pair.clause_id,
        old_text: pair.old_text,
        new_text: pair.new_text,
        change_type: (ai?.change_type === 'MAJOR' || ai?.change_type === 'MINOR'
          ? ai.change_type
          : this.heuristicChangeType(pair.old_text, pair.new_text)) as 'MINOR' | 'MAJOR',
        change_summary: ai?.change_summary || '条款文本发生变更',
        impact: ai?.impact || 'AI分析失败，请人工复核该条款变更影响',
        migration_guide: ai?.migration_guide || '请人工比对新旧文本并评估迁移动作',
        old_clause_id: pair.oldClauseId,
        new_clause_id: pair.newClauseId,
      }
    })

    return { results, failed: !parsed }
  }

  /** 分析一批新增/删除条款，失败时兜底文案 */
  private async analyzeAddedDeletedBatch(
    batch: {
      added: Array<{ clause_id: string; text: string }>
      deleted: Array<{ clause_id: string; text: string }>
    },
    standardName: string,
    temperature: number,
  ): Promise<{
    added: EnhancedVersionCompareOutput['added_clauses']
    deleted: EnhancedVersionCompareOutput['deleted_clauses']
    failed: boolean
  }> {
    const prompt = fillAddedDeletedBatchPrompt(batch, standardName)
    const aiResults = await this.callAi(prompt, temperature)
    const parsed = aiResults
      ? parseJsonWithRecovery<{ added?: any[]; deleted?: any[] }>(
          aiResults,
          (v) => Array.isArray(v?.added) || Array.isArray(v?.deleted),
        )
      : null

    const addedById = new Map<string, any>()
    const deletedById = new Map<string, any>()
    parsed?.added?.forEach((r) => addedById.set(String(r.clause_id), r))
    parsed?.deleted?.forEach((r) => deletedById.set(String(r.clause_id), r))

    return {
      added: batch.added.map((item) => ({
        clause_id: item.clause_id,
        clause_text: item.text,
        impact: addedById.get(item.clause_id)?.impact || 'AI分析失败，请人工评估新增条款影响',
        action_required: addedById.get(item.clause_id)?.action_required || '请人工制定落实措施',
      })),
      deleted: batch.deleted.map((item) => ({
        clause_id: item.clause_id,
        old_text: item.text,
        impact: deletedById.get(item.clause_id)?.impact || 'AI分析失败，请人工评估删除条款影响',
        alternative: deletedById.get(item.clause_id)?.alternative || '请人工确认替代要求',
      })),
      failed: !parsed,
    }
  }

  /** 总体摘要调用 */
  private async generateSummary(
    oldName: string,
    newName: string,
    stats: {
      added: number
      modified: number
      deleted: number
      renumbered: number
      unchanged: number
    },
    changeSummaries: string[],
    temperature: number,
  ): Promise<{ comparison_summary?: string; migration_recommendations?: string[] } | null> {
    const prompt = fillCompareSummaryPrompt({ oldName, newName, stats, changeSummaries })
    const content = await this.callAi(prompt, temperature)
    if (!content) return null
    return parseJsonWithRecovery(content, (v) => typeof v?.comparison_summary === 'string')
  }

  /** 整文直比（ai_fallback，无截断） */
  private async compareWholeDocuments(
    oldVersion: DocumentInput,
    newVersion: DocumentInput,
    temperature: number,
    onProgress?: (progress: VersionCompareProgress) => void,
  ): Promise<EnhancedVersionCompareOutput> {
    onProgress?.({ current: 30, total: 100, batch: 1, totalBatches: 1, message: '整文比对中...' })
    const prompt = fillFullDocComparePrompt(oldVersion, newVersion)
    const content = await this.callAi(prompt, temperature)
    const parsed = content ? parseJsonWithRecovery<any>(content, (v) => !!v?.version_info) : null

    const added = parsed?.added_clauses || []
    const modified = parsed?.modified_clauses || []
    const deleted = parsed?.deleted_clauses || []
    onProgress?.({ current: 100, total: 100, batch: 1, totalBatches: 1, message: '版本比对完成' })

    return {
      version_info: parsed?.version_info || {
        old_version: oldVersion.name,
        new_version: newVersion.name,
        comparison_summary: 'AI分析失败，请人工比对',
      },
      added_clauses: added,
      modified_clauses: modified,
      deleted_clauses: deleted,
      statistics: {
        total_added: added.length,
        total_modified: modified.length,
        total_deleted: deleted.length,
        change_percentage: 0,
      },
      migration_recommendations: parsed?.migration_recommendations || ['请人工复核比对结果'],
      alignment_meta: {
        mode: 'ai_fallback',
        old_unit_count: 0,
        new_unit_count: 0,
        unchanged_count: 0,
        ai_analyzed_pairs: 0,
        ai_batch_failures: parsed ? 0 : 1,
      },
    }
  }

  /** 启发式变更级别：长度变化>40% 或义务词数量变化 → MAJOR */
  private heuristicChangeType(oldText: string, newText: string): 'MINOR' | 'MAJOR' {
    const lengthChange = Math.abs(newText.length - oldText.length) / Math.max(oldText.length, 1)
    if (lengthChange > 0.4) return 'MAJOR'

    const countModals = (text: string) =>
      ['应当', '不得', '禁止', '必须'].reduce(
        (sum, modal) => sum + (text.split(modal).length - 1),
        0,
      )
    if (countModals(oldText) !== countModals(newText)) return 'MAJOR'
    return 'MINOR'
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

  private emitBatchProgress(
    onProgress: ((progress: VersionCompareProgress) => void) | undefined,
    batch: number,
    totalBatches: number,
  ): void {
    const percent = 15 + Math.floor((70 * batch) / Math.max(totalBatches, 1))
    onProgress?.({
      current: percent,
      total: 100,
      batch,
      totalBatches,
      message: `AI分析批次 ${batch}/${totalBatches}`,
    })
  }

  private delay(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return Promise.resolve()
    return new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
  }
}
