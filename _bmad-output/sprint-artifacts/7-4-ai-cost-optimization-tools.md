---
story_key: 7-4
epic_key: epic-7
title: AI 成本优化工具
status: story-created
priority: high
points: 8
assignee: Dev Agent
created_at: 2026-02-05
---

# Story 7.4: AI 成本优化工具

## User Story

**As a** 平台管理员,
**I want** 实时追踪单客户 AI 调用成本，月均成本 > 500 元时触发告警,
**So that** 我可以优化 AI 使用策略，控制运营成本。

## Background

Epic 7 是 Radar Service 的运营管理与成本优化模块。Story 7.4 是成本优化的核心功能，建立在 Story 7.1（运营仪表板）创建的基础设施之上。

本故事将完善 AI 成本追踪系统:
- **完善 ai_usage_logs 表**: Story 7.1 创建了 placeholder 表,本故事添加完整 schema
- **AI 调用拦截器**: 在所有 AI 调用点自动记录 token 和成本
- **成本计算服务**: 实时计算单客户、按任务类型的成本统计
- **成本告警机制**: 月均成本 > 500 元时自动触发告警
- **成本优化建议**: 基于成本分解提供优化策略
- **批量成本控制**: 支持批量调整高成本客户的推送偏好

## Quick Start for Developers

**核心集成点**:
1. **AI 调用拦截**: 在 `AIAnalysisService` 的所有分析方法上添加 `@UseInterceptors(AIUsageInterceptor)` 和 `@AIUsage(taskType)`
2. **Token 提取**: 拦截器自动从 `AIClientResponse` 提取 `promptTokens` 和 `completionTokens`
3. **成本计算**: 使用通义千问定价 (输入 ¥0.008/1K tokens, 输出 ¥0.02/1K tokens)
4. **告警触发**: Cron job 每日检查，月均成本 > 500 元时创建 Alert 并发邮件

**关键文件**:
- 拦截器: `backend/src/common/interceptors/ai-usage.interceptor.ts`
- 成本服务: `backend/src/modules/admin/cost-optimization/ai-usage.service.ts`
- AI 服务: `backend/src/modules/radar/services/ai-analysis.service.ts` (需添加拦截器)
- 前端页面: `frontend/app/admin/cost-optimization/page.tsx`

### Dependencies on Previous Stories

- **Story 7.1**: 运营仪表板已完成（Alert 实体、placeholder ai_usage_logs 表、EmailService）
- **Story 6.2**: 客户管理后台已完成（Organization 实体、AdminClientsService）
- **Story 5.3**: 推送偏好设置已完成（PushPreference 实体，用于成本优化）

### Architecture Context

**AI 模型选择**: 通义千问（Qwen）单模型
- 成本优势: 相比 GPT-4 约 1/10 成本
- 目标: 单客户月均成本 < 500 元
- 实际预估: < 50 元（留有 10 倍安全余量）

**AI 使用场景** (需要追踪的):
1. **技术雷达 AI 分析**: 内容分类、相关性评分、ROI 计算
2. **行业雷达 AI 分析**: 同业案例匹配、相关性评分
3. **合规雷达 AI 分析**: 风险等级评估、应对剧本生成

## Objectives

1. **完善 ai_usage_logs 数据模型**: 添加 input_tokens, output_tokens, model_name 等字段
2. **实现 AI 调用拦截器**: 自动记录所有 AI 调用的 token 和成本
3. **实现成本计算服务**: 实时统计单客户、按任务类型的成本
4. **实现成本告警机制**: 月均成本 > 500 元时自动触发
5. **提供成本优化建议**: 分析成本分解，提供优化策略
6. **实现批量成本控制**: 支持批量调整高成本客户的推送偏好

## Acceptance Criteria

### AC1: AI 成本追踪数据模型

**Given** ai_usage_logs 表已由 Story 7.1 创建（placeholder schema）
**When** 执行 migration 添加完整字段
**Then** 表结构包含以下字段:
- id (UUID, PK)
- organization_id (UUID, FK → organizations)
- task_type (enum: 'tech_analysis', 'industry_analysis', 'compliance_analysis', 'roi_calculation', 'playbook_generation')
- model_name (string, default: 'qwen-max')
- input_tokens (integer)
- output_tokens (integer)
- cost (decimal, 精确到分)
- request_id (string, 用于调试)
- created_at (timestamp)

**And** 创建索引:
- idx_org_created (organization_id, created_at DESC)
- idx_task_type (task_type)

### AC2: AI 调用拦截器实现

**Given** AI 服务调用通义千问 API
**When** 调用 Qwen API 并返回结果
**Then** 自动记录 AIUsageLog:
- organizationId: 从请求上下文获取
- taskType: 根据调用场景自动标记
- inputTokens: 从 API 响应获取
- outputTokens: 从 API 响应获取
- cost: 根据通义千问定价计算 (输入 token 单价 × inputTokens + 输出 token 单价 × outputTokens)

**通义千问定价** (2026 年参考):
- 输入 token: ¥0.008 / 1000 tokens
- 输出 token: ¥0.02 / 1000 tokens

### AC3: 成本优化页面 - 总览指标

**Given** 管理员访问 /admin/cost-optimization
**When** 页面加载
**Then** 显示成本优化页面标题: "AI 成本优化"
**And** 显示指标卡片:
- 今日总成本
- 本月累计成本
- 单客户平均成本
- 成本超标客户数量

### AC4: 单客户成本计算与告警

