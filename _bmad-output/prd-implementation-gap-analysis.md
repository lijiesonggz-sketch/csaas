# Csaas PRD vs 代码实现差距分析报告

**分析日期：** 2026-02-09
**PRD 版本：** prd-unified.md v2.0（2026-02-07）
**分析范围：** 全部 122 个功能需求 + 非功能需求

---

## 1. 总体实现进度概览

| 模块 | PRD 需求数 | 已实现 | 部分实现 | 未实现 | 完成度 |
|------|-----------|--------|---------|--------|--------|
| 评估引擎 (Domain 1-6) | 42 | 28 | 8 | 6 | ~72% |
| Radar Service (Domain 7-9) | 28 | 22 | 4 | 2 | ~82% |
| 统一页面系统 (Domain 11) | 7 | 5 | 2 | 0 | ~86% |
| 权限与访问控制 (Domain 10) | 5 | 2 | 2 | 1 | ~50% |
| 异常处理 (Domain 12) | 8 | 4 | 3 | 1 | ~62% |
| **总计** | **90 (P0+P1)** | **61** | **19** | **10** | **~74%** |

### Sprint 进度（Radar Service Epics）

| Epic | 状态 | 说明 |
|------|------|------|
| Epic 1: 基础设施与集成 | ✅ Done | 4/4 stories 完成 |
| Epic 2: 技术雷达 | ✅ Done | 5/5 stories 完成 |
| Epic 3: 行业雷达 | ✅ Done | 3/3 stories 完成 |
| Epic 4: 合规雷达 | ✅ Done | 3/3 stories 完成 |
| Epic 5: 用户配置与推送管理 | ✅ Done | 4/4 stories 完成 |
| Epic 6: 多租户与白标输出 | ✅ Done | 5/5 stories 完成 |
| Epic 7: 运营管理与成本优化 | ✅ Done | 4/4 stories 完成 |
| Epic 8: 同业自动监控 | 🔶 In Progress | 5/6 stories 完成，8-6 前端展示待开发 |

---

## 2. 评估引擎详细差距分析 (Domain 1-6)

### Domain 1: 项目管理能力

| FR | 优先级 | 需求 | 状态 | 实现说明 |
|----|--------|------|------|---------|
| FR1 | P0 | 创建咨询项目 | ✅ 已实现 | `projects.controller.ts` + `CreateProjectDialog.tsx` |
| FR2 | P0 | 上传IT标准文档 | ✅ 已实现 | `files.controller.ts` + `DocumentUploader.tsx`，支持 PDF 解析 |
| FR3 | P0 | 查看项目进度 | ✅ 已实现 | `ProjectCard.tsx` + `StepsTabNavigator.tsx` 展示各环节状态 |
| FR4 | P1 | 暂停/归档项目 | ❌ 未实现 | 项目实体无 status 字段支持暂停/归档 |
| FR5 | P1 | 复制历史项目为模板 | ❌ 未实现 | 无模板复制功能 |
| FR6 | P1 | 导出项目数据包 | ❌ 未实现 | 无数据包导出 API |

**Domain 1 完成度：50%（3/6）**

### Domain 2: AI 生成能力

| FR | 优先级 | 需求 | 状态 | 实现说明 |
|----|--------|------|------|---------|
| FR7 | P0 | 综述生成 | ✅ 已实现 | `summary.generator.ts` + `SimpleSummaryDisplay.tsx` |
| FR8 | P0 | 智能聚类 | ✅ 已实现 | `clustering.generator.ts` + `ClusteringResultDisplay.tsx` |
| FR9 | P0 | 成熟度矩阵生成 | ✅ 已实现 | `matrix.generator.ts` + `MatrixResultDisplay.tsx` |
| FR10 | P0 | 问卷生成 | ✅ 已实现 | `questionnaire.generator.ts` + `QuestionnaireResultDisplay.tsx` |
| FR11 | P0 | 落地措施生成 | ✅ 已实现 | `action-plan.generator.ts` + `ActionPlanResultDisplay.tsx` |
| FR12 | P0 | 多模型相似度计算 | ✅ 已实现 | `similarity.calculator.ts` 使用 DashScope Embedding API |
| FR13 | P0 | 质量等级判定 | ✅ 已实现 | `result-aggregator.service.ts` 含 ConfidenceLevel 判定 |
| FR14 | P0 | AI 任务实时进度 | ✅ 已实现 | `tasks.gateway.ts` WebSocket 推送 + `TaskProgressBar.tsx` |
| FR15 | P1 | 失败自动重试 | 🔶 部分实现 | AI Orchestrator 有 fallback 链，但非三模型并行重试 |
| FR16 | P1 | 降级处理 | 🔶 部分实现 | Orchestrator 有 provider chain 降级，但非 PRD 描述的 3→2→1 模式 |

