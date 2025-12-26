# Tech-Spec: Csaas Phase 2 - AI生成引擎

**Created:** 2025-12-25
**Status:** Ready for Development
**Phase:** Month 2 (Week 5-8)
**Author:** Barry (Quick Flow Solo Dev)
**Dependencies:** Phase 1 (已完成)

---

## Overview

### Problem Statement

Phase 1 已经建立了稳固的三模型并行调用基础设施（BullMQ + AI Orchestrator + 降级策略）。现在需要在此基础上实现**5个核心AI生成功能**，构建完整的咨询成熟度评估流程：

1. **综述生成** - AI自动对标准文档进行2-3页摘要
2. **智能聚类** - AI将标准条款智能分类为12-15个类别
3. **成熟度矩阵** - AI生成5级成熟度 × 聚类维度的矩阵
4. **问卷生成** - AI生成50-100题的调研问卷
5. **落地措施生成** - AI基于问卷结果生成差距分析和改进建议

**核心挑战**：
- 如何设计Prompt工程，确保三个模型输出的结构化数据可比较？
- 如何实现分层相似度验证（结构层90% + 语义层80% + 细节层60%）？
- 如何实现覆盖率检查，确保AI没有遗漏标准文档中的关键条款？
- 如何设计数据模型，存储AI生成的结构化结果（聚类、矩阵、问卷）？

### Solution

**采用渐进式开发策略**：先实现最简单的综述生成（验证Prompt工程和质量验证流程），再逐步实现更复杂的聚类、矩阵、问卷生成。

**技术架构**：
```
前端（Next.js）
  ↓ HTTP POST /api/ai-tasks/generate
后端（Nest.js）
  ↓ 提交任务到BullMQ
AITaskProcessor（已有）
  ↓ 调用 AI Orchestrator
AI Generation Service（新增）
  ├─ SummaryGenerator（综述生成器）
  ├─ ClusteringGenerator（聚类生成器）
  ├─ MatrixGenerator（矩阵生成器）
  ├─ QuestionnaireGenerator（问卷生成器）
  └─ ActionPlanGenerator（措施生成器）
  ↓ 调用三模型并行生成
Quality Validator（新增）
  ├─ SimilarityCalculator（相似度计算）
  ├─ CoverageChecker（覆盖率检查）
  └─ ConsistencyValidator（一致性验证）
  ↓ 质量验证通过后
Result Aggregator（新增）
  └─ 投票选择最佳结果
  ↓ 存储到数据库
ai_generation_results 表
```

**核心设计决策**：
1. **Prompt模板化**：每个生成器维护自己的Prompt模板库，支持变量注入
2. **结构化输出**：强制AI输出JSON格式（使用`response_format: { type: "json_object" }`）
3. **分层验证**：结构层（JSON Schema验证）→ 语义层（Embedding相似度）→ 细节层（文本相似度）
4. **版本控制**：所有AI生成结果包含version字段，支持人工修改后的版本追踪

### Scope (In/Out)

#### ✅ Phase 2 In-Scope

**Week 5: 综述生成 + 质量验证框架**
- [x] 数据模型设计（`ai_generation_results`表）
- [ ] Prompt工程（综述生成模板）
- [ ] 综述生成器实现
- [ ] 质量验证框架（相似度计算、一致性检查）
- [ ] 结果聚合与投票逻辑
- [ ] 前端UI（提交任务、查看进度、查看结果）

**Week 6: 智能聚类 + 覆盖率检查**
- [ ] 聚类生成器实现
- [ ] 结构一致性验证（类别划分逻辑）
- [ ] 覆盖率检查器实现（检测遗漏条款）
- [ ] 高风险条款识别
- [ ] 前端UI（聚类可视化、覆盖率报告）

**Week 7: 成熟度矩阵 + 问卷生成**
- [ ] 矩阵生成器实现
- [ ] 矩阵结构验证（维度、单元格完整性）
- [ ] 问卷生成器实现
- [ ] 问卷覆盖完整性验证
- [ ] 前端UI（矩阵编辑器、问卷预览）