**Given** 实时计算单客户月均成本
**When** 查询 ai_usage_logs (WHERE organization_id = X AND created_at >= 本月1日)
**Then** 单客户月均成本 = SUM(cost)
**And** 目标: < 500 元人民币
**And** 如果 > 500 元，触发告警:
- 创建 Alert 记录 (type: 'ai_cost_exceeded', severity: 'high')
- 发送邮件通知管理员
- 客户卡片显示"成本超标"红色标识

### AC5: 成本分解与优化建议

**Given** 管理员查看成本超标客户详情
**When** 点击"查看详情"
**Then** 显示成本分解图表:
- 技术雷达分析任务成本占比
- 行业雷达分析任务成本占比
- 合规雷达分析任务成本占比
- ROI 计算任务成本占比
- 剧本生成任务成本占比

**And** 显示优化建议 (基于成本分解):
- 如果技术雷达占比 > 50%: "建议减少技术雷达推送频率或启用缓存"
- 如果剧本生成占比 > 30%: "建议优化剧本 prompt 长度"
- 如果总推送数量 > 100/月: "建议降低推送数量上限"
- 如果相关性评分 < 3.0 的推送占比 > 20%: "建议启用更严格的相关性过滤"

### AC6: 成本趋势分析

**Given** 成本趋势分析
**When** 渲染成本趋势图
**Then** 显示最近 90 天的总成本趋势图 (折线图)
**And** 显示单客户平均成本趋势图 (折线图)
**And** 按客户分组显示成本排名 (Top 10 高成本客户)
**And** 支持切换时间范围 (7天/30天/90天)
**And** 支持导出成本报告 (CSV/Excel)

### AC7: 批量成本优化

**Given** 管理员选择多个高成本客户 (使用复选框)
**When** 点击"批量优化"
**Then** 显示优化策略选择对话框:
- 降低推送上限 (从当前值减少 30%)
- 启用更严格的相关性过滤 (relevanceScore > 4.0 才推送)
- 禁用低 ROI 技术推送 (roiScore < 3.0 不推送)

**When** 选择优化策略并确认
**Then** 批量更新选中客户的 PushPreference 配置
**And** 提示: "成本优化策略已应用到 X 个客户"
**And** 记录操作日志 (AuditLog)

**优化策略计算逻辑**:
- **降低推送上限**:
  - 字段: `PushPreference.maxPushesPerMonth`
  - 计算: `Math.max(10, Math.floor(currentValue * 0.7))` // 减少 30%，最小保留 10
  - 默认值处理: 如果 currentValue 为 null，使用默认值 100
- **启用更严格的相关性过滤**:
  - 字段: `PushPreference.minRelevanceScore`
  - 计算: 从当前值（默认 3.0）提升到 4.0
- **禁用低 ROI 技术推送**:
  - 字段: `PushPreference.minRoiScore`
  - 计算: 从当前值（默认 2.0）提升到 3.0

## Technical Requirements

### Database Schema

#### Migration: AddAIUsageLogsColumns

```sql
-- 验证并扩展 Story 7.1 创建的 ai_usage_logs 表
-- 如果表不存在，先创建基础表结构
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  task_type VARCHAR(50) NOT NULL,
  cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 添加新字段 (使用 IF NOT EXISTS 避免重复添加)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_usage_logs' AND column_name='model_name') THEN
    ALTER TABLE ai_usage_logs ADD COLUMN model_name VARCHAR(50) NOT NULL DEFAULT 'qwen-plus';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_usage_logs' AND column_name='input_tokens') THEN
    ALTER TABLE ai_usage_logs ADD COLUMN input_tokens INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_usage_logs' AND column_name='output_tokens') THEN
    ALTER TABLE ai_usage_logs ADD COLUMN output_tokens INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_usage_logs' AND column_name='request_id') THEN
    ALTER TABLE ai_usage_logs ADD COLUMN request_id VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_usage_logs' AND column_name='updated_at') THEN
    ALTER TABLE ai_usage_logs ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- 添加索引 (使用 IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_ai_usage_org_created ON ai_usage_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_task_type ON ai_usage_logs(task_type);

-- 添加外键约束 (如果不存在)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_ai_usage_organization') THEN
    ALTER TABLE ai_usage_logs
    ADD CONSTRAINT fk_ai_usage_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMENT ON TABLE ai_usage_logs IS 'AI调用成本追踪日志';
COMMENT ON COLUMN ai_usage_logs.task_type IS '任务类型: tech_analysis, industry_analysis, compliance_analysis, roi_calculation, playbook_generation';
COMMENT ON COLUMN ai_usage_logs.cost IS '成本(元),精确到分';
```

### Backend Implementation

#### 通义千问 SDK 集成

**重要**: 项目已使用 OpenAI SDK 与 DashScope 兼容模式，无需安装额外依赖。

**现有集成**:
- SDK: `openai` (已安装)
- Client: `TongyiClient` (位于 `backend/src/modules/ai-clients/providers/tongyi.client.ts`)
- Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`

**环境变量配置** (`backend/.env`):
```env
TONGYI_API_KEY=your_api_key_here
TONGYI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
TONGYI_MODEL=qwen-plus
```

**API 响应格式示例**:
```typescript
// TongyiClient 返回的响应结构 (AIClientResponse)
interface AIClientResponse {
  content: string;
  promptTokens: number;      // 输入 token 数 (camelCase)
  completionTokens: number;  // 输出 token 数 (camelCase)
  totalTokens: number;
  model: string;
  finishReason: string;
  executionTime: number;
}
```

**Token 提取示例**:
```typescript
// 在 AIAnalysisService 中的实际调用
async analyzeContent(content: string, taskType: AITaskType): Promise<AIClientResponse> {
  try {
    // 调用 TongyiClient (通过 AI Orchestrator)
    const response = await this.aiOrchestrator.generate({
      prompt: content,
      model: 'qwen-plus',
      maxTokens: 2000,
    });

    // 响应格式: { content, promptTokens, completionTokens, totalTokens, ... }
    // 拦截器会自动提取 promptTokens 和 completionTokens
    return response;
  } catch (error) {
    // 降级策略: API 失败时不阻塞业务，但记录错误
    this.logger.error('AI analysis failed', error);
    throw error;
  }
}
```

#### Entity: AIUsageLog (扩展)

```typescript
// backend/src/database/entities/ai-usage-log.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Organization } from './organization.entity';

