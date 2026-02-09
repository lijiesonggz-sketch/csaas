---
epic: epic-8
story: 8-3-peer-content-ai-analysis
status: done
---

# Story 8.3: 同业内容三模型AI分析

## 用户故事

**As a** 系统,
**I want** 使用三模型AI共识机制分析同业内容,
**So that** 提取高质量的技术方案、成本、效果信息。

## 验收标准

### AC1: 三模型并行调用
**Given** Story 8.2 采集成功并创建 RawContent
**When** AI分析任务从 `radar-ai-analysis` 队列取出
**Then** 调用 AIOrchestrator 并行请求三个模型：GPT-4、Claude、通义千问
**And** 使用同业分析专用Prompt，要求提取：practiceDescription、estimatedCost、implementationPeriod、technicalEffect
**And** 等待所有模型返回结果（超时30秒）

### AC2: 三层质量验证
**Given** 三模型返回分析结果
**When** 结果聚合
**Then** 调用 QualityValidationService.validateQuality() 执行三层验证：
  - 结构层一致性（40%权重，阈值 ≥ 0.9）
  - 语义层等价性（40%权重，阈值 ≥ 0.8，使用 Embedding 计算）
  - 细节层一致性（20%权重，阈值 ≥ 0.6）
**And** 调用 ResultAggregatorService.aggregate() 投票选择最佳结果
**And** 优先级顺序：GPT4 > Claude > Tongyi

### AC3: 置信度计算
**Given** 质量验证通过
**When** 确定置信度
**Then** 计算 overallSimilarity（加权总分）
**And** 确定 confidence 等级：
  - high: 3模型成功且 overallScore ≥ 0.85
  - medium: 3模型成功且 overallScore ≥ 0.75，或2模型成功且 overallScore ≥ 0.75
  - low: 单模型成功，或 overallScore < 0.75
**And** 创建 AnalyzedContent 记录，包含AI分析结果

### AC4: 低置信度处理
**Given** 质量验证不通过（overallScore < 0.7 或单模型成功）
**When** 置信度为 low
**Then** 创建 AnalyzedContent 记录，status = 'pending_review'
**And** 记录差异点到 discrepancies 字段
**And** 使用通义千问单模型结果作为 selectedModel
**And** 触发运营审核队列（创建 Alert 记录，type='peer_content_review'）
**And** 通知运营人员审核低置信度内容

## 技术规范

### 复用现有组件

**IMPORTANT: 本功能复用现有的三模型AI共识机制，必须遵循以下复用规范：**

1. **QualityValidationService** (`backend/src/modules/quality-validation/quality-validation.service.ts`)
   - 复用 `validateQuality()` 方法执行三层质量验证
   - 复用结构一致性、语义等价性、细节一致性验证逻辑
   - 验证阈值：结构层 ≥ 90%，语义层 ≥ 80%，细节层 ≥ 60%

2. **ConsistencyValidator** (`backend/src/modules/quality-validation/validators/consistency.validator.ts`)
   - 复用三层验证逻辑：结构层(40%权重)、语义层(40%权重)、细节层(20%权重)
   - 复用动态质量验证策略（根据成功模型数量调整）
   - 复用置信度等级计算逻辑

3. **ResultAggregatorService** (`backend/src/modules/result-aggregation/result-aggregator.service.ts`)
   - 复用 `aggregate()` 方法投票选择最佳结果
   - 复用结果存储到 AIGenerationResult 实体的逻辑
   - 优先级顺序：GPT4 > Claude > Domestic

4. **AIOrchestrator** (`backend/src/modules/ai-clients/ai-orchestrator.service.ts`)
   - 复用三模型并行调用能力
   - 复用模型降级和容错机制

### 数据库实体

**AnalyzedContent 实体 - AI分析结果存储**