**Week 8: 落地措施生成 + 集成测试**
- [ ] 措施生成器实现
- [ ] 完整流程集成测试（综述 → 聚类 → 矩阵 → 问卷 → 措施）
- [ ] 性能优化（Prompt缓存、并行优化）
- [ ] 单元测试和E2E测试

#### ❌ Phase 2 Out-of-Scope

以下功能留待后续Phase实现：
- ❌ 人工审核界面（渐进式披露、原文对照） → Phase 3
- ❌ 问卷填写系统 → Phase 4
- ❌ 报告导出功能 → Phase 4
- ❌ 行业对标数据 → Growth阶段
- ❌ Prompt自动优化（基于人工审核反馈） → V2.0

---

## Context for Development

### Database Schema

#### ai_generation_results 表

存储AI生成的结构化结果（综述、聚类、矩阵、问卷、措施）。

```sql
CREATE TABLE ai_generation_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES ai_tasks(id) ON DELETE CASCADE,
  generation_type VARCHAR(50) NOT NULL, -- 'SUMMARY', 'CLUSTERING', 'MATRIX', 'QUESTIONNAIRE', 'ACTION_PLAN'

  -- AI生成的原始结果（三模型输出 + 质量验证）
  gpt4_result JSONB,
  claude_result JSONB,
  domestic_result JSONB,

  -- 质量验证结果
  quality_scores JSONB, -- { structural: 0.95, semantic: 0.87, detail: 0.72 }
  consistency_report JSONB, -- { agreements: [...], disagreements: [...] }
  coverage_report JSONB, -- { covered: [...], missing: [...], coverage_rate: 0.96 }

  -- 最终选择的结果（投票后）
  selected_result JSONB, -- 投票获胜的模型结果
  selected_model VARCHAR(20), -- 'gpt4', 'claude', 'domestic'
  confidence_level VARCHAR(20), -- 'HIGH', 'MEDIUM', 'LOW'

  -- 人工审核状态
  review_status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'MODIFIED', 'REJECTED'
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  modified_result JSONB, -- 人工修改后的结果
  review_notes TEXT,

  -- 元数据
  version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- 索引
  INDEX idx_task_id (task_id),
  INDEX idx_generation_type (generation_type),
  INDEX idx_review_status (review_status)
);
```

#### ai_tasks 表更新

添加 `generation_type` 字段以支持不同的生成类型。

```sql
ALTER TABLE ai_tasks ADD COLUMN generation_type VARCHAR(50);
-- 'SUMMARY', 'CLUSTERING', 'MATRIX', 'QUESTIONNAIRE', 'ACTION_PLAN'
```

### Prompt Templates

#### 1. 综述生成 Prompt

```typescript
const SUMMARY_PROMPT_TEMPLATE = `
你是一名资深IT咨询师，专注于IT标准的成熟度评估。请对以下IT标准文档进行综述（2-3页摘要）。

**输入标准文档**：
{{STANDARD_DOCUMENT}}

**输出要求**：
1. **结构要求**：必须输出JSON格式，包含以下字段：
   {
     "title": "标准名称",
     "overview": "标准总体描述（200-300字）",
     "key_areas": [
       { "name": "关键领域1", "description": "描述", "importance": "HIGH/MEDIUM/LOW" },
       { "name": "关键领域2", ... }
     ],
     "scope": "标准适用范围",
     "key_requirements": ["核心要求1", "核心要求2", ...],
     "compliance_level": "合规级别说明"
   }

2. **内容要求**：
   - 提炼标准的核心目标和价值主张
   - 识别5-8个关键领域（如：信息安全策略、访问控制、业务连续性等）
   - 每个关键领域包含简短描述（50-100字）和重要性评级
   - 核心要求不超过10条，每条不超过50字

3. **风格要求**：
   - 使用专业术语，面向IT专业人士
   - 简洁明了，避免冗余
   - 保持中立客观，不加主观评价

**注意**：请严格输出JSON格式，不要包含任何额外的解释或注释。
`;
```

#### 2. 智能聚类 Prompt

```typescript
const CLUSTERING_PROMPT_TEMPLATE = `
你是一名资深IT咨询师，专注于IT标准条款的聚类分析。请对以下标准条款进行智能聚类。

**输入标准文档**：
{{STANDARD_DOCUMENT}}