export enum AITaskType {
  TECH_ANALYSIS = 'tech_analysis',
  INDUSTRY_ANALYSIS = 'industry_analysis',
  COMPLIANCE_ANALYSIS = 'compliance_analysis',
  ROI_CALCULATION = 'roi_calculation',
  PLAYBOOK_GENERATION = 'playbook_generation',
}

@Entity('ai_usage_logs')
export class AIUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({
    type: 'enum',
    enum: AITaskType,
    name: 'task_type',
  })
  taskType: AITaskType;

  @Column({ name: 'model_name', default: 'qwen-max' })
  modelName: string;

  @Column('int', { name: 'input_tokens', default: 0 })
  inputTokens: number;

  @Column('int', { name: 'output_tokens', default: 0 })
  outputTokens: number;

  @Column('decimal', { precision: 10, scale: 2 })
  cost: number;

  @Column({ name: 'request_id', nullable: true })
  requestId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

#### Service: AIUsageService

```typescript
// backend/src/modules/admin/cost-optimization/ai-usage.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AIUsageLog, AITaskType } from '@/database/entities/ai-usage-log.entity';

// 通义千问定价 (2026年)
const QWEN_PRICING = {
  INPUT_TOKEN_PRICE: 0.008 / 1000,  // 元/token
  OUTPUT_TOKEN_PRICE: 0.02 / 1000,  // 元/token
};

@Injectable()
export class AIUsageService {
  constructor(
    @InjectRepository(AIUsageLog)
    private aiUsageLogRepository: Repository<AIUsageLog>,
  ) {}

  /**
   * 记录 AI 调用日志
   */
  async logAIUsage(params: {
    organizationId: string;
    taskType: AITaskType;
    inputTokens: number;
    outputTokens: number;
    modelName?: string;
    requestId?: string;
  }): Promise<void> {
    const cost = this.calculateCost(params.inputTokens, params.outputTokens);

    const log = this.aiUsageLogRepository.create({
      organizationId: params.organizationId,
      taskType: params.taskType,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      cost,
      modelName: params.modelName || 'qwen-max',
      requestId: params.requestId,
    });

    await this.aiUsageLogRepository.save(log);
  }

  /**
   * 计算成本
   */
  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = inputTokens * QWEN_PRICING.INPUT_TOKEN_PRICE;
    const outputCost = outputTokens * QWEN_PRICING.OUTPUT_TOKEN_PRICE;
    return Math.round((inputCost + outputCost) * 100) / 100; // 精确到分
  }

  /**
   * 获取单客户月度成本
   */
  async getOrganizationMonthlyCost(organizationId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await this.aiUsageLogRepository
      .createQueryBuilder('log')
      .select('SUM(log.cost)', 'totalCost')
      .where('log.organizationId = :organizationId', { organizationId })
      .andWhere('log.createdAt >= :startOfMonth', { startOfMonth })
      .getRawOne();

    return parseFloat(result.totalCost || '0');
  }

  /**
   * 获取成本分解（按任务类型）
   */
  async getCostBreakdown(organizationId: string): Promise<Array<{ taskType: AITaskType; cost: number; percentage: number }>> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const results = await this.aiUsageLogRepository
      .createQueryBuilder('log')
      .select('log.taskType', 'taskType')
      .addSelect('SUM(log.cost)', 'cost')
      .where('log.organizationId = :organizationId', { organizationId })
      .andWhere('log.createdAt >= :startOfMonth', { startOfMonth })
      .groupBy('log.taskType')
      .getRawMany();

    const totalCost = results.reduce((sum, r) => sum + parseFloat(r.cost), 0);

    return results.map(r => ({
      taskType: r.taskType,
      cost: parseFloat(r.cost),
      percentage: totalCost > 0 ? (parseFloat(r.cost) / totalCost) * 100 : 0,
    }));
  }

  /**
   * 获取高成本客户 Top N
   */
  async getTopCostOrganizations(limit: number = 10): Promise<Array<{ organizationId: string; cost: number }>> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const results = await this.aiUsageLogRepository
      .createQueryBuilder('log')
      .select('log.organizationId', 'organizationId')
      .addSelect('SUM(log.cost)', 'cost')
      .where('log.createdAt >= :startOfMonth', { startOfMonth })
      .groupBy('log.organizationId')
      .orderBy('cost', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map(r => ({
      organizationId: r.organizationId,
      cost: parseFloat(r.cost),
    }));
  }
}
```

#### Interceptor: AIUsageInterceptor