```typescript
@Entity('analyzed_contents')
export class AnalyzedContent {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  rawContentId: string  // 关联 RawContent.id (Story 8.2 创建)

  @Column({ type: 'uuid', nullable: true })
  taskId: string  // 关联 AITask.id

  @Column({ type: 'varchar', length: 255 })
  peerName: string  // 同业机构名称

  @Column({ type: 'text' })
  practiceDescription: string  // 技术实践描述

  @Column({ type: 'varchar', length: 255, nullable: true })
  estimatedCost: string  // 预估成本（如"100-200万"）

  @Column({ type: 'varchar', length: 255, nullable: true })
  implementationPeriod: string  // 实施周期（如"6-12个月"）

  @Column({ type: 'text', nullable: true })
  technicalEffect: string  // 技术效果

  @Column({ type: 'simple-array', nullable: true })
  keyTechnologies: string[]  // 关键技术

  @Column({ type: 'text', nullable: true })
  applicableScenarios: string  // 适用场景

  @Column({ type: 'enum', enum: ['high', 'medium', 'low'] })
  confidence: 'high' | 'medium' | 'low'  // 置信度等级

  @Column({ type: 'float' })
  overallSimilarity: number  // 整体相似度分数

  @Column({ type: 'jsonb', nullable: true })
  qualityScores: {
    structural: number  // 结构一致性分数
    semantic: number    // 语义等价性分数
    detail: number      // 细节一致性分数
  }

  @Column({ type: 'jsonb', nullable: true })
  modelResults: {
    gpt4?: Record<string, any>
    claude?: Record<string, any>
    tongyi?: Record<string, any>
  }

  @Column({ type: 'varchar', length: 50 })
  selectedModel: 'gpt4' | 'claude' | 'tongyi'  // 最终选择的模型

  @Column({ type: 'enum', enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  reviewStatus: 'pending' | 'approved' | 'rejected'  // 审核状态

  @Column({ type: 'jsonb', nullable: true })
  discrepancies: string[]  // 模型间差异点（低置信度时记录）

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
```

### BullMQ 队列配置

**队列名称**: `radar-ai-analysis`（复用现有AI分析队列）

**Job 数据结构**:
```typescript
interface PeerContentAnalysisJob {
  type: 'peer-content-analysis'
  rawContentId: string    // RawContent.id (来自 Story 8.2)
  peerName: string        // 同业机构名称
  content: string         // 需要分析的原始内容
  tenantId: string        // 租户ID
  retryCount?: number     // 当前重试次数
}
```

**并发配置**:
- 并发数: 3（与现有AI分析任务共享配置）
- 重试策略: 指数退避（2s, 4s, 8s），最多3次

### 与 Story 8.2 的集成点

Story 8.2 采集成功后，将任务加入AI分析队列：

```typescript
// 在 PeerCrawlerService 中
await this.aiAnalysisQueue.add('analyze-peer-content', {
  type: 'peer-content-analysis',
  rawContentId: rawContent.id,
  peerName: task.peerName,
  content: crawlResult.content,
  tenantId: task.tenantId,
})
```

### AI分析Prompt
```
请分析以下同业技术实践内容，提取关键信息：

内容：{{content}}

请提取以下字段（JSON格式）：
{
  "practiceDescription": "技术实践详细描述",
  "estimatedCost": "预估投入成本（如'100-200万'）",
  "implementationPeriod": "实施周期（如'6-12个月'）",
  "technicalEffect": "技术效果/收益描述",
  "keyTechnologies": ["关键技术1", "关键技术2"],
  "applicableScenarios": "适用场景"
}

注意：
1. 如果内容中未提及某字段，使用"未提及"
2. 成本和周期请尽可能提取具体数值或范围
3. 描述应简洁但包含关键信息
```

### 质量验证算法

**复用现有 QualityValidationService 的验证逻辑：**

```typescript
interface QualityValidationResult {
  qualityScores: {
    structural: number  // 结构一致性分数 (0-1)，阈值 ≥ 0.9
    semantic: number    // 语义等价性分数 (0-1)，阈值 ≥ 0.8
    detail: number      // 细节一致性分数 (0-1)，阈值 ≥ 0.6
  }
  consistencyReport: {
    agreements: string[]      // 一致点
    disagreements: string[]   // 分歧点
    highRiskDisagreements: string[]  // 高风险分歧
  }
  overallScore: number  // 加权总分
  confidence: 'high' | 'medium' | 'low'
  passed: boolean       // 是否通过验证
}
```