**输出要求**：
1. **结构要求**：必须输出JSON格式：
   {
     "clusters": [
       {
         "id": "cluster_1",
         "name": "信息安全策略",
         "description": "组织层面的安全策略制定和管理",
         "clauses": [
           { "clause_id": "5.1.1", "clause_text": "原文", "rationale": "聚类理由" },
           ...
         ],
         "importance": "HIGH/MEDIUM/LOW",
         "risk_level": "HIGH/MEDIUM/LOW"
       },
       ...
     ],
     "clustering_logic": "整体聚类逻辑说明（200字内）",
     "coverage_summary": { "total_clauses": 150, "clustered_clauses": 148, "unclustered_clauses": ["6.2.3", "8.1.5"] }
   }

2. **聚类要求**：
   - 生成12-15个聚类类别
   - 确保**100%覆盖**所有标准条款
   - 每个聚类包含5-15个条款
   - 避免条款交叉重复

3. **逻辑要求**：
   - 每个条款必须说明为什么归入此类别（rationale字段）
   - 识别高风险条款（涉及安全、合规、法律责任）
   - 聚类名称清晰易懂，避免模糊术语

**注意**：请严格输出JSON格式，确保覆盖所有条款。
`;
```

#### 3. 成熟度矩阵 Prompt

```typescript
const MATRIX_PROMPT_TEMPLATE = `
你是一名资深IT咨询师，专注于成熟度模型设计。请基于以下聚类结果生成成熟度矩阵。

**输入聚类结果**：
{{CLUSTERING_RESULT}}

**输出要求**：
1. **结构要求**：必须输出JSON格式：
   {
     "matrix": [
       {
         "cluster_name": "信息安全策略",
         "levels": {
           "level_1": { "name": "初始级", "description": "描述", "key_practices": ["关键实践1", ...] },
           "level_2": { "name": "可重复级", ... },
           "level_3": { "name": "已定义级", ... },
           "level_4": { "name": "可管理级", ... },
           "level_5": { "name": "优化级", ... }
         }
       },
       ...
     ],
     "maturity_model_description": "成熟度模型说明"
   }

2. **成熟度定义**：
   - Level 1（初始级）：临时性、混乱的、个人英雄主义
   - Level 2（可重复级）：基本流程建立，可重复执行
   - Level 3（已定义级）：流程标准化、文档化
   - Level 4（可管理级）：流程可度量、可监控
   - Level 5（优化级）：持续改进、自动化

3. **内容要求**：
   - 每个成熟度级别包含3-5个关键实践
   - 实践描述具体、可操作、可验证
   - 保持级别之间的渐进性和逻辑连贯性

**注意**：请严格输出JSON格式，确保每个聚类都有5个成熟度级别。
`;
```

#### 4. 问卷生成 Prompt

```typescript
const QUESTIONNAIRE_PROMPT_TEMPLATE = `
你是一名资深IT咨询师，专注于调研问卷设计。请基于以下成熟度矩阵生成调研问卷。

**输入成熟度矩阵**：
{{MATRIX_RESULT}}

**输出要求**：
1. **结构要求**：必须输出JSON格式：
   {
     "questionnaire": [
       {
         "question_id": "Q001",
         "cluster_name": "信息安全策略",
         "question_text": "您的组织是否制定了正式的信息安全策略文档？",
         "question_type": "SINGLE_CHOICE",
         "options": [
           { "option_id": "A", "text": "没有制定", "score": 1, "level": "level_1" },
           { "option_id": "B", "text": "有但未文档化", "score": 2, "level": "level_2" },
           { "option_id": "C", "text": "已文档化但未发布", "score": 3, "level": "level_3" },
           { "option_id": "D", "text": "已发布并定期审查", "score": 4, "level": "level_4" },
           { "option_id": "E", "text": "已优化并持续改进", "score": 5, "level": "level_5" }
         ],
         "required": true,
         "guidance": "请选择最符合您组织当前状态的选项"
       },
       ...
     ],
     "questionnaire_metadata": {
       "total_questions": 75,
       "estimated_time_minutes": 45,
       "coverage_map": { "信息安全策略": 8, "访问控制": 6, ... }
     }
   }