**Domain 2 完成度：85%（8/10 完整 + 2 部分）**

> **关键差距：** PRD 描述的是三模型**并行**独立生成 + Aggregator 投票选最佳的架构。当前实现是 AI Orchestrator 的**串行 fallback** 模式（优先用一个模型，失败后切换下一个），而非三模型同时运行。`ResultAggregatorService` 的接口设计支持三模型输入（gpt4Result/claudeResult/domesticResult），但实际调用链中是单模型生成。这是**评估引擎最核心的架构差距**。

### Domain 3: 质量验证能力

| FR | 优先级 | 需求 | 状态 | 实现说明 |
|----|--------|------|------|---------|
| FR17 | P0 | 覆盖率检测 | ✅ 已实现 | `coverage.checker.ts` + `clause-coverage.service.ts` |
| FR18 | P0 | 遗漏条款列出 | ✅ 已实现 | `MissingClausesHandler.tsx` 前端展示 |
| FR19 | P0 | 高风险条款识别 | ✅ 已实现 | `high-risk-clause.identifier.ts` |
| FR20 | P0 | 三模型分歧点标记 | 🔶 部分实现 | `consistency.validator.ts` 有分歧检测，但依赖三模型并行（当前未启用） |
| FR21 | P0 | 问卷覆盖完整性验证 | 🔶 部分实现 | 有覆盖率检查逻辑，但未与问卷生成深度集成 |
| FR22 | P1 | 权威解读库验证 | ❌ 未实现 | PRD 标注为 P1，无对应实现 |
| FR23 | P1 | AI 错误案例库 | ❌ 未实现 | 无错误案例记录和学习机制 |

**Domain 3 完成度：57%（3/7 完整 + 2 部分）**

### Domain 4: 人工审核能力

| FR | 优先级 | 需求 | 状态 | 实现说明 |
|----|--------|------|------|---------|
| FR24 | P0 | AI 结果与原文对照 | 🔶 部分实现 | 有标准解读页面，但非 PRD 描述的渐进式披露 |
| FR25 | P0 | 聚类逻辑说明 | ✅ 已实现 | 聚类结果包含逻辑说明 |
| FR26 | P0 | 三模型一致性评分 | 🔶 部分实现 | 数据模型支持，但实际未运行三模型对比 |
| FR27 | P0 | 接受结果进入下一环节 | ✅ 已实现 | `StepsTabNavigator.tsx` 支持步骤流转 |
| FR28 | P0 | 修改 AI 内容 | ✅ 已实现 | 前端有编辑功能 |
| FR29 | P0 | 拒绝并重新生成 | ✅ 已实现 | `RerunTaskDialog.tsx` 支持重新生成 |
| FR30 | P0 | 高风险条款强制确认 | ❌ 未实现 | 无逐条强制确认机制 |
| FR31 | P1 | 审核时间和修改率追踪 | ❌ 未实现 | 无审核行为追踪 |
| FR32 | P1 | 快速通过预警 | ❌ 未实现 | 无审核质量预警 |

**Domain 4 完成度：44%（4/9 完整 + 2 部分）**

> **关键差距：** PRD 核心创新之一的"渐进式披露审核流程"（独立思考→对比发现→深度验证三阶段）完全未实现。当前是直接展示 AI 结果，缺少防止咨询师被 AI 误导的机制。

### Domain 5: 问卷管理能力