```typescript
// backend/src/common/interceptors/ai-usage.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AIUsageService } from '@/modules/admin/cost-optimization/ai-usage.service';
import { AITaskType } from '@/database/entities/ai-usage-log.entity';

/**
 * AI 调用拦截器 - 自动记录 AI 使用日志
 *
 * 使用方法:
 * @UseInterceptors(AIUsageInterceptor)
 * @AIUsage(AITaskType.TECH_ANALYSIS)
 * async analyzeContent(...) { ... }
 */
@Injectable()
export class AIUsageInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AIUsageInterceptor.name);

  constructor(private aiUsageService: AIUsageService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const taskType = Reflect.getMetadata('ai_task_type', context.getHandler());

    return next.handle().pipe(
      tap(async (response) => {
        try {
          // 从 AIClientResponse 中提取 token 信息 (camelCase 格式)
          if (response && response.promptTokens !== undefined && response.completionTokens !== undefined) {
            await this.aiUsageService.logAIUsage({
              organizationId: request.user?.organizationId,
              taskType,
              inputTokens: response.promptTokens,      // camelCase
              outputTokens: response.completionTokens, // camelCase
              requestId: response.model || 'unknown',
            });
          }
        } catch (error) {
          // 错误不阻塞业务逻辑，仅记录日志
          this.logger.error('Failed to log AI usage', error);
        }
      }),
    );
  }
}

// Decorator
export const AIUsage = (taskType: AITaskType) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('ai_task_type', taskType, descriptor.value);
    return descriptor;
  };
};
```

### API Endpoints

#### Cost Optimization Controller

```typescript
// backend/src/modules/admin/cost-optimization/cost-optimization.controller.ts
import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { UserRole } from '@/database/entities/user.entity';
import { CostOptimizationService } from './cost-optimization.service';
import { GetCostMetricsDto, GetCostTrendsDto, BatchOptimizeDto } from './dto';

@ApiTags('Cost Optimization')
@Controller('api/v1/admin/cost-optimization')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class CostOptimizationController {
  constructor(private costOptimizationService: CostOptimizationService) {}

  @Get('metrics')
  @ApiOperation({ summary: '获取成本指标概览' })
  @ApiResponse({ status: 200, description: '返回成本指标' })
  async getCostMetrics() {
    return this.costOptimizationService.getCostMetrics();
  }

  @Get('organizations/:id/cost')
  @ApiOperation({ summary: '获取单客户成本详情' })
  async getOrganizationCost(@Param('id') organizationId: string) {
    return this.costOptimizationService.getOrganizationCostDetails(organizationId);
  }

  @Get('trends')
  @ApiOperation({ summary: '获取成本趋势数据' })
  async getCostTrends(@Query() query: GetCostTrendsDto) {
    return this.costOptimizationService.getCostTrends(query.days || 30);
  }

  @Post('batch-optimize')
  @ApiOperation({ summary: '批量成本优化' })
  async batchOptimize(@Body() dto: BatchOptimizeDto) {
    return this.costOptimizationService.batchOptimize(dto);
  }
}
```

### Frontend Implementation

**组件复用说明**:
- **HealthMetricCard**: 已由 Story 7.1 创建
  - 路径: `frontend/components/admin/HealthMetricCard.tsx`
  - 接口: `<HealthMetricCard title="..." value="..." icon={<Icon />} status="normal|warning|error" target="..." />`
  - Status 含义: 'normal' (绿色), 'warning' (黄色), 'error' (红色)

#### Page: /admin/cost-optimization

```typescript
// frontend/app/admin/cost-optimization/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Tabs, Button, Checkbox, message } from 'antd';
import { DollarOutlined, WarningOutlined } from '@ant-design/icons';
import HealthMetricCard from '@/components/admin/HealthMetricCard';
import CostTrendChart from '@/components/admin/CostTrendChart';
import CostBreakdownChart from '@/components/admin/CostBreakdownChart';
import HighCostClientList from '@/components/admin/HighCostClientList';
import BatchOptimizeDialog from '@/components/admin/BatchOptimizeDialog';
import { getCostMetrics, getCostTrends, batchOptimize } from '@/lib/api/cost-optimization';

export default function CostOptimizationPage() {
  const [metrics, setMetrics] = useState(null);
  const [trends, setTrends] = useState([]);
  const [selectedClients, setSelectedClients] = useState([]);
  const [optimizeDialogOpen, setOptimizeDialogOpen] = useState(false);
  const [timeRange, setTimeRange] = useState(30); // 默认30天

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    try {
      const [metricsData, trendsData] = await Promise.all([
        getCostMetrics(),
        getCostTrends(timeRange),
      ]);
      setMetrics(metricsData);
      setTrends(trendsData);
    } catch (error) {
      message.error('加载数据失败');
    }
  };

  const handleBatchOptimize = async (strategy) => {
    try {
      await batchOptimize({
        organizationIds: selectedClients,
        strategy,
      });
      message.success(`成本优化策略已应用到 ${selectedClients.length} 个客户`);
      setSelectedClients([]);
      setOptimizeDialogOpen(false);
      loadData();
    } catch (error) {
      message.error('批量优化失败');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">AI 成本优化</h1>
        <Button
          type="primary"
          disabled={selectedClients.length === 0}
          onClick={() => setOptimizeDialogOpen(true)}
        >
          批量优化 ({selectedClients.length})
        </Button>
      </div>

      {/* 成本指标卡片 */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <HealthMetricCard
            title="今日总成本"
            value={`¥${metrics?.todayCost?.toFixed(2) || '0.00'}`}
            icon={<DollarOutlined />}
            status="normal"
          />
        </Col>
        <Col span={6}>
          <HealthMetricCard
            title="本月累计成本"
            value={`¥${metrics?.monthlyCost?.toFixed(2) || '0.00'}`}
            icon={<DollarOutlined />}
            status="normal"
          />
        </Col>
        <Col span={6}>
          <HealthMetricCard
            title="单客户平均成本"
            value={`¥${metrics?.avgCostPerOrg?.toFixed(2) || '0.00'}`}
            target="< ¥500"
            status={metrics?.avgCostPerOrg > 500 ? 'warning' : 'normal'}
          />
        </Col>
        <Col span={6}>
          <HealthMetricCard
            title="成本超标客户"
            value={metrics?.exceededCount || 0}
            icon={<WarningOutlined />}
            status={metrics?.exceededCount > 0 ? 'error' : 'normal'}
          />
        </Col>
      </Row>

      {/* 成本趋势图 */}
      <Card title="成本趋势" className="mb-6">
        <div className="mb-4">
          <Button.Group>
            <Button onClick={() => setTimeRange(7)} type={timeRange === 7 ? 'primary' : 'default'}>7天</Button>
            <Button onClick={() => setTimeRange(30)} type={timeRange === 30 ? 'primary' : 'default'}>30天</Button>
            <Button onClick={() => setTimeRange(90)} type={timeRange === 90 ? 'primary' : 'default'}>90天</Button>
          </Button.Group>
        </div>
        <CostTrendChart data={trends} />
      </Card>

      {/* 高成本客户列表 */}
      <HighCostClientList
        selectedClients={selectedClients}
        onSelectionChange={setSelectedClients}
      />

      {/* 批量优化对话框 */}
      <BatchOptimizeDialog
        open={optimizeDialogOpen}
        onClose={() => setOptimizeDialogOpen(false)}
        onOptimize={handleBatchOptimize}
        clientCount={selectedClients.length}
      />
    </div>
  );
}
```