2. **问卷要求**：
   - 生成50-100题，覆盖所有聚类类别
   - 问题类型：单选题（SINGLE_CHOICE）、多选题（MULTIPLE_CHOICE）、评分题（RATING）
   - 每题必须映射到成熟度级别
   - 选项设计遵循MECE原则（互斥且穷尽）

3. **评分规则**：
   - Level 1选项得1分，Level 2得2分，以此类推
   - 确保每个聚类至少有3-5个问题
   - 高风险领域的问题数量应更多

**注意**：请严格输出JSON格式，确保覆盖所有聚类类别。
`;
```

#### 5. 落地措施生成 Prompt

```typescript
const ACTION_PLAN_PROMPT_TEMPLATE = `
你是一名资深IT咨询师，专注于落地措施设计。请基于以下问卷结果生成改进建议。

**输入问卷结果**：
{{QUESTIONNAIRE_RESULTS}}

**输入成熟度矩阵**：
{{MATRIX_RESULT}}

**输出要求**：
1. **结构要求**：必须输出JSON格式：
   {
     "gap_analysis": [
       {
         "cluster_name": "信息安全策略",
         "current_level": 2,
         "target_level": 4,
         "gap_score": 2,
         "priority": "HIGH/MEDIUM/LOW",
         "key_gaps": ["差距描述1", "差距描述2"]
       },
       ...
     ],
     "action_plans": [
       {
         "cluster_name": "信息安全策略",
         "actions": [
           {
             "action_id": "A001",
             "title": "制定信息安全策略文档",
             "description": "详细描述",
             "target_level": 3,
             "estimated_effort": "40人日",
             "priority": "HIGH",
             "dependencies": [],
             "success_criteria": ["成功标准1", "成功标准2"]
           },
           ...
         ]
       },
       ...
     ],
     "implementation_roadmap": {
       "phase_1": { "duration": "3个月", "actions": ["A001", "A003", ...] },
       "phase_2": { "duration": "6个月", "actions": ["A005", "A008", ...] },
       "phase_3": { "duration": "12个月", "actions": ["A010", ...] }
     }
   }

2. **分析要求**：
   - 识别所有低于目标级别的聚类
   - 计算差距评分（目标级别 - 当前级别）
   - 根据差距和风险确定优先级

3. **措施要求**：
   - 每个差距提供3-5个具体可落地的改进措施
   - 措施包含工作量估算（人日）
   - 措施之间识别依赖关系
   - 制定3阶段实施路线图（短期/中期/长期）

**注意**：请严格输出JSON格式，确保措施具体可落地。
`;
```

### Files to Reference

**Phase 1 已完成的基础设施**：
- `backend/src/modules/ai-orchestrator/ai-orchestrator.service.ts` - AI并行调用编排
- `backend/src/modules/ai-tasks/processors/ai-task.processor.ts` - 任务处理器
- `backend/src/modules/ai-clients/` - 三个AI客户端封装
- `backend/src/modules/ai-tasks/gateways/tasks.gateway.ts` - WebSocket实时进度

**需要新增的文件**：
- `backend/src/modules/ai-generation/` - AI生成服务模块
  - `generators/summary.generator.ts`
  - `generators/clustering.generator.ts`
  - `generators/matrix.generator.ts`
  - `generators/questionnaire.generator.ts`
  - `generators/action-plan.generator.ts`
- `backend/src/modules/quality-validation/` - 质量验证模块
  - `validators/similarity.calculator.ts`
  - `validators/coverage.checker.ts`
  - `validators/consistency.validator.ts`
- `backend/src/modules/result-aggregation/` - 结果聚合模块
  - `aggregator.service.ts`

---

## Implementation Plan

### Tasks

#### Week 5: 综述生成 + 质量验证框架

- [ ] **Task 5.1**: 数据模型设计与Migration
  - 创建`ai_generation_results`表
  - 更新`ai_tasks`表，添加`generation_type`字段
  - 创建TypeORM Entity（AIGenerationResult）
  - **验收**：Migration执行成功，Entity包含所有字段