**三层验证说明**:
1. **结构层 (40%权重)**: 验证JSON字段完整性，使用 `calculateStructuralSimilarity()`
2. **语义层 (40%权重)**: 使用Embedding计算语义相似度，使用 `calculateSimilarity()`
3. **细节层 (20%权重)**: 使用文本相似度验证细节一致性

**置信度等级**:
- `high`: 3模型成功且 overallScore ≥ 0.85
- `medium`: 3模型成功且 overallScore ≥ 0.75，或2模型成功且 overallScore ≥ 0.75
- `low`: 单模型成功，或 overallScore < 0.75

### 服务接口

```typescript
@Injectable()
export class PeerContentAnalyzerService {
  constructor(
    private readonly aiOrchestrator: AIOrchestrator,
    private readonly qualityValidationService: QualityValidationService,
    private readonly resultAggregatorService: ResultAggregatorService,
    private readonly analyzedContentRepository: Repository<AnalyzedContent>,
    private readonly rawContentRepository: Repository<RawContent>,
  ) {}

  /**
   * 分析同业内容（供 Processor 调用）
   */
  async analyzePeerContent(rawContentId: string): Promise<AnalyzedContent>

  /**
   * 并行调用三模型
   */
  private async callThreeModels(content: string): Promise<{
    gpt4: Record<string, any> | null
    claude: Record<string, any> | null
    tongyi: Record<string, any> | null
  }>

  /**
   * 执行质量验证（复用 QualityValidationService）
   */
  private async validateQuality(results: {
    gpt4: Record<string, any> | null
    claude: Record<string, any> | null
    tongyi: Record<string, any> | null
  }): Promise<FullValidationReport>

  /**
   * 聚合结果并选择最佳结果（复用 ResultAggregatorService）
   */
  private async aggregateResults(
    rawContentId: string,
    results: {
      gpt4: Record<string, any> | null
      claude: Record<string, any> | null
      tongyi: Record<string, any> | null
    },
    validationReport: FullValidationReport,
  ): Promise<AggregationOutput>

  /**
   * 创建 AnalyzedContent 记录
   */
  private async createAnalyzedContent(
    rawContentId: string,
    aggregatedResult: AggregationOutput,
    modelResults: {
      gpt4: Record<string, any> | null
      claude: Record<string, any> | null
      tongyi: Record<string, any> | null
    },
  ): Promise<AnalyzedContent>

  /**
   * 处理低置信度情况
   */
  private async handleLowConfidence(
    rawContentId: string,
    validationReport: FullValidationReport,
    modelResults: {
      gpt4: Record<string, any> | null
      claude: Record<string, any> | null
      tongyi: Record<string, any> | null
    },
  ): Promise<AnalyzedContent>
}
```

### Processor 实现

```typescript
@Processor('radar-ai-analysis')
export class PeerContentAnalysisProcessor {
  constructor(
    private readonly peerContentAnalyzerService: PeerContentAnalyzerService,
  ) {}

  @Process('analyze-peer-content')
  async handlePeerContentAnalysis(job: Job<PeerContentAnalysisJob>) {
    const { rawContentId } = job.data
    return this.peerContentAnalyzerService.analyzePeerContent(rawContentId)
  }
}
```

## 实现注意事项

### 关键设计决策

1. **复用现有AI基础设施**
   - 理由：避免重复实现三模型共识和质量验证逻辑
   - 复用 QualityValidationService、ResultAggregatorService、AIOrchestrator
   - 与现有AI任务队列 `radar-ai-analysis` 集成

2. **AnalyzedContent 实体设计**
   - 关联 RawContent，形成完整的数据流：采集 -> 分析 -> 推送
   - 存储三模型原始结果，便于后续审核和调试
   - 支持审核工作流（reviewStatus 字段）

3. **与 Story 8.2 的集成**
   - Story 8.2 负责采集和创建 RawContent
   - Story 8.2 将分析任务加入队列
   - Story 8.3 负责消费队列并执行分析

### 常见陷阱

- **不要**重新实现三模型共识逻辑 - 复用现有的 QualityValidationService
- **不要**重新实现结果投票逻辑 - 复用 ResultAggregatorService
- **注意** 与 Story 8.2 的队列集成 - 使用 `radar-ai-analysis` 队列
- **注意** 置信度阈值与现有系统保持一致（high ≥ 0.85, medium ≥ 0.75）
- **注意** 低置信度内容的审核工作流需要与运营后台集成

