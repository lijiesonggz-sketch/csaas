---
story_key: 7-2
epic_key: epic-7
title: 内容质量管理
status: ready-for-dev
priority: high
points: 5
assignee: TBD
created_at: 2026-02-04
---

# Story 7.2: 内容质量管理

Status: ready-for-dev

## Story

As a 平台管理员,
I want 收集用户反馈（推送内容评分），标记低分推送，提供优化建议,
So that 我可以持续改进推送内容质量，提升用户满意度。

## Acceptance Criteria

### AC1: 推送详情页显示内容评分区域
**Given** 用户查看推送详情
**When** 详情弹窗显示
**Then** 底部显示"内容评分"区域：5 星评分 + 可选文字反馈
**And** 提示："您的反馈帮助我们改进服务"

### AC2: 用户提交评分创建反馈记录
**Given** 用户提交评分
**When** 点击星级并提交
**Then** 创建 PushFeedback 记录：pushId、userId、rating（1-5）、comment、createdAt
**And** 提示："感谢您的反馈！"

### AC3: 内容质量管理页面基础结构
**Given** 管理员访问 /admin/content-quality
**When** 页面加载
**Then** 显示内容质量管理页面标题："内容质量管理"
**And** 显示平均评分、评分分布图、低分推送列表

### AC4: 低分推送识别与列表
**Given** 低分推送识别
**When** 计算推送评分
**Then** 标记 rating < 3.0 的推送为"低分推送"
**And** 显示低分推送列表（按评分升序）
**And** 每条推送包含：标题、平均评分、反馈数量、查看详情按钮

### AC5: 低分推送详情查看与处理
**Given** 管理员查看低分推送详情
**When** 点击"查看详情"
**Then** 显示推送完整内容、所有用户反馈、AI 分析结果
**And** 显示优化建议：相关性评分过高/内容质量不佳/信息源不可靠
**And** 支持标记为"已优化"或"忽略"

### AC6: 内容质量趋势分析
**Given** 内容质量趋势分析
**When** 渲染趋势图
**Then** 显示最近 30 天的平均评分趋势、低分推送数量趋势
**And** 按雷达类型分组显示（技术/行业/合规）
**And** 目标：平均评分 >= 4.0/5.0

## Tasks / Subtasks

### Phase 1: Backend Foundation (Day 1)