- [ ] **Task 5.2**: 质量验证框架实现
  - 创建`QualityValidationModule`
  - 实现`SimilarityCalculator`（使用OpenAI Embedding计算余弦相似度）
  - 实现`ConsistencyValidator`（结构层、语义层、细节层验证）
  - 实现`CoverageChecker`（检测遗漏条款）
  - **���收**：输入三个模型结果，输出质量分数和一致性报告

- [ ] **Task 5.3**: 结果聚合器实现
  - 创建`ResultAggregatorService`
  - 实现投票逻辑（选择质量分数最高的结果）
  - 实现置信度评级（HIGH: ≥85%, MEDIUM: 75-85%, LOW: <75%）
  - **验收**：输入三个模型结果，输出投票结果和置信度

- [ ] **Task 5.4**: 综述生成器实现
  - 创建`AIGenerationModule`
  - 实现`SummaryGenerator`
  - 配置综述生成Prompt模板
  - 集成到AITaskProcessor
  - **验收**：提交综述任务，三模型并行生成，返回聚合结果

- [ ] **Task 5.5**: 前端UI - 综述生成
  - 创建综述生成页面（`/projects/[id]/summary`）
  - 实现任务提交表单（上传标准文档）
  - 实现实时进度显示（复用Phase 1 WebSocket）
  - 实现结果展示（JSON可视化 + 一致性评分）
  - **验收**：用户可上传文档、提交任务、查看进度、查看结果

#### Week 6: 智能聚类 + 覆盖率检查

- [ ] **Task 6.1**: 聚类生成器实现
  - 实现`ClusteringGenerator`
  - 配置聚类Prompt模板
  - 实现结构化输出解析（JSON Schema验证）
  - **验收**：输入标准文档，输出12-15个聚类类别

- [ ] **Task 6.2**: 覆盖率检查器实现
  - 实现`CoverageChecker`
  - 提取标准文档所有条款ID（使用正则表达式）
  - 比对聚类结果，识别遗漏条款
  - 生成覆盖率报告
  - **验收**：覆盖率≥95%，精确列出遗漏条款

- [ ] **Task 6.3**: 高风险条款识别
  - 实现关键词匹配（安全、合规、法律、数据保护、访问控制）
  - 实现标准章节匹配（ISO 27001第5-8章、COBIT第3章）
  - 标记高风险条款
  - **验收**：自动识别所有高风险条款，标记在聚类结果中

- [ ] **Task 6.4**: 前端UI - 聚类可视化
  - 创建聚类页面（`/projects/[id]/clustering`）
  - 实现树形结构展示（类别 → 条款）
  - 实现覆盖率报告展示（柱状图 + 遗漏列表）
  - 实现高风险条款高亮
  - **验收**：用户可查看聚类结构、覆盖率、高风险条款

#### Week 7: 成熟度矩阵 + 问卷生成

- [ ] **Task 7.1**: 矩阵生成器实现
  - 实现`MatrixGenerator`
  - 配置矩阵Prompt模板
  - 实现矩阵结构验证（5级 × N个聚类）
  - **验收**：输入聚类结果，输出完整成熟度矩阵

- [ ] **Task 7.2**: 问卷生成器实现
  - 实现`QuestionnaireGenerator`
  - 配置问卷Prompt模板
  - 实现问卷覆盖完整性验证（每个聚类至少3题）
  - **验收**：输入矩阵结果,输出50-100题问卷

- [ ] **Task 7.3**: 前端UI - 矩阵编辑器
  - 创建矩阵页面（`/projects/[id]/matrix`）
  - 实现表格展示（行：聚类，列：成熟度级别）
  - 实现单元格编辑功能
  - **验收**：用户可查看矩阵、编辑单元格内容

- [ ] **Task 7.4**: 前端UI - 问卷预览
  - 创建问卷页面（`/projects/[id]/questionnaire`）
  - 实现问卷题目列表展示
  - 实现题目编辑功能（修改题目、选项、评分）
  - 实现覆盖率统计（每个聚类的题目数量）
  - **验收**：用户可预览问卷、编辑题目、查看覆盖率

#### Week 8: 落地措施生成 + 集成测试

- [ ] **Task 8.1**: 措施生成器实现
  - 实现`ActionPlanGenerator`
  - 配置措施Prompt模板
  - 实现差距分析逻辑
  - 实现实施路线图生成
  - **验收**：输入问卷结果，输出差距分析和改进措施