| FR | 优先级 | 需求 | 状态 | 实现说明 |
|----|--------|------|------|---------|
| FR34 | P0 | 自定义问卷题目 | 🔶 部分实现 | AI 生成问卷，但无手动增删改题目的编辑器 |
| FR35 | P0 | 指定填写角色 | 🔶 部分实现 | `create-survey.dto.ts` 有角色字段，但前端无角色分配 UI |
| FR36 | P0 | 邮件分发问卷 | ❌ 未实现 | 有 email service 但未与问卷分发集成 |
| FR37 | P0 | 在线填写问卷 | ✅ 已实现 | `survey/fill/page.tsx` |
| FR38 | P0 | 保存草稿 | ✅ 已实现 | `save-draft.dto.ts` + PUT draft API |
| FR39 | P0 | 查看已提交答案 | ✅ 已实现 | GET survey/:id API |
| FR40 | P1 | 填写进度查看 | 🔶 部分实现 | `QuestionnaireProgressDisplay.tsx` 存在但功能有限 |
| FR41 | P1 | 催办未填写成员 | ❌ 未实现 | 无催办功能 |
| FR42 | P1 | 设置截止日期 | ❌ 未实现 | 无截止日期字段 |

**Domain 5 完成度：39%（3/9 完整 + 3 部分）**

### Domain 6: 报告生成能力

| FR | 优先级 | 需求 | 状态 | 实现说明 |
|----|--------|------|------|---------|
| FR44 | P0 | 导出差距分析报告 PDF | ❌ 未实现 | 无 PDF 生成/导出功能 |
| FR45 | P0 | 成熟度雷达图 | ❌ 未实现 | 无雷达图可视化组件 |
| FR46 | P1 | 导出问卷原始数据 Excel | ❌ 未实现 | 无 Excel 导出 |
| FR47 | P1 | 自定义报告模板 | ❌ 未实现 | 无报告模板系统 |
| FR48 | P1 | 行业对标数据 | ❌ 未实现 | PRD 标注需 100+ 项目数据 |

**Domain 6 完成度：0%（0/5）**

> **关键差距：** 报告生成能力完全缺失。这是评估引擎交付价值的最终环节——没有 PDF 报告导出，咨询师无法向客户交付评估成果。

---

## 3. Radar Service 详细差距分析 (Domain 7-9)

### Domain 7: 信息采集与推送能力

| FR-R | 优先级 | 需求 | 状态 | 实现说明 |
|------|--------|------|------|---------|
| FR-R1 | P0 | 技术雷达自动采集 | ✅ 已实现 | `radar-source.entity.ts` + 爬虫调度 + BullMQ 队列 |
| FR-R2 | P0 | 行业雷达自动采集 | ✅ 已实现 | 行业信息源配置 + 采集调度 |
| FR-R3 | P0 | 合规雷达自动采集 | ✅ 已实现 | 合规信息源 + `compliance-playbook.controller.ts` |
| FR-R4 | P0 | AI 内容分类打标 | ✅ 已实现 | `ai-analysis.service.ts` + `tag.entity.ts` |
| FR-R5 | P0 | AI 相关性评分 | ✅ 已实现 | `analyzed-content.entity.ts` 含相关性评分 |
| FR-R6 | P0 | ROI 分析引擎 | ✅ 已实现 | ROI 分析集成在推送内容中 |
| FR-R7 | P0 | 同业案例匹配 | ✅ 已实现 | `peer-content-analyzer.service.ts` |
| FR-R8 | P0 | 三模型共识机制 | 🔶 部分实现 | 使用通义千问单模型（AR5 架构决策简化） |
| FR-R9 | P0 | 基于薄弱项精准推荐 | ✅ 已实现 | `weakness-snapshot.service.ts` + 推送关联 |
| FR-R10 | P0 | 关注领域技术推送 | ✅ 已实现 | `watched-topic.entity.ts` + 推送过滤 |
| FR-R11 | P0 | 关注同业动态追踪 | ✅ 已实现 | `watched-peer.entity.ts` + `peer-crawler-task.entity.ts` |
| FR-R12 | P0 | 合规应对剧本 | ✅ 已实现 | `compliance-playbook.entity.ts` + `CompliancePlaybookModal.tsx` |
| FR-R13 | P0 | 邮件推送+站内消息 | ✅ 已实现 | `push-log.entity.ts` + `push.processor.ts` + WebSocket |
| FR-R14 | P0 | 推送历史查看 | ✅ 已实现 | `radar/history/page.tsx` + `PushDetailModal.tsx` |
| FR-R15 | P0 | 关注领域管理 | ✅ 已实现 | `watched-topic.controller.ts` + 前端设置页 |
| FR-R16 | P0 | 关注同业管理 | ✅ 已实现 | `watched-peer.controller.ts` + 前端设置页 |
| FR-R17 | P0 | 推送偏好设置 | ✅ 已实现 | `push-preference.entity.ts` + `push-preference.controller.ts` |