## Tasks / Subtasks

### Phase 1: 数据模型扩展 (AC1)
- [ ] **Task 1.1**: 创建 migration 扩展 ai_usage_logs 表
  - [ ] 验证 ai_usage_logs 表是否存在，如不存在则创建基础表
  - [ ] 添加字段: model_name, input_tokens, output_tokens, request_id, updated_at
  - [ ] 创建索引: idx_ai_usage_org_created, idx_ai_usage_task_type
  - [ ] 添加外键约束
  - [ ] 运行 migration: `npm run migration:run`
  - [ ] 验证表结构: `npm run migration:show`
- [ ] **Task 1.2**: 扩展 AIUsageLog Entity
  - [ ] 添加 model_name, input_tokens, output_tokens 字段
  - [ ] 添加 AITaskType enum
  - [ ] 添加关系: @ManyToOne(() => Organization)
- [ ] **Task 1.3**: 创建 AIUsageRepository
  - [ ] 扩展 BaseRepository
  - [ ] 实现 findByOrganizationAndMonth()
  - [ ] 实现 getCostBreakdown()

### Phase 2: AI 调用拦截器 (AC2)
- [ ] **Task 2.1**: 创建 AIUsageService
  - [ ] 实现 logAIUsage() - 记录 AI 调用
  - [ ] 实现 calculateCost() - 计算成本
  - [ ] 实现 getOrganizationMonthlyCost()
  - [ ] 实现 getCostBreakdown()
  - [ ] 实现 getTopCostOrganizations()
- [ ] **Task 2.2**: 创建 AIUsageInterceptor
  - [ ] 实现拦截器逻辑
  - [ ] 从 AIClientResponse 中提取 token 信息 (promptTokens, completionTokens)
  - [ ] 调用 AIUsageService.logAIUsage()
  - [ ] 创建 @AIUsage() decorator
  - [ ] 添加错误处理，确保日志失败不阻塞业务
- [ ] **Task 2.3**: 在 AI 服务中应用拦截器
  - **实际集成位置**: `backend/src/modules/radar/services/ai-analysis.service.ts`
  - **集成方式**: 在 AIAnalysisService 的分析方法上添加拦截器
  - [ ] 在 `analyzeTechContent()` 方法上添加:
    - `@UseInterceptors(AIUsageInterceptor)`
    - `@AIUsage(AITaskType.TECH_ANALYSIS)`
  - [ ] 在 `analyzeIndustryContent()` 方法上添加:
    - `@UseInterceptors(AIUsageInterceptor)`
    - `@AIUsage(AITaskType.INDUSTRY_ANALYSIS)`
  - [ ] 在 `analyzeComplianceContent()` 方法上添加:
    - `@UseInterceptors(AIUsageInterceptor)`
    - `@AIUsage(AITaskType.COMPLIANCE_ANALYSIS)`
  - [ ] 在 `calculateROI()` 方法上添加:
    - `@UseInterceptors(AIUsageInterceptor)`
    - `@AIUsage(AITaskType.ROI_CALCULATION)`
  - [ ] 在 `generatePlaybook()` 方法上添加:
    - `@UseInterceptors(AIUsageInterceptor)`
    - `@AIUsage(AITaskType.PLAYBOOK_GENERATION)`
  - [ ] 确保所有方法返回 AIClientResponse 格式 (包含 promptTokens, completionTokens)
  - [ ] 在 AIAnalysisModule 中注册 AIUsageInterceptor 为 provider

### Phase 3: 成本计算与告警 (AC3, AC4)
- [ ] **Task 3.1**: 创建 CostOptimizationService
  - [ ] 实现 getCostMetrics() - 总览指标
  - [ ] 实现 getOrganizationCostDetails() - 单客户成本详情
  - [ ] 实现 getCostTrends() - 成本趋势
  - [ ] 实现 checkCostExceeded() - 检查成本超标
- [ ] **Task 3.2**: 实现成本告警机制
  - [ ] 创建 cron job: 每日检查成本超标
    - **Cron 表达式**: `@Cron('0 9 * * *')` // 每天上午 9 点执行
    - **去重逻辑**: 检查是否已存在当月的 `ai_cost_exceeded` 告警
      ```typescript
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);

      const existingAlert = await this.alertRepository.findOne({
        where: {
          organizationId,
          type: 'ai_cost_exceeded',
          createdAt: Between(startOfMonth, endOfMonth),
        },
      });
      if (existingAlert) {
        this.logger.debug(`Alert already exists for org ${organizationId} this month`);
        return; // 避免重复告警
      }
      ```
    - **告警频率**: 每个客户每月最多触发一次告警
  - [ ] 如果月均成本 > 500 元，创建 Alert
  - [ ] 发送邮件通知管理员（复用 EmailService）
  - [ ] 标记客户卡片显示"成本超标"