- [x] **Task 1.1**: Create PushFeedback entity (AC: #2)
  - [x] 1.1.1: Create `backend/src/database/entities/push-feedback.entity.ts`
  - [x] 1.1.2: Register entity in `backend/src/database/entities/index.ts`
  - [x] 1.1.3: Create migration for push_feedback table
  - [x] 1.1.4: Create `backend/src/database/repositories/push-feedback.repository.ts`

- [x] **Task 1.2**: Implement Content Quality Service (AC: #4, #5, #6)
  - [x] 1.2.1: Create `backend/src/modules/admin/content-quality/content-quality.service.ts`
  - [x] 1.2.2: Implement `getContentQualityMetrics()` - 计算平均评分、低分推送统计
  - [x] 1.2.3: Implement `getLowRatedPushes()` - 获取低分推送列表
  - [x] 1.2.4: Implement `getPushFeedbackDetails()` - 获取推送反馈详情
  - [x] 1.2.5: Implement `markPushAsOptimized()` - 标记推送为已优化
  - [x] 1.2.6: Implement `getQualityTrends()` - 获取质量趋势数据

- [x] **Task 1.3**: Implement Feedback Service (AC: #2)
  - [x] 1.3.1: Create `backend/src/modules/radar/services/push-feedback.service.ts`
  - [x] 1.3.2: Implement `submitFeedback()` - 提交用户反馈
  - [x] 1.3.3: Implement `getUserFeedback()` - 获取用户对特定推送的反馈
  - [x] 1.3.4: Add duplicate feedback prevention (同一用户不能重复评分同一推送)

### Phase 2: API Layer (Day 1-2)

- [x] **Task 2.1**: Create Content Quality Controller (AC: #3, #4, #5, #6)
  - [x] 2.1.1: Create `backend/src/modules/admin/content-quality/content-quality.controller.ts`
  - [x] 2.1.2: Implement `GET /api/v1/admin/content-quality/metrics` - 获取内容质量指标
  - [x] 2.1.3: Implement `GET /api/v1/admin/content-quality/low-rated` - 获取低分推送列表
  - [x] 2.1.4: Implement `GET /api/v1/admin/content-quality/pushes/:id/feedback` - 获取推送反馈详情
  - [x] 2.1.5: Implement `PUT /api/v1/admin/content-quality/pushes/:id/optimize` - 标记为已优化
  - [x] 2.1.6: Implement `PUT /api/v1/admin/content-quality/pushes/:id/ignore` - 标记为忽略
  - [x] 2.1.7: Implement `GET /api/v1/admin/content-quality/trends` - 获取质量趋势数据

- [x] **Task 2.2**: Create Feedback Controller (AC: #1, #2)
  - [x] 2.2.1: Create `backend/src/modules/radar/controllers/push-feedback.controller.ts`
  - [x] 2.2.2: Implement `POST /api/v1/radar/pushes/:id/feedback` - 提交用户反馈
  - [x] 2.2.3: Implement `GET /api/v1/radar/pushes/:id/feedback` - 获取当前用户的反馈

- [x] **Task 2.3**: Module Registration
  - [x] 2.3.1: Register ContentQualityModule in AdminModule
  - [x] 2.3.2: Register PushFeedbackController in RadarModule
  - [x] 2.3.3: Add Swagger documentation for all endpoints

### Phase 3: Frontend - User Feedback Components (Day 2)

- [x] **Task 3.1**: Create Feedback Form Component (AC: #1, #2)
  - [x] 3.1.1: Create `frontend/components/radar/PushFeedbackForm.tsx`
  - [x] 3.1.2: Implement 5-star rating component with hover effects
  - [x] 3.1.3: Implement optional comment textarea
  - [x] 3.1.4: Add submit button with loading state
  - [x] 3.1.5: Add success/error message display
  - [x] 3.1.6: Add prompt text: "您的反馈帮助我们改进服务"

- [x] **Task 3.2**: Update Push Detail Dialog (AC: #1)
  - [x] 3.2.1: Modify existing push detail dialog to include PushFeedbackForm
  - [x] 3.2.2: Position feedback form at bottom of dialog
  - [x] 3.2.3: Show user's existing feedback if already submitted
  - [x] 3.2.4: Disable form after submission (prevent duplicate)

- [x] **Task 3.3**: Create API Client for Feedback
  - [x] 3.3.1: Create `frontend/lib/api/feedback.ts`
  - [x] 3.3.2: Implement `submitPushFeedback(pushId, rating, comment)`
  - [x] 3.3.3: Implement `getUserFeedback(pushId)`

### Phase 4: Frontend - Admin Content Quality Page (Day 2-3)

- [x] **Task 4.1**: Create Content Quality Dashboard Page (AC: #3)
  - [x] 4.1.1: Create `frontend/app/admin/content-quality/page.tsx`
  - [x] 4.1.2: Implement page header with title "内容质量管理"
  - [x] 4.1.3: Create metric cards: 平均评分、总反馈数、低分推送数、目标达成率

- [x] **Task 4.2**: Create Rating Distribution Chart (AC: #3)
  - [x] 4.2.1: Create `frontend/components/admin/RatingDistributionChart.tsx`
  - [x] 4.2.2: Use Recharts to display 5-star distribution (bar chart)
  - [x] 4.2.3: Show percentage for each rating level

- [x] **Task 4.3**: Create Low Rated Push List (AC: #4)
  - [x] 4.3.1: Create `frontend/components/admin/LowRatedPushList.tsx`
  - [x] 4.3.2: Display push cards with: 标题、平均评分、反馈数量、雷达类型
  - [x] 4.3.3: Sort by average rating ascending (lowest first)
  - [x] 4.3.4: Add "查看详情" button for each push
  - [x] 4.3.5: Add filter by radar type (tech/industry/compliance)

- [x] **Task 4.4**: Create Push Feedback Detail Dialog (AC: #5)
  - [x] 4.4.1: Create `frontend/components/admin/PushFeedbackDetailDialog.tsx`
  - [x] 4.4.2: Display push full content
  - [x] 4.4.3: Display all user feedback (rating + comment + timestamp)
  - [x] 4.4.4: Display AI analysis results (relevanceScore, etc.)
  - [x] 4.4.5: Display optimization suggestions based on feedback patterns
  - [x] 4.4.6: Add "标记为已优化" button
  - [x] 4.4.7: Add "忽略" button

- [x] **Task 4.5**: Create Quality Trend Chart (AC: #6)
  - [x] 4.5.1: Create `frontend/components/admin/QualityTrendChart.tsx`
  - [x] 4.5.2: Display 30-day average rating trend (line chart)
  - [x] 4.5.3: Display 30-day low-rated push count trend (line chart)
  - [x] 4.5.4: Support grouping by radar type
  - [x] 4.5.5: Show target line at 4.0 rating

- [x] **Task 4.6**: Create API Client for Content Quality
  - [x] 4.6.1: Update `frontend/lib/api/dashboard.ts` or create `frontend/lib/api/content-quality.ts`
  - [x] 4.6.2: Implement `getContentQualityMetrics()`
  - [x] 4.6.3: Implement `getLowRatedPushes()`
  - [x] 4.6.4: Implement `getPushFeedbackDetails(pushId)`
  - [x] 4.6.5: Implement `markPushAsOptimized(pushId)`
  - [x] 4.6.6: Implement `ignorePush(pushId)`
  - [x] 4.6.7: Implement `getQualityTrends()`

### Phase 5: Integration & Testing (Day 3)

- [x] **Task 5.1**: Integration
  - [x] 5.1.1: Update admin navigation menu to include "内容质量管理" link
  - [x] 5.1.2: Verify module registration and API endpoints
  - [x] 5.1.3: Test end-to-end user feedback flow
  - [x] 5.1.4: Test end-to-end admin content quality management flow

- [x] **Task 5.2**: Testing
  - [x] 5.2.1: Write unit tests for ContentQualityService
  - [x] 5.2.2: Write unit tests for PushFeedbackService
  - [x] 5.2.3: Write E2E tests for feedback submission
  - [x] 5.2.4: Write E2E tests for content quality admin APIs
  - [x] 5.2.5: Write Playwright E2E tests (see Testing Requirements section)

## Dev Notes

### Database Schema

#### PushFeedback Entity
```typescript
// backend/src/database/entities/push-feedback.entity.ts
@Entity('push_feedback')
@Index(['pushId', 'userId'])
@Index(['rating'])
@Index(['createdAt'])
export class PushFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'push_id' })
  @Index()
  pushId: string;

  @ManyToOne(() => RadarPush)
  @JoinColumn({ name: 'push_id' })
  push: RadarPush;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int' })
  rating: number; // 1-5

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

#### Migration SQL
```sql
CREATE TABLE push_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  push_id UUID NOT NULL,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_push_feedback_push FOREIGN KEY (push_id) REFERENCES radar_pushes(id) ON DELETE CASCADE,
  CONSTRAINT fk_push_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_push_feedback_push_user ON push_feedback(push_id, user_id);
CREATE INDEX idx_push_feedback_rating ON push_feedback(rating);
CREATE INDEX idx_push_feedback_created_at ON push_feedback(created_at);
```

### API Endpoints

#### User Feedback Endpoints
```typescript
// POST /api/v1/radar/pushes/:id/feedback
// Submit user feedback for a push
{
  "rating": 4,
  "comment": "内容很有用，帮助我了解了最新的技术趋势"
}

// Response: 201 Created
{
  "id": "uuid",
  "pushId": "uuid",
  "userId": "uuid",
  "rating": 4,
  "comment": "内容很有用...",
  "createdAt": "2026-02-04T10:00:00Z"
}

// GET /api/v1/radar/pushes/:id/feedback
// Get current user's feedback for a push
// Response: 200 OK
{
  "data": {
    "id": "uuid",
    "rating": 4,
    "comment": "内容很有用...",
    "createdAt": "2026-02-04T10:00:00Z"
  }
}
```

#### Admin Content Quality Endpoints
```typescript
// GET /api/v1/admin/content-quality/metrics
{
  "averageRating": 4.2,
  "totalFeedback": 150,
  "lowRatedPushes": 12,
  "targetAchievement": 85, // percentage of pushes with rating >= 4.0
  "ratingDistribution": {
    "5": 80,
    "4": 45,
    "3": 15,
    "2": 6,
    "1": 4
  }
}

// GET /api/v1/admin/content-quality/low-rated?limit=20&radarType=tech
{
  "data": [
    {
      "pushId": "uuid",
      "title": "某技术文章标题",
      "radarType": "tech",
      "averageRating": 2.3,
      "feedbackCount": 5,
      "createdAt": "2026-02-01T10:00:00Z"
    }
  ],
  "meta": {
    "total": 12,
    "page": 1,
    "pageSize": 20
  }
}

// GET /api/v1/admin/content-quality/pushes/:id/feedback
{
  "push": {
    "id": "uuid",
    "title": "某技术文章标题",
    "summary": "摘要内容...",
    "fullContent": "完整内容...",
    "radarType": "tech",
    "relevanceScore": 0.85,
    "source": "GARTNER"
  },
  "feedback": [
    {
      "id": "uuid",
      "rating": 2,
      "comment": "内容与我的需求不太相关",
      "createdAt": "2026-02-04T10:00:00Z",
      "user": {
        "id": "uuid",
        "name": "用户姓名"
      }
    }
  ],
  "optimizationSuggestions": [
    "相关性评分过高（0.85），但用户反馈显示内容不够相关",
    "建议调整AI相关性算法权重",
    "信息源GARTNER的内容可能需要更严格的筛选"
  ],
  "status": "pending" // pending, optimized, ignored
}

// PUT /api/v1/admin/content-quality/pushes/:id/optimize
// Response: 200 OK
{
  "message": "已标记为已优化",
  "status": "optimized"
}

// PUT /api/v1/admin/content-quality/pushes/:id/ignore
// Response: 200 OK
{
  "message": "已忽略该推送",
  "status": "ignored"
}

// GET /api/v1/admin/content-quality/trends?range=30d
{
  "averageRatingTrend": [
    { "date": "2026-01-05", "value": 4.1, "tech": 4.2, "industry": 4.0, "compliance": 4.1 },
    { "date": "2026-01-06", "value": 4.2, "tech": 4.3, "industry": 4.1, "compliance": 4.2 }
  ],
  "lowRatedPushCountTrend": [
    { "date": "2026-01-05", "count": 3, "tech": 1, "industry": 1, "compliance": 1 },
    { "date": "2026-01-06", "count": 2, "tech": 1, "industry": 0, "compliance": 1 }
  ]
}
```

### Backend Implementation Details

#### ContentQualityService
```typescript
@Injectable()
export class ContentQualityService {
  constructor(
    private readonly pushFeedbackRepo: PushFeedbackRepository,
    private readonly radarPushRepo: RadarPushRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getContentQualityMetrics(): Promise<ContentQualityMetrics> {
    // Check cache first
    const cached = await this.cacheManager.get('content-quality:metrics');
    if (cached) return cached;

    // Calculate metrics
    const metrics = await this.calculateMetrics();

    // Cache for 5 minutes
    await this.cacheManager.set('content-quality:metrics', metrics, 300);
    return metrics;
  }

  async getLowRatedPushes(
    options: { limit?: number; radarType?: string } = {},
  ): Promise<LowRatedPush[]> {
    const query = this.radarPushRepo
      .createQueryBuilder('push')
      .leftJoin('push_feedback', 'feedback', 'feedback.push_id = push.id')
      .select([
        'push.id as pushId',
        'push.title as title',
        'push.radarType as radarType',
        'AVG(feedback.rating) as averageRating',
        'COUNT(feedback.id) as feedbackCount',
      ])
      .groupBy('push.id')
      .having('AVG(feedback.rating) < 3.0')
      .orderBy('averageRating', 'ASC')
      .limit(options.limit || 20);

    if (options.radarType) {
      query.andWhere('push.radarType = :radarType', { radarType: options.radarType });
    }

    return query.getRawMany();
  }

  private generateOptimizationSuggestions(
    push: RadarPush,
    feedback: PushFeedback[],
  ): string[] {
    const suggestions: string[] = [];
    const avgRating = feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;

    // Check if relevance score is high but rating is low
    if (push.relevanceScore > 0.8 && avgRating < 3.0) {
      suggestions.push(`相关性评分过高（${push.relevanceScore}），但用户反馈显示内容不够相关`);
      suggestions.push('建议调整AI相关性算法权重');
    }

    // Check for content quality issues
    const lowQualityComments = feedback.filter(f =>
      f.comment?.includes('质量') || f.comment?.includes('无用')
    );
    if (lowQualityComments.length > feedback.length / 2) {
      suggestions.push('内容质量不佳，建议优化信息源筛选');
    }

    return suggestions;
  }
}
```

#### PushFeedbackService
```typescript
@Injectable()
export class PushFeedbackService {
  constructor(
    private readonly pushFeedbackRepo: PushFeedbackRepository,
    private readonly radarPushRepo: RadarPushRepository,
  ) {}

  async submitFeedback(
    pushId: string,
    userId: string,
    data: SubmitFeedbackDto,
  ): Promise<PushFeedback> {
    // Check if push exists
    const push = await this.radarPushRepo.findOne({ where: { id: pushId } });
    if (!push) {
      throw new NotFoundException('Push not found');
    }

    // Check for existing feedback (prevent duplicate)
    const existing = await this.pushFeedbackRepo.findOne({
      where: { pushId, userId },
    });
    if (existing) {
      throw new ConflictException('You have already submitted feedback for this push');
    }

    // Create feedback
    const feedback = this.pushFeedbackRepo.create({
      pushId,
      userId,
      rating: data.rating,
      comment: data.comment,
    });

    return this.pushFeedbackRepo.save(feedback);
  }
}
```

### Frontend Implementation Details

#### PushFeedbackForm Component
```typescript
// frontend/components/radar/PushFeedbackForm.tsx
interface PushFeedbackFormProps {
  pushId: string;
  existingFeedback?: PushFeedback | null;
  onSubmit: (rating: number, comment: string) => Promise<void>;
}

export function PushFeedbackForm({ pushId, existingFeedback, onSubmit }: PushFeedbackFormProps) {
  const [rating, setRating] = useState(existingFeedback?.rating || 0);
  const [comment, setComment] = useState(existingFeedback?.comment || '');
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(!!existingFeedback);

  if (submitted) {
    return (
      <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 2 }}>
        <Typography color="success.main">
          感谢您的反馈！您已评分: {existingFeedback?.rating || rating} 星
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography variant="subtitle2" gutterBottom>
        内容评分
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        您的反馈帮助我们改进服务
      </Typography>

      {/* 5-Star Rating */}
      <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <IconButton
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            size="small"
          >
            <StarIcon
              sx={{
                color: (hoverRating || rating) >= star ? 'warning.main' : 'grey.300',
              }}
            />
          </IconButton>
        ))}
      </Box>

      {/* Comment */}
      <TextField
        fullWidth
        multiline
        rows={2}
        placeholder="可选：请输入您的反馈（如内容质量、相关性等）"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        sx={{ mb: 2 }}
      />

      {/* Submit Button */}
      <Button
        variant="contained"
        disabled={rating === 0 || submitting}
        onClick={async () => {
          setSubmitting(true);
          await onSubmit(rating, comment);
          setSubmitted(true);
          setSubmitting(false);
        }}
      >
        {submitting ? '提交中...' : '提交反馈'}
      </Button>
    </Box>
  );
}
```

### Testing Requirements

#### Unit Tests

**ContentQualityService Tests:**
- Mock PushFeedbackRepository and RadarPushRepository
- Test `getContentQualityMetrics()` calculates average correctly
- Test `getLowRatedPushes()` filters by radar type
- Test `generateOptimizationSuggestions()` produces correct suggestions
- Test Redis caching (cache hit, cache miss, cache invalidation)

**PushFeedbackService Tests:**
- Test `submitFeedback()` creates record successfully
- Test `submitFeedback()` throws NotFoundException for invalid pushId
- Test `submitFeedback()` throws ConflictException for duplicate feedback
- Test validation of rating range (1-5)

#### Integration Tests

**API Endpoints:**
- Test POST /api/v1/radar/pushes/:id/feedback creates feedback
- Test duplicate feedback returns 409 Conflict
- Test GET /api/v1/admin/content-quality/metrics returns correct data
- Test GET /api/v1/admin/content-quality/low-rated filters correctly
- Test PUT /api/v1/admin/content-quality/pushes/:id/optimize updates status

#### E2E Tests (Playwright)

**Test File Location:** `frontend/e2e/content-quality.spec.ts`

```typescript
test.describe('[P1] 内容质量管理 - 用户反馈功能', () => {
  test('[P1] 用户应该能够对推送内容进行评分', async ({ page }) => {
    // GIVEN: 用户已登录并查看推送详情
    await page.goto('/radar/history');
    await page.click('[data-testid="push-card"]:first-child');
    await page.click('[data-testid="view-detail-button"]');

    // WHEN: 用户点击星级并提交反馈
    await page.click('[data-testid="star-rating"] >> [data-value="4"]');
    await page.fill('[data-testid="feedback-comment"]', '内容很有用');
    await page.click('[data-testid="submit-feedback-button"]');

    // THEN: 显示感谢消息，反馈已保存
    await expect(page.locator('[data-testid="feedback-success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="feedback-success-message"]')).toContainText('感谢您的反馈');
  });

  test('[P1] 用户不能重复评分同一推送', async ({ page }) => {
    // GIVEN: 用户已对该推送提交过反馈
    await submitFeedback(page, pushId, 4, 'Good content');

    // WHEN: 用户再次尝试提交反馈
    await page.goto(`/radar/history`);
    await page.click(`[data-testid="push-card"][data-push-id="${pushId}"]`);

    // THEN: 显示已评分状态，表单不可用
    await expect(page.locator('[data-testid="already-rated-message"]')).toBeVisible();
  });
});

test.describe('[P1] 内容质量管理 - 管理员功能', () => {
  test('[P1] 管理员应该能够查看内容质量指标', async ({ page }) => {
    // GIVEN: 管理员已登录
    await loginAsAdmin(page);

    // WHEN: 访问内容质量管理页面
    await page.goto('/admin/content-quality');

    // THEN: 显示质量指标卡片
    await expect(page.locator('[data-testid="average-rating-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-feedback-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="low-rated-pushes-card"]')).toBeVisible();
  });

  test('[P1] 管理员应该能够查看低分推送列表', async ({ page }) => {
    // GIVEN: 管理员在内容质量管理页面
    await page.goto('/admin/content-quality');

    // WHEN: 页面加载完成
    await page.waitForSelector('[data-testid="low-rated-push-list"]');

    // THEN: 显示低分推送，按评分升序排列
    const pushCards = await page.locator('[data-testid="low-rated-push-card"]').all();
    expect(pushCards.length).toBeGreaterThan(0);

    // 验证第一个推送的评分最低
    const firstRating = await page.locator('[data-testid="low-rated-push-card"]:first-child [data-testid="average-rating"]').textContent();
    expect(parseFloat(firstRating)).toBeLessThan(3.0);
  });

  test('[P1] 管理员应该能够查看推送反馈详情', async ({ page }) => {
    // GIVEN: 管理员在低分推送列表页面
    await page.goto('/admin/content-quality');

    // WHEN: 点击查看详情按钮
    await page.click('[data-testid="low-rated-push-card"]:first-child [data-testid="view-details-button"]');

    // THEN: 显示推送详情和反馈列表
    await expect(page.locator('[data-testid="push-feedback-detail-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-feedback-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="optimization-suggestions"]')).toBeVisible();
  });

  test('[P1] 管理员应该能够标记推送为已优化', async ({ page }) => {
    // GIVEN: 管理员在推送反馈详情弹窗
    await page.goto('/admin/content-quality');
    await page.click('[data-testid="low-rated-push-card"]:first-child [data-testid="view-details-button"]');

    // WHEN: 点击标记为已优化按钮
    await page.click('[data-testid="mark-optimized-button"]');

    // THEN: 显示成功消息，推送状态更新
    await expect(page.locator('[data-testid="status-optimized-badge"]')).toBeVisible();
  });

  test('[P2] 内容质量趋势图应该正确显示', async ({ page }) => {
    // GIVEN: 管理员在内容质量管理页面
    await page.goto('/admin/content-quality');

    // WHEN: 页面加载完成
    await page.waitForSelector('[data-testid="quality-trend-chart"]');

    // THEN: 趋势图显示30天数据
    await expect(page.locator('[data-testid="quality-trend-chart"]')).toBeVisible();

    // 验证可以切换雷达类型分组
    await page.click('[data-testid="radar-type-filter"]');
    await page.click('[data-testid="radar-type-tech"]');
    await expect(page.locator('[data-testid="quality-trend-chart"]')).toBeVisible();
  });
});
```

### Architecture Compliance

**Multi-tenancy Requirements:**
- PushFeedback entity includes `userId` for user-level data
- Admin endpoints use `@Roles('admin')` for platform-level access
- Content quality metrics aggregate across all tenants (platform admin view)

**Naming Conventions:**
- Database table: `push_feedback` (snake_case, plural)
- Entity file: `push-feedback.entity.ts` (kebab-case)
- API endpoints: `/api/v1/admin/content-quality/*` (kebab-case)
- Component files: PascalCase (`PushFeedbackForm.tsx`)

**Error Handling:**
- Use custom error codes: `CONTENT_QUALITY_001` (Push not found), `CONTENT_QUALITY_002` (Duplicate feedback)
- Wrap service methods in try-catch blocks
- Return appropriate HTTP status codes (404, 409, 500)

**Performance Considerations:**
- Cache content quality metrics in Redis (TTL: 5 minutes)
- Use database indexes on `pushId`, `userId`, `rating`, `createdAt` columns
- Paginate low-rated push list (default 20 items per page)
- Use aggregate queries instead of row-by-row processing

### Project Structure Notes

**Backend Structure:**
```
backend/src/
├── database/
│   ├── entities/
│   │   └── push-feedback.entity.ts        # New
│   └── repositories/
│       └── push-feedback.repository.ts    # New
├── modules/
│   ├── admin/
│   │   ├── content-quality/
│   │   │   ├── content-quality.service.ts
│   │   │   ├── content-quality.controller.ts
│   │   │   └── dto/
│   │   │       ├── content-quality-metrics.dto.ts
│   │   │       ├── low-rated-push.dto.ts
│   │   │       └── submit-feedback.dto.ts
│   │   └── admin.module.ts                # Update
│   └── radar/
│       ├── controllers/
│       │   └── push-feedback.controller.ts # New
│       └── radar.module.ts                # Update
```

**Frontend Structure:**
```
frontend/
├── app/
│   └── admin/
│       └── content-quality/
│           └── page.tsx                   # New
├── components/
│   ├── radar/
│   │   └── PushFeedbackForm.tsx           # New
│   └── admin/
│       ├── RatingDistributionChart.tsx    # New
│       ├── LowRatedPushList.tsx           # New
│       ├── PushFeedbackDetailDialog.tsx   # New
│       └── QualityTrendChart.tsx          # New
└── lib/
    └── api/
        ├── feedback.ts                    # New
        └── content-quality.ts             # New
```

### References

- **Epic Requirements**: [Source: _bmad-output/epics.md#Story 7.2]
- **Architecture Constraints**: [Source: _bmad-output/architecture-radar-service.md#Decision 3: AI 分析流程]
- **Story 7.1 Reference**: [Source: _bmad-output/sprint-artifacts/7-1-operations-dashboard-system-health-monitoring.md]
- **PushCard Component**: [Source: frontend/components/radar/PushCard.tsx]
- **RadarPush Entity**: [Source: backend/src/database/entities/radar-push.entity.ts]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

### Completion Notes List

### File List

1. `D:\csaas\_bmad-output\sprint-artifacts\7-2-content-quality-management.md` (this file)
2. `backend/src/database/entities/push-feedback.entity.ts` (to be created)
3. `backend/src/database/repositories/push-feedback.repository.ts` (to be created)
4. `backend/src/modules/admin/content-quality/content-quality.service.ts` (to be created)
5. `backend/src/modules/admin/content-quality/content-quality.controller.ts` (to be created)
6. `backend/src/modules/radar/controllers/push-feedback.controller.ts` (to be created)
7. `frontend/app/admin/content-quality/page.tsx` (to be created)
8. `frontend/components/radar/PushFeedbackForm.tsx` (to be created)
9. `frontend/components/admin/RatingDistributionChart.tsx` (to be created)
10. `frontend/components/admin/LowRatedPushList.tsx` (to be created)
11. `frontend/components/admin/PushFeedbackDetailDialog.tsx` (to be created)
12. `frontend/components/admin/QualityTrendChart.tsx` (to be created)
13. `frontend/e2e/content-quality.spec.ts` (to be created)

## Related Stories

- **Story 7.1**: 运营仪表板 - 系统健康监控 (已完成，提供仪表板基础设施)
- **Story 7.3**: 客户管理与流失风险预警 (待开发)
- **Story 7.4**: AI 成本优化工具 (待开发)
- **Story 5.4**: 推送历史查看 (已完成，提供推送列表基础)

## Dependencies

### Required (Completed)
- **Story 7.1**: 运营仪表板 - 系统健康监控 (已完成)
  - Provides: Admin module structure, Alert entity pattern
  - Provides: HealthMetricCard component pattern
- **Story 5.4**: 推送历史查看 (已完成)
  - Provides: Push detail dialog pattern
  - Provides: RadarPush entity and repository
- **Story 6.1**: 多租户数据模型与隔离机制 (已完成)
  - Provides: User entity, authentication guards

### Existing Infrastructure
- `radar_pushes` table (for push data)
- `users` table (for user data)
- Redis (for caching)
- Recharts (for charts)

## Success Metrics

- 用户反馈提交成功率 >= 98%
- 内容质量指标计算响应时间 < 2秒
- 低分推送识别准确率 100%
- 管理员满意度 >= 4.5/5.0
- 平均推送评分 >= 4.0/5.0 (目标)

---

**Story Created**: 2026-02-04
**Epic**: Epic 7 - 运营管理与成本优化
**Sprint**: TBD
**Estimated Effort**: 5 story points (约 2-3 个工作日)