- [ ] **Task 8.2**: 完整流程集成测试
  - 端到端测试：综述 → 聚类 → 矩阵 → 问卷 → 措施
  - 测试降级策略（模拟单个模型失败）
  - 测试质量验证（模拟低一致性场景）
  - **验收**：完整流程可通过，所有降级场景正常处理

- [ ] **Task 8.3**: 性能优化
  - 实现Prompt缓存（相同文档不重复embedding）
  - 优化并行度（综述和聚类可并行执行）
  - 添加结果缓存（Redis缓存AI生成结果）
  - **验收**：任务执行时间减少30%

- [ ] **Task 8.4**: 单元测试与E2E测试
  - 编写各Generator单元测试
  - 编写质量验证模块单元测试
  - 编写完整流程E2E测试
  - 覆盖率目标：核心模块 ≥ 60%
  - **验收**：所有测试通过，覆盖率达标

### Acceptance Criteria

#### 功能验收

- [ ] **AC-F1**: 综述生成功能可用
  - **Given** 主咨询师上传ISO 27001标准文档（PDF）
  - **When** 提交综述生成任务
  - **Then** 三模型并行生成综述，返回2-3页摘要，一致性≥80%

- [ ] **AC-F2**: 聚类生成功能可用，覆盖率≥95%
  - **Given** 主咨询师上传标准文档
  - **When** 提交聚类任务
  - **Then** 三模型生成12-15个聚类类别，覆盖率≥95%，遗漏条款≤5%

- [ ] **AC-F3**: 成熟度矩阵生成功能可用
  - **Given** 已完成聚类
  - **When** 提交矩阵生成任务
  - **Then** 返回5级 × N个聚类的完整矩阵，每个单元格有3-5个关键实践

- [ ] **AC-F4**: 问卷生成功能可用，覆盖完整性100%
  - **Given** 已完成矩阵生成
  - **When** 提交问卷生成任务
  - **Then** 返回50-100题问卷，每个聚类至少3题，覆盖率100%

- [ ] **AC-F5**: 落地措施生成功能可用
  - **Given** 已完成问卷填写（模拟数据）
  - **When** 提交措施生成任务
  - **Then** 返回差距分析、改进措施清单、实施路线图

#### 质量验收

- [ ] **AC-Q1**: 三模型一致性≥80%（80%的任务）
  - **测试方法**：提交10个真实标准文档
  - **验收标准**：至少8个任务的语义一致性≥80%

- [ ] **AC-Q2**: 高风险条款识别准确率≥90%
  - **测试方法**：人工标注100个条款（50个高风险 + 50个普通）
  - **验收标准**：AI识别准确率≥90%

- [ ] **AC-Q3**: 聚类覆盖率≥95%（所有任务）
  - **测试方法**：提交5个标准文档，人工检查覆盖率
  - **验收标准**：所有任务覆盖率≥95%

#### 性能验收

- [ ] **AC-P1**: 综述生成时间P50 ≤ 5分钟，P95 ≤ 10分钟
  - **测试方法**：提交10个任务，记录完成时间
  - **验收标准**：中位数 ≤ 5分钟，95分位 ≤ 10分钟

- [ ] **AC-P2**: 聚类生成时间P50 ≤ 15分钟，P95 ≤ 25分钟
  - **测试方法**：提交10个任务，记录完成时间
  - **验收标准**：中位数 ≤ 15分钟，95分位 ≤ 25分钟

- [ ] **AC-P3**: 完整流程（5个环节）时间P50 ≤ 45分钟，P95 ≤ 70分钟
  - **测试方法**：端到端执行5个完整流程
  - **验收标准**：中位数 ≤ 45分钟，95分位 ≤ 70分钟

---

## Additional Context

### Technical Decisions

#### TD-007: 强制JSON输出 vs 自然语言解析

**决策**：使用OpenAI的`response_format: { type: "json_object" }`强制JSON输出

**理由**：
- ✅ 可靠性：避免自然语言解析的不确定性（正则表达式、NLP解析都容易失败）
- ✅ 结构化：直接得到结构化数据，方便质量验证和前端展示
- ⚠️ Prompt复杂度：需要在Prompt中详细定义JSON Schema

