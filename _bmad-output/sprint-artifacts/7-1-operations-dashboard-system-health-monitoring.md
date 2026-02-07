---
story_key: 7-1
epic_key: epic-7
title: 运营仪表板 - 系统健康监控
status: ready
priority: high
points: 8
assignee: TBD
created_at: 2026-02-04
---

# Story 7.1: 运营仪表板 - 系统健康监控

## User Story

**As a** 平台管理员,
**I want** 监控系统健康状态（可用性、推送成功率、AI 共识一致性）,
**So that** 我可以及时发现异常，确保服务稳定运行。

## Background

Epic 7 是 Radar Service 的运营管理与成本优化模块，Story 7.1 作为第一个故事，聚焦于系统健康监控。平台管理员需要一个集中的运营仪表板来实时监控系统的关键健康指标，包括：

- **系统可用性**: 确保服务稳定运行，达到 MVP 阶段 ≥99.5% 的目标
- **推送成功率**: 监控推送消息的送达率，目标 ≥98%
- **AI 成本监控**: 追踪 AI 调用成本，确保单客户月均成本 < 500 元
- **客户活跃度**: 监控客户使用情况，识别活跃和不活跃客户
- **异常告警**: 及时发现爬虫失败、AI 成本超标、客户流失风险等异常

本故事将建立运营仪表板的基础设施，为后续的内容质量管理（Story 7.2）、客户管理（Story 7.3）和成本优化（Story 7.4）提供数据支撑。

## Objectives

1. **实现运营仪表板页面**: 创建 `/admin/dashboard` 页面，展示系统健康指标
2. **系统健康指标计算**: 实现可用性、推送成功率、AI 成本的实时计算
3. **异常告警机制**: 建立告警检测和通知系统
4. **趋势分析可视化**: 提供 7/30/90 天的健康指标趋势图表
5. **实时数据更新**: 支持仪表板数据的自动刷新

## Acceptance Criteria

### AC1: 运营仪表板页面基础结构
**Given** 管理员访问 /admin/dashboard
**When** 页面加载
**Then** 显示运营仪表板页面标题："运营仪表板"
**And** 显示四个核心指标卡片：可用性、推送成功率、AI 成本、客户活跃度
**And** 显示异常告警区域
**And** 显示健康趋势图表区域

### AC2: 系统可用性监控
**Given** 系统健康指标计算
**When** 实时计算可用性
**Then** 可用性 = (总运行时间 - 停机时间) / 总运行时间 × 100%
**And** 目标：MVP 阶段 ≥99.5%，Growth 阶段 ≥99.9%
**And** 显示当前可用性和目标对比
**And** 如果 < 99.5%，显示红色告警

### AC3: 推送成功率监控
**Given** 推送成功率计算
**When** 实时计算推送成功率
**Then** 推送成功率 = 成功推送数 / 总推送数 × 100%
**And** 目标：≥98%
**And** 显示当前推送成功率和目标对比
**And** 如果 < 98%，显示红色告警
**And** 显示今日推送统计：总数、成功数、失败数

### AC4: AI 成本监控
**Given** AI 成本监控
**When** 实时计算 AI 成本
**Then** 显示今日 AI 成本、本月累计成本、单客户平均成本
**And** 目标：单客户月均成本 < 500 元
**And** 如果超标，显示红色告警
**And** 显示成本趋势（与上月对比）

### AC5: 客户活跃度监控
**Given** 客户活跃度计算
**When** 实时计算客户活跃度
**Then** 显示总客户数、活跃客户数、活跃率
**And** 活跃定义：最近 7 天内有登录或查看推送
**And** 显示客户活跃度分布：高活跃（>85%）、中活跃（60-85%）、低活跃（<60%）
**And** 目标：活跃率 > 70%

### AC6: 异常告警显示
**Given** 检测到异常
**When** 异常告警显示
**Then** 显示告警列表：爬虫失败、AI 成本超标、客户流失风险、推送失败率高
**And** 每条告警包含：告警类型、严重程度（高/中/低）、发生时间、描述、快速操作按钮
**And** 支持标记告警为"已处理"
**And** 未处理告警数量显示在页面顶部

### AC7: 健康趋势图表
**Given** 系统健康趋势图
**When** 渲染趋势图
**Then** 显示最近 30 天的可用性趋势、推送成功率趋势、AI 成本趋势
**And** 使用折线图可视化
**And** 支持切换时间范围（7天/30天/90天）
**And** 支持导出图表数据（CSV）