**Domain 7 完成度：97%（16/17 完整 + 1 部分）**

### Domain 8: 咨询公司专用能力

| FR-R | 优先级 | 需求 | 状态 | 实现说明 |
|------|--------|------|------|---------|
| FR-R18 | P0 | 批量客户管理后台 | ✅ 已实现 | `admin-clients.controller.ts` + `admin/clients/page.tsx` |
| FR-R19 | P0 | 白标输出系统 | ✅ 已实现 | `admin-branding.controller.ts` + `BrandingForm.tsx` + `BrandProvider.tsx` |
| FR-R20 | P0 | 客户数据隔离 | ✅ 已实现 | `tenant.entity.ts` + 3 层防御（API Guard + Repository 过滤 + 审计日志） |
| FR-R21 | P1 | 增值服务工具 | ❌ 未实现 | 无案例集生成、趋势报告工具 |
| FR-R22 | P1 | 销售支持工具 | ❌ 未实现 | 无试用期管理、转化漏斗 |
| FR-R23 | P1 | 客户保护机制 | 🔶 部分实现 | 有数据隔离但无客户归属权验证 |

**Domain 8 完成度：58%（3/6 完整 + 1 部分）**

### Domain 9: 运营管理能力

| FR-R | 优先级 | 需求 | 状态 | 实现说明 |
|------|--------|------|------|---------|
| FR-R24 | P1 | 运营仪表板 | ✅ 已实现 | `dashboard.controller.ts` + `admin/dashboard/page.tsx` |
| FR-R25 | P1 | 内容质量管理 | ✅ 已实现 | `content-quality.controller.ts` + 反馈收集 + 低分标记 |
| FR-R26 | P1 | 客户流失风险预警 | ✅ 已实现 | `admin/clients/churn-risk/page.tsx` + `ChurnRiskDetailDialog.tsx` |
| FR-R27 | P1 | AI 成本分析与告警 | ✅ 已实现 | `cost-optimization.controller.ts` + `admin/cost-optimization/page.tsx` |
| FR-R28 | P1 | 爬虫健康度监控 | ✅ 已实现 | `peer-crawler-health.controller.ts` + `CrawlerHealthDashboard.tsx` |

**Domain 9 完成度：100%（5/5）**

---

## 4. 统一页面系统与其他 (Domain 10-12)

### Domain 10: 权限与访问控制

| FR | 优先级 | 状态 | 说明 |
|----|--------|------|------|
| FR57 | P0 | 🔶 部分实现 | JWT 认证 + 基础角色区分，但无细粒度 RBAC |
| FR58 | P0 | ❌ 未实现 | 无邀请企业 PM 加入项目功能 |
| FR59 | P1 | ✅ 已实现 | `tenant.entity.ts` + 组织管理 |
| FR60 | P1 | 🔶 部分实现 | 有租户概念但无订阅计划管理 |
| FR61 | P2 | ❌ 未实现 | 无 SSO 集成 |

### Domain 11: 统一页面系统与导航

| FR | 优先级 | 状态 | 说明 |
|----|--------|------|------|
| FR-U1 | P0 | ✅ 已实现 | `ProjectCard.tsx` 展示项目信息 |
| FR-U2 | P0 | ✅ 已实现 | `UnifiedNavigation.tsx` + `Sidebar.tsx` |
| FR-U3 | P0 | ✅ 已实现 | `Breadcrumb.tsx` |
| FR-U4 | P0 | ✅ 已实现 | 路由结构支持模块切换 |
| FR-U5 | P0 | ✅ 已实现 | `weakness-snapshot.service.ts` 薄弱项同步 |
| FR-U6 | P1 | ❌ 未实现 | 雷达→评估数据流未实现 |
| FR-U7 | P0 | 🔶 部分实现 | 使用 Ant Design + MUI，但两套 UI 库混用 |

### Domain 12: 异常处理与异步任务