- [ ] **Task 3.3**: 创建 CostOptimizationController
  - [ ] GET /api/v1/admin/cost-optimization/metrics
  - [ ] GET /api/v1/admin/cost-optimization/organizations/:id/cost
  - [ ] GET /api/v1/admin/cost-optimization/trends
  - [ ] 添加 Swagger 文档

### Phase 4: 成本优化建议 (AC5)
- [ ] **Task 4.1**: 实现优化建议逻辑
  - [ ] 分析成本分解，识别高成本任务类型
  - [ ] 生成优化建议 (基于规则引擎)
  - [ ] 返回建议列表和可操作步骤
- [ ] **Task 4.2**: 创建 CostOptimizationSuggestionDto
  - [ ] suggestion: string (建议描述)
  - [ ] impact: 'high' | 'medium' | 'low' (影响程度)
  - [ ] action: string (可操作步骤)

### Phase 5: 成本趋势与报告 (AC6)
- [ ] **Task 5.1**: 实现成本趋势查询
  - [ ] 查询最近 N 天的每日成本
  - [ ] 计算单客户平均成本趋势
  - [ ] 识别 Top 10 高成本客户
- [ ] **Task 5.2**: 实现成本报告导出
  - [ ] 生成 CSV 格式报告
  - [ ] 生成 Excel 格式报告
  - [ ] 包含: 客户名称、成本明细、任务类型分解

### Phase 6: 批量成本控制 (AC7)
- [ ] **Task 6.1**: 创建 AuditLog 实体 (如果不存在)
  - **检查**: 验证 `backend/src/database/entities/audit-log.entity.ts` 是否存在
  - **如果不存在，创建 AuditLog 实体**:
    ```typescript
    @Entity('audit_logs')
    export class AuditLog {
      @PrimaryGeneratedColumn('uuid')
      id: string;

      @Column('uuid', { name: 'user_id' })
      userId: string;

      @Column({ name: 'action' })
      action: string; // 'batch_cost_optimize', 'update_preference', etc.

      @Column({ name: 'target_type' })
      targetType: string; // 'organization', 'user', etc.

      @Column('jsonb', { name: 'target_ids' })
      targetIds: string[]; // 受影响的实体 ID 列表

      @Column('jsonb', { name: 'changes' })
      changes: Record<string, any>; // 变更详情

      @CreateDateColumn({ name: 'created_at' })
      createdAt: Date;
    }
    ```
  - **创建 migration**: `CreateAuditLogsTable.ts`
  - **创建 repository**: `audit-log.repository.ts`
- [ ] **Task 6.2**: 实现批量优化服务
  - [ ] 创建 BatchOptimizeDto
  - [ ] 实现 batchOptimize() 方法
  - [ ] 批量更新 PushPreference 配置
  - [ ] 记录操作日志到 AuditLog
    - **示例**: `{ userId: 'admin-id', action: 'batch_cost_optimize', targetType: 'organization', targetIds: ['org1', 'org2'], changes: { strategy: 'reduce_push_limit', oldValue: 100, newValue: 70 } }`
- [ ] **Task 6.3**: 创建 API endpoint
  - [ ] POST /api/v1/admin/cost-optimization/batch-optimize
  - [ ] Request: { organizationIds: string[], strategy: OptimizeStrategy }
  - [ ] Response: { success: true, appliedCount: number }

### Phase 7: 前端实现 (AC3-AC7)
- [ ] **Task 7.1**: 创建成本优化页面 (/admin/cost-optimization)
  - [ ] 显示成本指标卡片 (复用 HealthMetricCard)
  - [ ] 显示成本趋势图 (使用 Recharts)
  - [ ] 显示高成本客户列表
  - [ ] 实现客户选择（复选框）
- [ ] **Task 7.2**: 创建 CostTrendChart 组件
  - [ ] 折线图: 总成本趋势
  - [ ] 折线图: 单客户平均成本趋势
  - [ ] 支持时间范围切换 (7天/30天/90天)
- [ ] **Task 7.3**: 创建 CostBreakdownChart 组件
  - [ ] 饼图: 按任务类型分解成本
  - [ ] 显示占比百分比
  - [ ] 点击查看详情
- [ ] **Task 7.4**: 创建 HighCostClientList 组件
  - [ ] 显示 Top 10 高成本客户
  - [ ] 支持复选框选择
  - [ ] 显示成本明细、优化建议
  - [ ] 点击查看详情弹窗
- [ ] **Task 7.5**: 创建 BatchOptimizeDialog 组件
  - [ ] 选择优化策略
  - [ ] 预览影响范围
  - [ ] 确认执行
- [ ] **Task 7.6**: 创建 API 客户端函数
  - [ ] getCostMetrics()
  - [ ] getOrganizationCost(id)
  - [ ] getCostTrends(days)
  - [ ] batchOptimize(dto)
- [ ] **Task 7.7**: 集成到管理后台导航
  - [ ] 在 Sidebar 添加"成本优化"链接
  - [ ] 路由配置: /admin/cost-optimization

### Phase 8: 测试与文档
- [ ] **Task 8.1**: 单元测试 (目标: >80% 覆盖率)
  - [ ] AIUsageService 测试
  - [ ] CostOptimizationService 测试
  - [ ] AIUsageInterceptor 测试