**权衡**：
- ❌ 放弃：更自然的对话式交互（但结构化输出更重要）
- ❌ 风险：模型可能输出不完整的JSON（通过Prompt优化缓解）

#### TD-008: 相似度计算方法

**决策**：使用OpenAI Embedding + 余弦相似度

**理由**：
- ✅ 语义理解：Embedding能捕捉深层语义，而非简单文本匹配
- ✅ 可比性：三模型输出都转为Embedding，统一比较
- ✅ 成本可控：Embedding API成本低（$0.0001/1K tokens）

**权衡**：
- ⚠️ 延迟：需要额外API调用（通过缓存优化）
- ❌ 放弃：纯文本相似度（如Levenshtein距离）- 无法理解语义

#### TD-009: 覆盖率检查策略

**决策**：基于条款ID的精确匹配 + 语义匹配双重验证

**理由**：
- ✅ 精确性：条款ID匹配可精确定位遗漏
- ✅ 容错性：语义匹配处理AI提取条款ID错误的情况
- ⚠️ 复杂度：需要维护两套检查逻辑

**实现**：
1. 提取标准文档所有条款ID（正则表达式：`\d+\.\d+\.\d+`）
2. 提取聚类结果中的条款ID
3. 精确匹配：计算集合差异
4. 语义匹配：对遗漏条款，检查是否有语义相似的条款（相似度≥0.9）

#### TD-010: 人工修改版本控制

**决策**：使用`version`字段跟踪版本，`modified_result`存储人工修改

**理由**：
- ✅ 可追溯：保留AI原始结果和人工修改历史
- ✅ 数据飞轮：人工修改可用于Prompt优化和模型微调
- ✅ 审计：满足合规要求（记录谁在何时修改了什么）

**版本规则**：
- Version 1：AI生成的原始结果
- Version 2+：人工修改后的版本
- `modified_result`为NULL时，使用`selected_result`

### Dependencies

**npm依赖（新增）**：
```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1",           // PDF解析
    "mammoth": "^1.6.0",             // Word文档解析
    "jsondiffpatch": "^0.5.0",       // JSON差异比较
    "ajv": "^8.12.0"                 // JSON Schema验证
  }
}
```

### Testing Strategy

**单元测试**：
- 每个Generator独立测试（Mock AI客户端）
- 质量验证模块测试（提供固定输入，验证输出）
- 覆盖率目标：≥60%

**集成测试**：
- 完整流程测试（使用真实AI API，测试环境）
- 降级策略测试（模拟API失败）
- 质量验证测试（模拟低一致性场景）

**E2E测试**：
- 使用Playwright测试前端完整流程
- 覆盖核心用户旅程：上传文档 → 生成综述 → 生成聚类 → 生成矩阵 → 生成问卷 → 生成措施

### Notes

**技术风险与缓解**：

1. **风险：Prompt工程难度高，AI输出不符合预期**
   - **缓解**：使用Few-Shot示例 + JSON Schema约束 + 多次迭代优化
   - **Plan B**：人工兜底模式（AI辅助检索，人工生成）

2. **风险：三模型一致性低于80%**
   - **缓解**：优化Prompt（强调结构化输出） + 降低细节层权重
   - **Plan B**：人工审核介入，标记低置信度结果

3. **风险：覆盖率检查不准确（条款ID提取失败）**
   - **缓解**：多种正则表达式策略 + 语义匹配兜底
   - **Plan B**：人工复查覆盖率

4. **风险：AI生成时间过长（影响用户体验）**
   - **缓解**：并行优化 + Prompt���存 + 结果缓存
   - **Plan B**：异步执行 + 邮件通知

**开发优先级**：
1. 先��成质量验证框架（阻塞所有Generator）
2. 再完成综述生成（最简单，验证框架可用性）
3. 逐步完成聚类、矩阵、问卷、措施（复杂度递增）

---

**Tech-Spec生成时间**: 2025-12-25
**预计开发时间**: 4周（2025-02-01 ~ 2025-02-28）
**下一阶段**: Phase 3 - 人工审核界面（Month 3）