### AC8: 实时数据更新 (Fix #8 - Real-time Update Implementation)
**Given** 仪表板页面已打开
**When** 数据发生变化
**Then** 每 30 秒自动刷新指标数据
**And** 显示最后更新时间
**And** 支持手动刷新按钮
**Implementation**: Use React useEffect + setInterval for 30s polling:
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    fetchHealthMetrics();
  }, 30000);
  return () => clearInterval(interval);
}, []);
```

## Technical Requirements

### API Endpoints

#### 系统健康指标
- `GET /api/v1/admin/dashboard/health` - 获取系统健康指标
  - Response:
    ```json
    {
      "availability": {
        "current": 99.7,
        "target": 99.5,
        "status": "healthy",
        "uptime": 43200,
        "downtime": 129.6
      },
      "pushSuccessRate": {
        "current": 98.5,
        "target": 98.0,
        "status": "healthy",
        "totalPushes": 1000,
        "successfulPushes": 985,
        "failedPushes": 15
      },
      "aiCost": {
        "today": 150.5,
        "thisMonth": 4500.0,
        "avgPerClient": 450.0,
        "target": 500.0,
        "status": "healthy"
      },
      "customerActivity": {
        "totalCustomers": 10,
        "activeCustomers": 8,
        "activityRate": 80.0,
        "target": 70.0,
        "status": "healthy"
      }
    }
    ```

#### 异常告警
- `GET /api/v1/admin/dashboard/alerts` - 获取异常告警列表
  - Query params: `?status=unresolved&severity=high`
  - Response:
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "type": "crawler_failure",
          "severity": "high",
          "message": "技术雷达爬虫连续失败 3 次",
          "occurredAt": "2026-02-04T10:00:00Z",
          "status": "unresolved",
          "metadata": {
            "source": "GARTNER",
            "failureCount": 3
          }
        }
      ],
      "meta": {
        "total": 5,
        "unresolved": 3
      }
    }
    ```

- `PUT /api/v1/admin/dashboard/alerts/:id/resolve` - 标记告警为已处理

#### 健康趋势数据
- `GET /api/v1/admin/dashboard/trends` - 获取健康趋势数据
  - Query params: `?metric=availability&range=30d`
  - Response:
    ```json
    {
      "metric": "availability",
      "range": "30d",
      "data": [
        {
          "date": "2026-01-05",
          "value": 99.8
        },
        {
          "date": "2026-01-06",
          "value": 99.6
        }
      ]
    }
    ```

### Database Schema

#### Entity Files (Fix #1 - Missing Entity Definitions)
**Create TypeORM entities** instead of raw SQL:
- `backend/src/database/entities/system-health-log.entity.ts`
- `backend/src/database/entities/alert.entity.ts`
- Register in `backend/src/database/entities/index.ts`

#### SystemHealthLog Entity
```typescript
@Entity('system_health_logs')
export class SystemHealthLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'metric_type' })
  metricType: 'availability' | 'push_success_rate' | 'ai_cost';

  @Column('decimal', { precision: 10, scale: 2 })
  metricValue: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  targetValue: number;

  @Column()
  status: 'healthy' | 'warning' | 'critical';

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'recorded_at' })
  recordedAt: Date;

  @Index()
  metricType: string;

  @Index()
  recordedAt: Date;
}
```

#### Alert Entity
```typescript
@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'alert_type' })
  alertType: 'crawler_failure' | 'ai_cost_exceeded' | 'customer_churn_risk' | 'push_failure_high';

  @Column()
  severity: 'high' | 'medium' | 'low';

  @Column('text')
  message: string;

  @Column({ default: 'unresolved' })
  status: 'unresolved' | 'resolved' | 'ignored';

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'occurred_at' })
  occurredAt: Date;

  @Column({ name: 'resolved_at', nullable: true })
  resolvedAt: Date;

  @Column({ name: 'resolved_by', nullable: true })
  resolvedBy: string;

  @Index()
  status: string;

  @Index()
  severity: string;

  @Index()
  occurredAt: Date;
}
```

#### AI Usage Logs Placeholder (Fix #5 - Circular Dependency)
**Note**: Create placeholder table now, full implementation in Story 7.4:
```sql
CREATE TABLE ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID,
  task_type VARCHAR(50),
  cost DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Story 7.4 will add: input_tokens, output_tokens, model_name, etc.
```