- [ ] **Task 8.2**: E2E 测试 (Playwright)
  - [ ] 成本指标显示测试
  - [ ] 成本趋势图渲染测试
  - [ ] 批量优化流程测试
- [ ] **Task 8.3**: 性能测试
  - [ ] 成本计算响应时间 < 2秒
    - **测试场景**: 10 万条 AI 调用记录，10 个并发用户
    - **测试工具**: Apache JMeter 或 k6
    - **性能基准**: P95 响应时间 < 2秒，P99 < 3秒
  - [ ] 趋势查询响应时间 < 3秒
    - **测试场景**: 查询 90 天趋势数据，5 个并发用户
    - **性能基准**: P95 响应时间 < 3秒
- [ ] **Task 8.4**: 文档
  - [ ] 更新 Swagger API 文档
  - [ ] 编写成本优化操作手册
  - [ ] 更新架构文档

## Dev Notes

### Architecture Patterns

1. **Redis 缓存策略**
   - **缓存键命名规范**:
     - 成本指标: `cost:metrics:${date}` (格式: YYYY-MM-DD)
     - 单客户成本: `cost:org:${orgId}:${month}` (格式: YYYY-MM)
     - 成本趋势: `cost:trends:${days}:${date}`
   - **缓存 TTL**:
     - 成本指标: 5 分钟 (300 秒)
     - 单客户成本: 1 小时 (3600 秒)
     - 成本趋势: 10 分钟 (600 秒)
   - **缓存失效策略**:
     - 新增 AI 调用记录时: 清除 `cost:metrics:*` 和 `cost:org:${orgId}:*`
     - 批量优化操作后: 清除所有相关客户的缓存
     - 每日凌晨: 清除前一天的缓存键
   - **实现示例**:
     ```typescript
     // 在 CostOptimizationService 中
     async getCostMetrics(): Promise<CostMetrics> {
       const cacheKey = `cost:metrics:${format(new Date(), 'yyyy-MM-dd')}`;

       // 尝试从缓存获取
       const cached = await this.cacheManager.get<CostMetrics>(cacheKey);
       if (cached) return cached;

       // 计算指标
       const metrics = await this.calculateMetrics();

       // 缓存 5 分钟
       await this.cacheManager.set(cacheKey, metrics, 300);
       return metrics;
     }

     // 在 AIUsageService.logAIUsage() 中清除缓存
     async logAIUsage(params: LogAIUsageParams): Promise<void> {
       await this.aiUsageLogRepository.save(log);

       // 清除相关缓存
       await this.cacheManager.del(`cost:metrics:*`);
       await this.cacheManager.del(`cost:org:${params.organizationId}:*`);
     }
     ```

2. **AI 调用拦截器模式**
   - 使用 NestJS Interceptor 自动记录所有 AI 调用
   - 通过 decorator 标记任务类型: @AIUsage(AITaskType.TECH_ANALYSIS)
   - 从 API 响应中提取 token 信息并计算成本

3. **成本告警机制**
   - 使用 @nestjs/schedule 的 @Cron 装饰器每日检查
   - 复用 Story 7.1 的 Alert 实体
   - 复用 Story 6.2 的 EmailService 发送通知

4. **批量优化策略**
   - 批量更新 PushPreference 配置
   - 记录 AuditLog 便于追溯
   - 使用事务确保原子性

5. **数据库查询优化**
   - **索引策略**:
     - `idx_ai_usage_org_created` (organization_id, created_at DESC) - 用于单客户成本查询
     - `idx_ai_usage_task_type` (task_type) - 用于成本分解查询
   - **查询优化**:
     ```typescript
     // 使用索引优化的月度成本查询
     const result = await this.aiUsageLogRepository
       .createQueryBuilder('log')
       .select('SUM(log.cost)', 'totalCost')
       .where('log.organizationId = :organizationId', { organizationId })
       .andWhere('log.createdAt >= :startOfMonth', { startOfMonth })
       .getRawOne();
     ```
   - **数据归档策略**:
     - 保留最近 6 个月的详细数据
     - 归档 6 个月前的数据到 `ai_usage_logs_archive` 表
     - 保留月度汇总数据用于长期趋势分析
   - **分区策略** (可选，用于大规模数据):
     - 按月分区: `ai_usage_logs_2026_01`, `ai_usage_logs_2026_02`, etc.
     - 自动创建新分区的 cron job

### Testing Requirements

#### Unit Tests

**AIUsageService Tests**:
- Mock AIUsageLogRepository
- Test logAIUsage() records correct cost
- Test calculateCost() with various token counts
- Test getOrganizationMonthlyCost() filters by date
- Test getCostBreakdown() groups by task type
- Test getTopCostOrganizations() returns top N

**CostOptimizationService Tests**:
- Mock AIUsageService, AlertService, PushPreferenceRepository
- Test getCostMetrics() calculates correct metrics
- Test checkCostExceeded() creates alert when > 500
- Test batchOptimize() updates multiple orgs

**AIUsageInterceptor Tests**:
- Test intercept() calls logAIUsage() with correct params
- Test handles missing usage data gracefully

#### Integration Tests

- [ ] AI 调用自动记录日志
- [ ] 成本超标自动触发告警
- [ ] 批量优化成功更新配置

#### E2E Tests (Playwright)