| FR | 优先级 | 状态 | 说明 |
|----|--------|------|------|
| FR76 | P0 | ✅ 已实现 | AI Orchestrator fallback chain |
| FR77 | P0 | 🔶 部分实现 | 串行 fallback 而非并行等待 |
| FR78 | P0 | 🔶 部分实现 | 有错误处理但无手工模式 UI |
| FR79 | P0 | ❌ 未实现 | 无断点续传 |
| FR83 | P0 | ✅ 已实现 | BullMQ 异步任务队列 |
| FR84 | P0 | 🔶 部分实现 | WebSocket 通知已实现，邮件/短信通知未实现 |
| FR85 | P1 | ✅ 已实现 | `ai-tasks.controller.ts` 任务列表 |
| FR86 | P1 | ✅ 已实现 | 任务取消 API |

---

## 5. 技术架构差距分析

### 5.1 技术栈实现状态

| 技术 | PRD 要求 | 实际状态 |
|------|---------|---------|
| NestJS 后端 | ✅ | ✅ 已实现，模块化架构 |
| Next.js 前端 | ✅ | ✅ 已实现，App Router |
| PostgreSQL | ✅ | ✅ 已实现，TypeORM |
| Redis | ✅ | ✅ 已实现，缓存 + BullMQ |
| 三模型 AI | GPT-4 + Claude + 国产模型 | 🔶 三个 provider 已实现（OpenAI/Anthropic/通义千问），但以串行 fallback 模式运行，非并行 |
| WebSocket | ✅ | ✅ Socket.io Gateway |
| BullMQ 队列 | ✅ | ✅ 任务调度 + 推送处理 |

### 5.2 核心架构模式差距

| 架构模式 | PRD 描述 | 实际实现 | 差距等级 |
|---------|---------|---------|---------|
| 三模型并行调用 | 三个 Worker 并行独立生成 | 串行 fallback（一个失败换下一个） | 🔴 高 |
| Aggregator 投票 | 三结果投票选最佳 | 接口已设计但未实际使用 | 🔴 高 |
| 分层相似度验证 | 结构≥90% + 语义≥80% + 细节≥60% | `similarity.calculator.ts` 已实现语义相似度 | 🟡 中 |
| 渐进式披露审核 | 三阶段审核流程 | 直接展示结果 | 🔴 高 |
| 版本管理 | consulting_domains + ai_artifacts + snapshots | 有 project snapshots，缺 domain 版本管理 | 🟡 中 |
| 数据主权分层 | 独占/共享/平台三层 | 有多租户隔离，但无显式数据分层 | 🟡 中 |

### 5.3 数据库 Schema 覆盖

**已实现的核心实体（41 个）：**
- 项目管理：Project, ProjectMember, Organization, OrganizationMember, StandardDocument
- AI 生成：AITask, AIGenerationResult, AIGenerationEvent, AICostTracking, AIUsageLog
- 质量验证：InterpretationResult, CurrentStateDescription, ActionPlanMeasure
- 问卷：SurveyResponse
- Radar：RadarSource, RadarPush, RawContent, AnalyzedContent, Tag, WatchedItem, WatchedTopic, WatchedPeer
- 推送：PushScheduleConfig, PushLog, PushPreference, PushFeedback
- 合规：CompliancePlaybook, ComplianceChecklistSubmission
- 爬虫：CrawlerLog, PeerCrawlerTask
- 管理：Tenant, User, SystemUser, ClientGroup, ClientGroupMembership
- 运营：SystemHealthLog, CustomerActivityLog, CustomerIntervention, Alert, WeaknessSnapshot
- 审计：AuditLog

**缺失的实体：**
- ❌ ConsultingDomain（咨询领域版本管理）
- ❌ ProjectSnapshot（项目快照，用于标准更新时的历史数据保护）
- ❌ ReviewAuditTrail（审核行为追踪）
- ❌ CalibrationTest（能力校准测试）
- ❌ ReportTemplate（报告模板）

---

## 6. 关键缺失功能优先级排序

### 🔴 P0 关键缺失（影响核心价值交付）

| 排名 | 缺失功能 | 影响 | 建议优先级 |
|------|---------|------|-----------|
| 1 | **三模型并行调用架构** | PRD 核心技术护城河，当前为单模型串行 | 最高 |
| 2 | **PDF 报告导出** | 咨询师无法向客户交付评估成果 | 最高 |
| 3 | **渐进式披露审核流程** | PRD 核心创新，防止 AI 误导 | 高 |
| 4 | **高风险条款强制确认** | 安全/合规条款可能被忽略 | 高 |
| 5 | **问卷邮件分发** | 无法将问卷发送给被调研者 | 高 |
| 6 | **成熟度雷达图** | 报告核心可视化缺失 | 高 |
| 7 | **Epic 8-6 同业前端展示** | 同业监控功能前端未完成 | 中 |