### Backend Implementation

#### Module Structure (Fix #3 - Module Registration)
**File**: `backend/src/modules/admin/admin.module.ts`
```typescript
import { SystemHealthLog } from '../../database/entities/system-health-log.entity';
import { Alert } from '../../database/entities/alert.entity';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemHealthLog,  // Add
      Alert,            // Add
      Organization,
      // ... existing entities
    ]),
    ScheduleModule.forRoot(),  // Add for cron jobs
    OrganizationsModule,
  ],
  // ... controllers and providers
})
```

#### Repository Pattern (Fix #2 - Missing Repositories)
**Create repositories**:
- `backend/src/database/repositories/system-health-log.repository.ts`
- `backend/src/database/repositories/alert.repository.ts`

```typescript
// system-health-log.repository.ts
@Injectable()
export class SystemHealthLogRepository extends BaseRepository<SystemHealthLog> {
  constructor(
    @InjectRepository(SystemHealthLog)
    private repository: Repository<SystemHealthLog>,
  ) {
    super(repository);
  }

  async findByMetricType(metricType: string, range: string): Promise<SystemHealthLog[]> {
    // Query with date range filter
  }
}
```

**Note**: Use BaseRepository (not BaseTenantRepository) as these are platform-level entities.

#### Services

**DashboardService** (`backend/src/modules/admin/dashboard/dashboard.service.ts`)