```typescript
// frontend/e2e/cost-optimization.spec.ts
test.describe('[P1] 成本优化功能', () => {
  test('[P1] 应该显示成本指标', async ({ page }) => {
    // GIVEN: 管理员登录
    await loginAsAdmin(page);

    // WHEN: 访问成本优化页面
    await page.goto('/admin/cost-optimization');

    // THEN: 显示成本指标卡片
    await expect(page.locator('text=今日总成本')).toBeVisible();
    await expect(page.locator('text=本月累计成本')).toBeVisible();
    await expect(page.locator('text=单客户平均成本')).toBeVisible();
  });

  test('[P1] 应该渲染成本趋势图', async ({ page }) => {
    // GIVEN: 访问成本优化页面
    await page.goto('/admin/cost-optimization');

    // WHEN: 页面加载
    await page.waitForSelector('.recharts-wrapper');

    // THEN: 显示折线图
    await expect(page.locator('.recharts-line')).toBeVisible();
  });

  test('[P1] 应该支持批量优化', async ({ page }) => {
    // GIVEN: 选择多个高成本客户
    await page.goto('/admin/cost-optimization');
    await page.locator('input[type="checkbox"]').first().check();
    await page.locator('input[type="checkbox"]').nth(1).check();

    // WHEN: 点击批量优化
    await page.click('button:has-text("批量优化")');
    await page.click('button:has-text("确认")');

    // THEN: 显示成功提示
    await expect(page.locator('text=成本优化策略已应用')).toBeVisible();
  });
});
```

### Project Structure Notes

**Backend Structure**:
```
backend/src/
├── database/
│   ├── entities/
│   │   └── ai-usage-log.entity.ts (扩展)
│   ├── repositories/
│   │   └── ai-usage-log.repository.ts (新增)
│   └── migrations/
│       └── 1738700000000-AddAIUsageLogsColumns.ts (新增)
├── modules/admin/
│   └── cost-optimization/
│       ├── cost-optimization.module.ts
│       ├── cost-optimization.controller.ts
│       ├── cost-optimization.service.ts
│       ├── ai-usage.service.ts
│       └── dto/
│           ├── get-cost-metrics.dto.ts
│           ├── get-cost-trends.dto.ts
│           └── batch-optimize.dto.ts
├── common/
│   └── interceptors/
│       └── ai-usage.interceptor.ts (新增)
```

**Frontend Structure**:
```
frontend/
├── app/admin/cost-optimization/
│   └── page.tsx (新增)
├── components/admin/
│   ├── CostTrendChart.tsx (新增)
│   ├── CostBreakdownChart.tsx (新增)
│   ├── HighCostClientList.tsx (新增)
│   └── BatchOptimizeDialog.tsx (新增)
└── lib/api/
    └── cost-optimization.ts (新增)
```

### References

- [Architecture: AI 单模型策略] D:\csaas\_bmad-output\architecture-radar-service.md#Decision 3
- [通义千问定价] https://help.aliyun.com/zh/dashscope/developer-reference/tongyi-qianwen-metering-and-billing
- [Story 7.1: 运营仪表板] D:\csaas\_bmad-output\sprint-artifacts\7-1-operations-dashboard-system-health-monitoring.md
- [Story 5.3: 推送偏好设置] D:\csaas\_bmad-output\sprint-artifacts\5-3-push-preference-settings.md
- [NestJS Interceptors] https://docs.nestjs.com/interceptors
- [NestJS Schedule] https://docs.nestjs.com/techniques/task-scheduling

## Dependencies

### Required (Completed)
- **Story 7.1**: 运营仪表板 ✅ (已完成)
  - Provides: Alert entity, placeholder ai_usage_logs table, EmailService, @Cron pattern
- **Story 6.2**: 客户管理后台 ✅ (已完成)
  - Provides: Organization entity, AdminClientsService
- **Story 5.3**: 推送偏好设置 ✅ (已完成)
  - Provides: PushPreference entity (用于批量优化)

### Existing Infrastructure
- `radar_pushes` table (for ROI correlation analysis)
- Redis (for caching cost metrics)
- Recharts (for charts)
- EmailService (for alerts)

## Success Metrics

- AI 调用记录成功率 >= 99%
- 成本计算准确率 100%
- 成本告警触发延迟 < 1 小时
- 批量优化操作成功率 >= 98%
- 成本趋势查询响应时间 < 3秒
- 单客户月均成本 < 500 元（目标）

## Risks & Mitigation

### Risk 1: AI 调用拦截器失败导致成本未记录
**描述**: 拦截器异常导致部分 AI 调用未记录
**影响**: 高
**缓解措施**:
- 拦截器错误不阻塞业务逻辑
- 记录拦截器错误到日志
- 定期对比 AI 服务日志和成本记录，发现遗漏

### Risk 2: 成本数据表增长
**描述**: ai_usage_logs 表长期积累大量数据
**影响**: 中
**缓解措施**:
- 按日期分区存储
- 归档 6 个月前的详细数据，保留月度汇总
- 定期清理过期数据

### Risk 3: 批量优化误操作
**描述**: 管理员误操作批量优化导致推送配置异常
**影响**: 中
**缓解措施**:
- 操作前二次确认
- 记录详细审计日志
- 提供回滚功能（恢复到优化前配置）

## Notes

### Key Implementation Decisions

1. **完善 ai_usage_logs 表**: 扩展 Story 7.1 的 placeholder 表，添加完整字段
2. **AI 调用拦截器**: 使用 NestJS Interceptor 模式自动记录所有 AI 调用
3. **成本告警**: 复用 Story 7.1 的 Alert 机制，每日 cron job 检查
4. **批量优化**: 直接更新 PushPreference 配置，记录审计日志

### Future Enhancements

- **成本预测**: 基于历史数据预测下月成本
- **成本配额**: 为每个客户设置成本上限
- **成本报表**: 定期生成成本报表并邮件发送
- **A/B 测试**: 对比不同 prompt 策略的成本差异

---

## Dev Agent Record

### Agent Model Used

(待填写)

### Debug Log References

(待填写)

### Completion Notes List

(待填写)

### File List

(待填写)