## 任务拆分

### Task 1: AI分析服务
- [x] 创建 AnalyzedContent 实体（见技术规范数据库实体部分）
- [x] 创建 AnalyzedContentRepository
- [x] 创建 PeerContentAnalyzerService：
  - 实现 `analyzePeerContent(rawContentId)` 方法
  - 实现 `callThreeModels(content)` 并行调用三模型
  - 复用 QualityValidationService 执行质量验证
  - 复用 ResultAggregatorService 聚合结果
  - 实现 `createAnalyzedContent()` 创建分析记录
  - 实现 `handleLowConfidence()` 低置信度处理

### Task 2: 质量验证集成
- [x] 复用 QualityValidationService.validateQuality()
- [x] 复用 ConsistencyValidator 三层验证逻辑
- [x] 确认验证阈值与AC2一致（结构≥0.9，语义≥0.8，细节≥0.6）
- [x] 复用 ResultAggregatorService.aggregate() 投票选最佳
- [x] 实现置信度等级映射（high/medium/low）

### Task 3: 降级与诊断
- [x] 实现低置信度检测逻辑（overallScore < 0.7 或单模型成功）
- [x] 实现差异点记录（使用 consistencyReport.disagreements）
- [x] 实现运营审核队列集成（创建 Alert 记录）
- [x] 实现通义千问降级方案（单模型结果选择）

### Task 4: 集成与Processor
- [x] 创建 PeerContentAnalysisProcessor
  - 监听 `radar-ai-analysis` 队列
  - 处理 `analyze-peer-content` 任务类型
  - 调用 PeerContentAnalyzerService 执行分析
- [x] 在 PeerCrawlerService (Story 8.2) 中添加入队逻辑：
  - 采集成功后，将任务加入 `radar-ai-analysis` 队列
  - 传递 rawContentId、peerName、content、tenantId
- [x] 实现 AnalyzedContent 创建
  - 分析成功后创建 AnalyzedContent 记录
  - 关联 RawContent 和 AITask
- [x] 触发 Story 8.4 推送生成任务
  - AnalyzedContent 创建成功后，触发推送生成队列任务

## Dev Agent Record

### Implementation Plan
Story 8.3 implements a three-model AI consensus mechanism for analyzing peer content. The implementation follows the red-green-refactor cycle and reuses existing AI infrastructure.

### Key Technical Decisions
1. **Reused existing QualityValidationService** - Avoided reimplementing three-model consensus logic
2. **Reused ResultAggregatorService** - Leveraged existing voting mechanism for best result selection
3. **Extended AnalyzedContent entity** - Added new fields for confidence tracking and model results storage
4. **Added peer_content_review alert type** - New alert type for low-confidence content review workflow

### Files Modified/Created
- `backend/src/database/entities/analyzed-content.entity.ts` - Added Story 8.3 fields
- `backend/src/database/entities/alert.entity.ts` - Added 'peer_content_review' alert type
- `backend/src/modules/radar/services/peer-content-analyzer.service.ts` - New service
- `backend/src/modules/radar/services/peer-content-analyzer.service.spec.ts` - Unit tests (9 tests)
- `backend/src/modules/radar/processors/peer-content-analysis.processor.ts` - New processor
- `backend/src/modules/radar/processors/peer-content-analysis.processor.spec.ts` - Unit tests (8 tests)
- `backend/src/modules/radar/services/peer-crawler.service.ts` - Updated triggerAIAnalysis method
- `backend/src/modules/radar/radar.module.ts` - Registered new services and processor

### Test Results
- PeerContentAnalyzerService: 9/9 tests passing
- PeerContentAnalysisProcessor: 8/8 tests passing
- TypeScript compilation: No errors

### Completion Notes
All acceptance criteria (AC1-AC4) have been implemented:
- AC1: Three-model parallel invocation with 30s timeout
- AC2: Three-layer quality validation with correct thresholds
- AC3: Confidence level calculation (high/medium/low)
- AC4: Low confidence handling with alert creation and Tongyi fallback