**Dependencies (Fix #12 - Integration with Existing Services)**:
```typescript
constructor(
  private readonly systemHealthLogRepo: SystemHealthLogRepository,
  private readonly alertRepo: AlertRepository,
  private readonly radarPushRepo: RadarPushRepository,  // Existing
  private readonly organizationRepo: OrganizationRepository,  // Existing
  @Inject(CACHE_MANAGER) private cacheManager: Cache,  // For Redis
) {}
```

**Methods**:
- `getHealthMetrics()`: 计算系统健康指标
  - **Performance (Fix #11)**: Check Redis cache first (key: `dashboard:health`, TTL: 5 min)
  - **Error Handling (Fix #9)**: Wrap in try-catch, throw InternalServerErrorException
  ```typescript
  async getHealthMetrics() {
    try {
      const cached = await this.cacheManager.get('dashboard:health');
      if (cached) return cached;

      const metrics = {
        availability: await this.calculateAvailability(),
        pushSuccessRate: await this.calculatePushSuccessRate(),
        aiCost: await this.calculateAICost(),
        customerActivity: await this.calculateCustomerActivity(),
      };

      await this.cacheManager.set('dashboard:health', metrics, 300); // 5 min TTL
      return metrics;
    } catch (error) {
      throw new InternalServerErrorException('Failed to calculate health metrics');
    }
  }
  ```

- `calculateAvailability()`: Query SystemHealthLog for uptime/downtime
- `calculatePushSuccessRate()`:
  - **Integration (Fix #12)**: Use RadarPushRepository
  ```typescript
  const total = await this.radarPushRepo.count();
  const successful = await this.radarPushRepo.count({ where: { status: 'sent' } });
  const failed = await this.radarPushRepo.count({ where: { status: 'failed' } });
  return { current: (successful / total) * 100, total, successful, failed };
  ```

- `calculateAICost()`:
  - **Fix #5 - Circular Dependency**: Query placeholder ai_usage_logs table
  ```typescript
  // Query ai_usage_logs table (created in this story, populated in Story 7.4)
  const result = await this.dataSource.query(`
    SELECT
      SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN cost ELSE 0 END) as today,
      SUM(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN cost ELSE 0 END) as this_month
    FROM ai_usage_logs
  `);
  // Return mock data if table empty
  return result || { today: 0, thisMonth: 0, avgPerClient: 0 };
  ```

- `calculateCustomerActivity()`:
  - **Integration (Fix #12)**: Use OrganizationRepository
  ```typescript
  const total = await this.organizationRepo.count();
  const active = await this.organizationRepo.count({
    where: { lastActiveAt: MoreThan(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) }
  });
  return { totalCustomers: total, activeCustomers: active, activityRate: (active / total) * 100 };
  ```

**AlertService** (`backend/src/modules/admin/dashboard/alert.service.ts`)
- `getAlerts(filters)`:
  - **Error Handling (Fix #9)**: Validate filters
  ```typescript
  if (filters.severity && !['high', 'medium', 'low'].includes(filters.severity)) {
    throw new BadRequestException('Invalid severity filter');
  }
  ```
- `createAlert(alertData)`:
  - **Error Handling (Fix #9)**: Implement 1-hour deduplication
  ```typescript
  const existing = await this.alertRepo.findOne({
    where: {
      alertType: alertData.alertType,
      occurredAt: MoreThan(new Date(Date.now() - 60 * 60 * 1000)),
    },
  });
  if (existing) return existing; // Deduplicate
  ```
- `resolveAlert(alertId, userId)`:
  - **Error Handling (Fix #9)**: Throw NotFoundException
  ```typescript
  const alert = await this.alertRepo.findOne({ where: { id: alertId } });
  if (!alert) throw new NotFoundException('Alert not found');
  ```

**HealthMonitorService** (`backend/src/modules/admin/dashboard/health-monitor.service.ts`)
- `recordHealthMetric(metric, value)`: Save to SystemHealthLog
- `getTrendData(metric, range)`:
  - **Performance (Fix #11)**: Use indexed queries on recorded_at
- `startMonitoring()`:
  - **Fix #7 - Cron Job Configuration**:
  ```typescript
  import { Cron } from '@nestjs/schedule';

  @Cron('*/5 * * * *')  // Every 5 minutes
  async monitorHealth() {
    await this.recordHealthMetric('availability', await this.calculateAvailability());
    await this.recordHealthMetric('push_success_rate', await this.calculatePushSuccessRate());
    await this.checkAlerts();
  }
  ```
- `recordHeartbeat()`:
  - **Fix #6 - Heartbeat Implementation**:
  ```typescript
  @Cron('* * * * *')  // Every 1 minute
  async recordHeartbeat() {
    try {
      const start = Date.now();
      await this.httpService.get('/health').toPromise();
      const responseTime = Date.now() - start;

      if (responseTime > 10000) {
        // Downtime: response > 10s
        await this.systemHealthLogRepo.save({
          metricType: 'availability',
          metricValue: 0,
          status: 'critical',
          metadata: { downtime: true, responseTime },
        });
      } else {
        // Uptime
        await this.systemHealthLogRepo.save({
          metricType: 'availability',
          metricValue: 1,
          status: 'healthy',
          metadata: { uptime: true, responseTime },
        });
      }
    } catch (error) {
      // 5xx error = downtime
      await this.systemHealthLogRepo.save({
        metricType: 'availability',
        metricValue: 0,
        status: 'critical',
        metadata: { downtime: true, error: error.message },
      });
    }
  }
  ```

#### Controllers

**DashboardController** (`backend/src/modules/admin/dashboard/dashboard.controller.ts`)

**Fix #4 - Multi-tenancy Clarification**: Admin role is **platform-scoped** (not tenant-scoped). Platform admins can view all system health metrics.

**Fix #14 - Swagger API Documentation**:
```typescript
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@Controller('api/v1/admin/dashboard')
@ApiTags('admin-dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')  // Platform-level admin role
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly alertService: AlertService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Get system health metrics' })
  @ApiResponse({ status: 200, description: 'Health metrics retrieved successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getHealthMetrics() {
    try {
      return await this.dashboardService.getHealthMetrics();
    } catch (error) {
      throw new InternalServerErrorException('Failed to get health metrics');
    }
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get alert list' })
  @ApiResponse({ status: 200, description: 'Alerts retrieved successfully' })
  async getAlerts(@Query() filters: GetAlertsDto) {
    return await this.alertService.getAlerts(filters);
  }

  @Put('alerts/:id/resolve')
  @ApiOperation({ summary: 'Mark alert as resolved' })
  @ApiResponse({ status: 200, description: 'Alert resolved successfully' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async resolveAlert(
    @Param('id') id: string,
    @Request() req,
  ) {
    return await this.alertService.resolveAlert(id, req.user.id);
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get health trend data' })
  @ApiResponse({ status: 200, description: 'Trend data retrieved successfully' })
  async getTrendData(@Query() query: GetTrendDataDto) {
    return await this.dashboardService.getTrendData(query.metric, query.range);
  }
}
```

### Frontend Implementation

#### Pages

**Dashboard Page** (`frontend/app/admin/dashboard/page.tsx`)
- 布局：4 个指标卡片 + 告警区域 + 趋势图表
- **Fix #8 - Auto-refresh Implementation**:
```typescript
'use client';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetchMetrics = async () => {
    const data = await getHealthMetrics();
    setMetrics(data);
    setLastUpdate(new Date());
  };

  useEffect(() => {
    fetchMetrics(); // Initial load
    const interval = setInterval(fetchMetrics, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div>最后更新: {lastUpdate.toLocaleTimeString()}</div>
      <button onClick={fetchMetrics}>手动刷新</button>
      {/* Metric cards, alerts, charts */}
    </div>
  );
}
```
- 响应式设计：适配桌面和平板

#### Components

**HealthMetricCard** (`frontend/components/admin/HealthMetricCard.tsx`)
- Props: `metric`, `current`, `target`, `status`, `trend`
- 显示指标值、目标对比、状态图标、趋势箭头
- **Fix #16 - Code Reuse**: Reuse existing card components from Story 6-2

**AlertList** (`frontend/components/admin/AlertList.tsx`)
- Props: `alerts`, `onResolve`
- 显示告警列表、支持筛选、标记已处理
- **Fix #16 - Code Reuse**: Reuse EmailService from Story 6-2 for alert notifications

**HealthTrendChart** (`frontend/components/admin/HealthTrendChart.tsx`)
- Props: `metric`, `data`, `range`
- **Fix #13 - Chart Library Guidance**: Use **Recharts** (already used in Csaas project)
```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export function HealthTrendChart({ metric, data, range }) {
  return (
    <LineChart width={800} height={400} data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip />
      <Legend />
      <Line type="monotone" dataKey="value" stroke="#8884d8" />
    </LineChart>
  );
}
```
- 支持时间范围切换
- **Fix #16 - Code Reuse**: Reuse CsvParserService from Story 6-2 for chart data export

### Monitoring & Alerting Logic

#### 可用性监控 (Fix #6 - Heartbeat Implementation Details)
- **Implementation**: HealthMonitorService.recordHeartbeat() method
- **Mechanism**: HTTP health check to `/health` endpoint every 1 minute
- **Downtime Detection**:
  - API 响应时间 > 10 秒
  - 返回 5xx 错误
  - 连接超时
- **Recording**: Save uptime/downtime to SystemHealthLog table
- **Calculation**: `(总分钟数 - 停机分钟数) / 总分钟数 × 100%`

#### 推送成功率监控
- **Data Source**: Query `radar_pushes` table
- **Calculation**: `COUNT(status='sent') / (COUNT(status='sent') + COUNT(status='failed')) × 100%`
- **告警阈值**: < 98%
- **Integration (Fix #12)**: Use RadarPushRepository from existing codebase

#### AI 成本监控 (Fix #5 - Dependency Clarification)
- **Data Source**: Query `ai_usage_logs` table (placeholder created in this story)
- **Placeholder Behavior**: Return { today: 0, thisMonth: 0, avgPerClient: 0 } if table empty
- **Full Implementation**: Story 7.4 will populate this table with actual AI usage data
- **Calculation**: 单客户月均成本 = 本月总成本 / 活跃客户数
- **告警阈值**: > 500 元

#### 客户活跃度监控
- **Data Source**: Query `organizations` table
- **Active Definition**: 最近 7 天内有 `last_active_at` 记录
- **Calculation**: 活跃率 = 活跃客户数 / 总客户数 × 100%
- **告警阈值**: < 60%（流失风险）
- **Integration (Fix #12)**: Use OrganizationRepository from existing codebase

### Multi-tenancy Requirements (Fix #4 - Clarification)

- **Admin Role Scope**: Platform-level admin (not tenant-scoped)
- **Access Control**: Platform admins can view all system health metrics across all tenants
- **3-Layer Defense** (Architecture requirement):
  1. **API Layer**: @UseGuards(JwtAuthGuard, RolesGuard), @Roles('admin')
  2. **Application Layer**: SystemHealthLog and Alert are platform-level (no tenantId filtering needed)
  3. **Audit Layer**: Log all admin access to health metrics
- **Data Isolation**: SystemHealthLog and Alert tables do NOT have tenantId (platform-level monitoring)
- **Tenant-specific Metrics**: Customer activity metrics aggregate across all tenants

### Performance Requirements (Fix #11 - Optimization Details)

- **健康指标计算响应时间 < 2 秒**
  - **Optimization**: Redis caching (key: `dashboard:health`, TTL: 5 minutes)
  - **Optimization**: Database indexes on `recorded_at`, `metric_type`, `status` columns
  - **Optimization**: Aggregate queries instead of row-by-row processing

- **趋势数据查询响应时间 < 3 秒**
  - **Optimization**: Use indexed queries on `recorded_at` column
  - **Optimization**: Limit query to specified date range only
  - **Optimization**: Consider materialized views for 90-day aggregates

- **仪表板页面加载时间 < 1 秒**
  - **Optimization**: Lazy load chart components
  - **Optimization**: Use React.memo for metric cards
  - **Optimization**: Parallel API calls for metrics, alerts, trends

- **支持 10 个并发管理员访问**
  - **Optimization**: Redis cache reduces database load
  - **Optimization**: Connection pooling for PostgreSQL

## Task Breakdown (Fix #17 - Development Workflow)

**Implementation Order**: Entities → Repositories → Services → Controllers → Frontend → Tests

### Phase 1: Backend Foundation (Day 1)

1. **Database & Entities**
   - [ ] Create SystemHealthLog entity (`backend/src/database/entities/system-health-log.entity.ts`)
   - [ ] Create Alert entity (`backend/src/database/entities/alert.entity.ts`)
   - [ ] Create ai_usage_logs placeholder table migration
   - [ ] Create SystemHealthLogRepository
   - [ ] Create AlertRepository
   - [ ] Register entities in index.ts and AdminModule

2. **Core Services**
   - [ ] Implement DashboardService (getHealthMetrics, calculate methods)
   - [ ] Implement AlertService (CRUD operations, deduplication)
   - [ ] Implement HealthMonitorService (recordHeartbeat, cron jobs)
   - [ ] Add Redis caching to DashboardService
   - [ ] Write unit tests (Fix #10: Mock repositories, test calculations, test error handling)

3. **API Layer**
   - [ ] Implement DashboardController with all endpoints
   - [ ] Add Swagger documentation (@ApiTags, @ApiOperation, @ApiResponse)
   - [ ] Add error handling (try-catch, NotFoundException, BadRequestException)
   - [ ] Write E2E tests (Fix #10: Test all endpoints, test auth, test error cases)

### Phase 2: Frontend Implementation (Day 2)

4. **Dashboard Page**
   - [ ] Create `/admin/dashboard/page.tsx`
   - [ ] Implement 30s auto-refresh with useEffect + setInterval
   - [ ] Add manual refresh button
   - [ ] Display last update time

5. **Components**
   - [ ] Create HealthMetricCard component
   - [ ] Create AlertList component (reuse patterns from Story 6-2)
   - [ ] Create HealthTrendChart component (use Recharts)
   - [ ] Add responsive layout (Tailwind CSS)

6. **API Integration**
   - [ ] Create `lib/api/dashboard.ts` with API client methods
   - [ ] Implement error handling in API calls
   - [ ] Add loading states and error messages

### Phase 3: Integration & Testing (Day 3)

7. **Integration**
   - [ ] Verify module registration in AdminModule
   - [ ] Update navigation menu (add "运营仪表板" link)
   - [ ] Test permission control (@Roles('admin'))
   - [ ] Verify Redis caching works
   - [ ] Verify cron jobs execute correctly

8. **Testing & Documentation**
   - [ ] Run all unit tests (target: >80% coverage)
   - [ ] Run E2E tests (Playwright)
   - [ ] Performance testing (response times < targets)
   - [ ] Update API documentation (Swagger)
   - [ ] Write operations manual (how to use dashboard)

## Definition of Done (Fix #10 - Test Guidance)

- [ ] **Backend Implementation**
  - [ ] All entities created with TypeORM decorators
  - [ ] All repositories created extending BaseRepository
  - [ ] All services implemented with error handling
  - [ ] All controllers implemented with Swagger docs
  - [ ] Module registered in AdminModule

- [ ] **Unit Tests (>80% coverage)**
  - [ ] DashboardService tests:
    - Mock SystemHealthLogRepository, RadarPushRepository, OrganizationRepository
    - Test calculateAvailability() with various uptime/downtime scenarios
    - Test calculatePushSuccessRate() with edge cases (0 pushes, all failed, all success)
    - Test calculateAICost() with empty table (returns mock data)
    - Test Redis caching (cache hit, cache miss)
    - Test error handling (repository throws error → InternalServerErrorException)
  - [ ] AlertService tests:
    - Test alert deduplication (1-hour window)
    - Test resolveAlert() throws NotFoundException for invalid ID
    - Test filter validation throws BadRequestException
  - [ ] HealthMonitorService tests:
    - Test recordHeartbeat() detects downtime (response > 10s, 5xx error)
    - Test cron job execution (mock @Cron decorator)

- [ ] **E2E Tests**
  - [ ] GET /api/v1/admin/dashboard/health returns 200 with valid metrics
  - [ ] GET /api/v1/admin/dashboard/health returns 401 without auth token
  - [ ] GET /api/v1/admin/dashboard/health returns 403 for non-admin users
  - [ ] GET /api/v1/admin/dashboard/alerts returns paginated results
  - [ ] PUT /api/v1/admin/dashboard/alerts/:id/resolve returns 404 for invalid ID
  - [ ] GET /api/v1/admin/dashboard/trends validates date range parameters

- [ ] **Frontend Implementation**
  - [ ] Dashboard page renders all metric cards
  - [ ] 30s auto-refresh works correctly
  - [ ] Manual refresh button updates data
  - [ ] Charts render with Recharts
  - [ ] Responsive layout works on desktop and tablet

- [ ] **Integration & Performance**
  - [ ] Module loads correctly in AdminModule
  - [ ] Navigation menu includes dashboard link
  - [ ] Permission control verified (@Roles('admin'))
  - [ ] Redis caching reduces response time
  - [ ] Health metrics response < 2s
  - [ ] Trend data response < 3s
  - [ ] Page load time < 1s

- [ ] **Documentation**
  - [ ] Swagger API docs complete
  - [ ] Operations manual written
  - [ ] Code review passed

## Related Stories

- **Story 7.2**: 内容质量管理（依赖本故事的仪表板基础设施）
- **Story 7.3**: 客户管理与流失风险预警（依赖本故事的客户活跃度监控）
- **Story 7.4**: AI 成本优化工具（依赖本故事的 AI 成本监控）
- **Story 6.1**: 多租户数据模型与隔离机制（已完成，提供权限基础）
- **Story 6.2**: 咨询公司批量客户管理后台（已完成，提供客户数据）

## Dependencies (Fix #20 - Dependency Clarification)

### Required (Must be completed first)
- **Story 6.1**: 多租户数据模型与隔离机制 ✅ (已完成)
  - Provides: JwtAuthGuard, RolesGuard, UserRole.ADMIN enum
- **Story 6.2**: 咨询公司批量客户管理后台 ✅ (已完成)
  - Provides: Organization entity, OrganizationRepository
  - Provides: EmailService (reusable for alert notifications)
  - Provides: CsvParserService (reusable for chart data export)

### Existing Infrastructure
- `radar_pushes` table (for push success rate calculation)
- `organizations` table (for customer activity calculation)
- Redis (for caching)
- WebSocket Gateway (for real-time updates - optional enhancement)

### Circular Dependency Resolution (Fix #5)
- **Story 7.4**: AI 成本优化工具 (未完成)
  - **Problem**: Story 7.4 creates full `ai_usage_logs` table, but Story 7.1 needs it
  - **Solution**: Story 7.1 creates **placeholder** `ai_usage_logs` table with minimal schema:
    ```sql
    CREATE TABLE ai_usage_logs (
      id UUID PRIMARY KEY,
      organization_id UUID,
      task_type VARCHAR(50),
      cost DECIMAL(10, 2),
      created_at TIMESTAMP
    );
    ```
  - **Behavior**: DashboardService.calculateAICost() returns mock data if table is empty
  - **Story 7.4**: Will add columns (input_tokens, output_tokens, model_name) and populate data

### Package Dependencies
- `@nestjs/schedule` - For cron jobs (@Cron decorator)
- `@nestjs/swagger` - For API documentation
- `recharts` - For frontend charts (already in project)
- `cache-manager` - For Redis caching (already in project)

## Risks & Mitigation

### Risk 1: 健康指标计算性能问题
**描述**: 大量数据时，实时计算健康指标可能导致响应慢
**影响**: 高
**缓解措施**:
- 使用 Redis 缓存计算结果（TTL 5 分钟）
- 使用数据库索引优化查询
- 考虑使用物化视图存储聚合数据

### Risk 2: 告警风暴
**描述**: 短时间内产生大量告警，影响管理员体验
**影响**: 中
**缓解措施**:
- 实现告警去重逻辑（相同类型告警 1 小时内只创建一次）
- 实现告警优先级排序
- 提供告警静默功能

### Risk 3: 趋势数据存储增长
**描述**: 长期运行后，`system_health_logs` 表数据量过大
**影响**: 中
**缓解措施**:
- 实现数据归档策略（保留 90 天详细数据，之后聚合为日均值）
- 使用分区表优化查询性能
- 定期清理过期数据

## Notes

### Architecture Alignment
- 本故事是 Epic 7 的基础，后续故事将复用仪表板基础设施
- 健康指标的目标值（99.5%、98%、500 元）来自 PRD 的非功能需求
- 告警机制将在后续故事中扩展（内容质量告警、客户流失告警等）
- 考虑未来集成第三方监控工具（如 Prometheus、Grafana）

### Key Implementation Decisions (Applied Fixes)

**Fix #1-3: Backend Structure**
- Created TypeORM entities (not raw SQL) for SystemHealthLog and Alert
- Created repositories extending BaseRepository (platform-level, no tenantId)
- Registered DashboardModule in AdminModule with ScheduleModule

**Fix #4: Multi-tenancy Clarification**
- Admin role is platform-scoped (not tenant-scoped)
- SystemHealthLog and Alert are platform-level entities (no tenantId column)
- 3-layer defense applies: API Guards + Application Logic + Audit Logs

**Fix #5: Circular Dependency Resolution**
- Created placeholder ai_usage_logs table in this story
- DashboardService returns mock AI cost data if table empty
- Story 7.4 will add full schema and populate data

**Fix #6-7: Monitoring Implementation**
- Heartbeat: HTTP health check every 1 minute via @Cron decorator
- Health monitoring: Record metrics every 5 minutes via @Cron decorator
- Used @nestjs/schedule package for cron jobs

**Fix #8: Real-time Updates**
- Frontend: useEffect + setInterval for 30s polling
- Alternative: WebSocket push updates (future enhancement)

**Fix #9: Error Handling**
- All services wrapped in try-catch blocks
- Throw NotFoundException, BadRequestException, InternalServerErrorException
- Alert deduplication (1-hour window)

**Fix #10: Test Guidance**
- Comprehensive unit test patterns specified
- Mock strategies for repositories
- E2E test scenarios defined

**Fix #11: Performance Optimization**
- Redis caching (5-minute TTL) for health metrics
- Database indexes on recorded_at, metric_type, status
- Parallel API calls in frontend

**Fix #12: Integration with Existing Services**
- Reuse RadarPushRepository for push success rate
- Reuse OrganizationRepository for customer activity
- Reuse EmailService from Story 6-2 for alert notifications
- Reuse CsvParserService from Story 6-2 for chart export

**Fix #13: Chart Library**
- Use Recharts (already in project, consistent with existing code)

**Fix #14: Swagger Documentation**
- All endpoints have @ApiTags, @ApiOperation, @ApiResponse decorators

**Fix #15-16: Code Reuse**
- Reuse card components from Story 6-2
- Reuse EmailService and CsvParserService

**Fix #17: Development Workflow**
- Clear implementation order: Entities → Repositories → Services → Controllers → Frontend → Tests
- 3-day phased approach

**Fix #18: Reduced Redundancy**
- Replaced SQL schema with TypeORM entity definitions
- Removed duplicate information

**Fix #19: Streamlined Tasks**
- Consolidated 16 tasks into 8 grouped tasks
- Organized by implementation phase

**Fix #20: Dependency Clarity**
- Explicitly listed required stories and existing infrastructure
- Clarified circular dependency resolution with Story 7.4

## Success Metrics

- 仪表板页面加载时间 < 1 秒
- 健康指标计算准确率 100%
- 告警检测延迟 < 5 分钟
- 管理员满意度 ≥ 4.5/5.0
- 异常发现时间缩短 80%（相比手动检查）

---

**Story Created**: 2026-02-04
**Epic**: Epic 7 - 运营管理与成本优化
**Sprint**: TBD
**Estimated Effort**: 8 story points (约 2-3 个工作日)