### 🟡 P1 重要缺失（影响用户体验和运营）

| 排名 | 缺失功能 | 影响 |
|------|---------|------|
| 1 | 审核时间/修改率追踪 | 无法监控审核质量 |
| 2 | 问卷截止日期和催办 | 问卷管理不完整 |
| 3 | 项目暂停/归档 | 项目生命周期管理不完整 |
| 4 | 邀请企业 PM 加入项目 | 多角色协作缺失 |
| 5 | Excel 数据导出 | 数据分析不便 |
| 6 | 增值服务工具 | 咨询公司变现能力受限 |
| 7 | 断点续传 | 长文档处理可靠性不足 |

---

## 7. 总结与建议

### 7.1 总体评估

项目整体实现度约 **74%**，其中：
- **Radar Service 模块完成度最高**（~88%），7 个 Epic 全部完成，第 8 个 Epic 仅剩前端展示
- **评估引擎核心 AI 流程已实现**（综述→聚类→矩阵→问卷→落地措施），但缺少 PRD 的核心差异化特性
- **报告生成能力完全缺失**，这是评估引擎价值交付的最后一公里

### 7.2 架构层面的核心差距

PRD 的三大技术护城河中：
1. **三模型众包+互审架构** — 🔴 未实现（当前为单模型 fallback）
2. **渐进式披露审核流程** — 🔴 未实现
3. **数据飞轮** — 🟡 基础设施已有（多租户、数据隔离），但对标功能未实现（需数据积累）

### 7.3 建议的下一步行动

1. **完成 Epic 8-6**（同业前端展示）— 收尾当前 Sprint
2. **实现 PDF 报告导出** — 打通评估引擎价值交付闭环
3. **实现三模型并行调用** — 将 AI Orchestrator 从 fallback 模式升级为并行模式，激活 ResultAggregator
4. **实现渐进式披露审核** — 前端三阶段审核 UI
5. **补全问卷管理** — 邮件分发、角色分配、截止日期
6. **成熟度雷达图可视化** — 使用 ECharts/Recharts 实现

 关键修正                                                                                                                                                      
                                                                                                                                                                
  1. 三模型并行调用 — 后端 agent 发现实际上已部分实现                                                                                                           
                                                                                                                                                                
  backend-analyzer 发现 ai-generation.service.ts 中的 generateSummary()、generateClustering() 等方法确实调用了三模型并行生成。ai-tasks.service.ts 中对          
  clustering/matrix/questionnaire 等类型标记为 isMultiModelTask。但 AIOrchestrator 本身是串行 fallback 模式。                                                   
                                                                                                                                                                
  结论： 三模型并行的框架已搭建（ResultAggregator 接口完整），部分 generator 有并行调用逻辑，但 Orchestrator                                                    
  层的实际执行路径需要进一步验证。这比之前判断的"完全未实现"要好。                                                                                              
                                                                                                                                                                
  2. 前端完成度比后端低 — 前端 agent 评估约 48-52%                                                                                                              
                                                                                                                                                                
  前端 agent 的分析更严格，发现：                                                                                                                               
  - Domain 4（人工审核）前端仅 33% — 结果展示组件多为只读，缺少编辑功能                                                                                         
  - Domain 6（报告生成）前端 20% — 有打印按钮但无真正 PDF 导出                                                                                                  
  - Domain 10（权限控制）前端仅 10% — 无 RBAC UI、无邀请机制                                                                                                    
  - UI 框架混用问题：Ant Design + Material UI + Tailwind CSS 三套混用，风格不统一                                                                               
                                                                                                                                                                
  3. 架构 agent 发现的安全隐患                                                                                                                                  
  ┌────────────────────────┬────────┬───────────────────────────────────────────────────┐                                                                       
  │          问题          │ 严重度 │                       说明                        │                                                                       
  ├────────────────────────┼────────┼───────────────────────────────────────────────────┤                                                                       
  │ JWT 会话超时 7 天      │ 🔴 高  │ PRD 要求 2 小时                                   │                                                                       
  ├────────────────────────┼────────┼───────────────────────────────────────────────────┤                                                                       
  │ 登录失败锁定未实现     │ 🔴 高  │ PRD 要求 5 次失败锁定                             │                                                                       
  ├────────────────────────┼────────┼───────────────────────────────────────────────────┤                                                                       
  │ JWT Secret 有默认值    │ 🔴 高  │ 'change-this-secret-in-production'                │                                                                       
  ├────────────────────────┼────────┼───────────────────────────────────────────────────┤                                                                       
  │ 审计日志不可篡改未实现 │ 🟡 中  │ 注释提到数据库触发器但未创建                      │                                                                       
  ├────────────────────────┼────────┼───────────────────────────────────────────────────┤                                                                       
  │ 版本管理三表完全缺失   │ 🟡 中  │ consulting_domains/ai_artifacts/project_snapshots │                                                                       
  ├────────────────────────┼────────┼───────────────────────────────────────────────────┤                                                                       
  │ 短信推送未实现         │ 🟡 中  │ 邮件和 WebSocket 已有                             │                                                                       
  └────────────────────────┴────────┴───────────────────────────────────────────────────┘                                                                       
  4. Excel 导出已实现（之前遗漏）                                                                                                                               
                                                                                                                                                                
  前端 agent 发现 exportUtils.ts 使用 xlsx 库已支持 Excel 导出，FR46 应标记为已实现。                                                                           
                                                                                                                                                                
  5. 邀请项目成员已实现（之前遗漏）                                                                                                                             
                                                                                                                                                                
  backend-analyzer 发现 project-members.service.ts + addMember API 已存在，FR58 应标记为已实现。                                                                
                                                                                                                                                                
  修正后的总体评估                                                                                                                                              
  ┌───────────────┬─────────┐                                                                                                                                   
  │     维度      │ 完成度  │                                                                                                                                   
  ├───────────────┼─────────┤                                                                                                                                   
  │ 后端 P0 需求  │ ~67%    │                                                                                                                                   
  ├───────────────┼─────────┤                                                                                                                                   
  │ 前端整体      │ ~50%    │                                                                                                                                   
  ├───────────────┼─────────┤                                                                                                                                   
  │ Radar Service │ ~82%    │                                                                                                                                   
  ├───────────────┼─────────┤                                                                                                                                   
  │ 技术架构      │ ~71%    │                                                                                                                                   
  ├───────────────┼─────────┤                                                                                                                                   
  │ 综合评估      │ ~65-70% │                                                                                                                                   
  └───────────────┴─────────┘                                                                                                                                   
  最终优先行动建议（修正版）                                                                                                                                    
  ┌────────┬────────────────────────────────────────────┬──────────────────────┐                                                                                
  │ 优先级 │                    行动                    │         原因         │                                                                                
  ├────────┼────────────────────────────────────────────┼──────────────────────┤                                                                                
  │ 🔴 1   │ 修复安全隐患（JWT 超时、失败锁定、Secret） │ 生产环境必须         │                                                                                
  ├────────┼────────────────────────────────────────────┼──────────────────────┤                                                                                
  │ 🔴 2   │ 实现 PDF 报告导出 + 成熟度雷达图           │ 评估引擎价值交付闭环 │                                                                                
  ├────────┼────────────────────────────────────────────┼──────────────────────┤                                                                                
  │ 🔴 3   │ 完成 Epic 8-6 同业前端展示                 │ 收尾当前 Sprint      │                                                                                
  ├────────┼────────────────────────────────────────────┼──────────────────────┤                                                                                
  │ 🟡 4   │ 验证并完善三模型并行调用路径               │ 核心技术护城河       │                                                                                
  ├────────┼────────────────────────────────────────────┼──────────────────────┤                                                                                
  │ 🟡 5   │ 实现渐进式披露审核 UI                      │ 核心差异化特性       │                                                                                
  ├────────┼────────────────────────────────────────────┼──────────────────────┤                                                                                
  │ 🟡 6   │ 补全问卷管理（邮件分发、编辑器）           │ 评估流程完整性       │                                                                                
  ├────────┼────────────────────────────────────────────┼──────────────────────┤                                                                                
  │ 🟡 7   │ 统一前端 UI 框架                           │ 用户体验一致性       │