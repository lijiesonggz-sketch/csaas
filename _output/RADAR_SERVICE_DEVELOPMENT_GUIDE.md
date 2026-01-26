# Radar Service 开发要点总结

**项目**: Radar Service (Csaas增值服务模块)
**设计系统**: MUI (Material-UI)
**文档版本**: v1.0
**最后更新**: 2026-01-23

---

## 📋 目录

1. [技术栈确认](#1-技术栈确认)
2. [核心组件开发优先级](#2-核心组件开发优先级)
3. [页面路由结构](#3-页面路由结构)
4. [API设计要点](#4-api设计要点)
5. [主题配置](#5-主题配置)
6. [关键交互逻辑](#6-关键交互逻辑)
7. [数据流架构](#7-数据流架构)
8. [MVP开发计划](#8-mvp开发计划)

---

## 1. 技术栈确认

### 前端技术栈

```typescript
// package.json 依赖
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "@mui/material": "^5.15.0",
    "@mui/icons-material": "^5.15.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.4.0",
    "zod": "^3.22.0"
  }
}
```

**关键技术选型**：
- **UI框架**: Next.js 14 (App Router)
- **UI组件库**: MUI 5.x
- **状态管理**: Zustand（轻量级）+ TanStack Query（服务端状态）
- **表单验证**: Zod
- **样式方案**: MUI sx prop + Emotion/Styled Components

### 后端技术栈

```typescript
// 已确认的Csaas技术栈
- Framework: NestJS
- ORM: Prisma
- Database: PostgreSQL
- Queue: BullMQ
- AI: 三模型架构（GPT-4 + Claude + 国产模型）
```

---

## 2. 核心组件开发优先级

### 优先级 P0（MVP必需 - 必须实现）

#### 组件1：RadarCard（推送卡片）⭐⭐⭐⭐⭐

**文件**: `frontend/components/radar/RadarCard.tsx`

**功能**:
- 显示推送的完整信息（标题、ROI、推荐理由）
- 三雷达类型区分（tech/industry/compliance）
- 反馈按钮（有用/无用/反馈）
- 相关性评分标签
- 乐观更新反馈状态

**核心代码**:
```tsx
interface RadarCardProps {
  type: 'tech' | 'industry' | 'compliance';
  title: string;
  relevanceScore: number;
  roiLevel: 'high' | 'medium' | 'low';
  roiData: {
    investment: number;
    expectedReturn: number;
    roi: string;
    time: string;
  };
  reasons: string[];
  feedbackStatus?: 'useful' | 'notUseful' | null;
  onFeedback: (type: 'useful' | 'notUseful') => void;
}

export function RadarCard({
  type, title, relevanceScore, roiLevel, roiData,
  reasons, feedbackStatus, onFeedback
}: RadarCardProps) {
  const theme = useTheme();

  // 三雷达颜色配置
  const radarColors = {
    tech: theme.palette.tech?.main || '#52C41A',
    industry: theme.palette.industry?.main || '#FA8C16',
    compliance: theme.palette.compliance?.main || '#F5222D'
  };

  return (
    <Card
      sx={{
        borderTop: `4px solid ${radarColors[type]}`,
        background: `linear-gradient(180deg, ${radarColors[type]}05 0%, transparent 100%)`,
      }}
    >
      {/* 实现详见UX设计文档 Step 11.2 */}
    </Card>
  );
}
```

**开发要点**:
- 使用MUI Card组件
- 顶部边框颜色区分雷达类型
- ROI数据必须包含投入、收益、ROI、时间成本
- 反馈按钮支持乐观更新

---

#### 组件2：ProjectHomeCard（项目主页雷达卡片）⭐⭐⭐⭐⭐

**文件**: `frontend/components/projects/RadarServiceCards.tsx`

**功能**:
- 显示雷达类型图标和名称
- 显示未读推送数量
- 显示高相关推送数量
- 点击跳转到推送列表页

**核心代码**:
```tsx
interface ProjectHomeCardProps {
  type: 'tech' | 'industry' | 'compliance';
  title: string;
  icon: string;
  unreadCount: number;
  highRelevanceCount: number;
  onClick: () => void;
}

export function ProjectHomeCard({
  type, title, icon, unreadCount,
  highRelevanceCount, onClick
}: ProjectHomeCardProps) {
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        {/* 雷达图标 */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2
        }}>
          <Typography sx={{ fontSize: 32 }}>{icon}</Typography>
        </Box>

        {/* 雷达名称 */}
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>

        {/* 未读数量徽章 */}
        {unreadCount > 0 && (
          <Badge
            badgeContent={unreadCount}
            color="error"
            sx={{ position: 'absolute', top: 8, right: 8 }}
          />
        )}

        {/* 推送摘要 */}
        <Typography variant="body2" color="text.secondary">
          本周推送 {totalCount}条
        </Typography>

        {highRelevanceCount > 0 && (
          <Typography variant="body2" sx={{ color: 'success.main' }}>
            🔴 高相关 {highRelevanceCount}条
          </Typography>
        )}
      </CardContent>

      <CardActions>
        <Button
          size="small"
          fullWidth
          endIcon={<ArrowForward />}
          onClick={onClick}
        >
          查看推送
        </Button>
      </CardActions>
    </Card>
  );
}
```

---

#### 组件3：ConfigPanel（配置面板）⭐⭐⭐⭐

**文件**: `frontend/components/radar/ConfigPanel.tsx`

**功能**:
- 关注领域管理
- 关注同业管理
- 推送频率设置
- 我的反馈历史

**核心代码**:
```tsx
export function ConfigPanel() {
  const { config, addTopic, removeTopic, syncConfig } = useRadarConfig();

  return (
    <Box sx={{ p: 3 }}>
      <Tabs>
        <Tab label="关注领域" />
        <Tab label="关注同业" />
        <Tab label="推送频率" />
        <Tab label="我的反馈" />
      </Tabs>

      {/* 关注领域Tab内容 */}
      <TabPanel value={0}>
        <Typography variant="h6" gutterBottom>
          已关注（{config.topics.length}个）
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {config.topics.map(topic => (
            <Chip
              key={topic}
              label={topic}
              onDelete={() => removeTopic(topic)}
              deleteIcon={<CloseIcon />}
              color="primary"
            />
          ))}
        </Box>

        <Button
          startIcon={<AddIcon />}
          onClick={() => {/* 打开添加对话框 */}}
        >
          添加关注领域
        </Button>
      </TabPanel>

      {/* 其他TabPanel... */}
    </Box>
  );
}
```

---

### 优先级 P1（重要 - MVP后实现）

#### 组件4：PushList（推送列表）⭐⭐⭐⭐

**功能**:
- 虚拟滚动（处理长列表）
- 搜索和筛选
- 推送卡片折叠/展开
- 上周推送折叠面板

**技术要点**:
```typescript
import { FixedSizeList as List } from 'react-window';

export function PushList({ pushes }: { pushes: PushData[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <RadarCard {...pushes[index]} />
    </div>
  );

  return (
    <AutoSizer>
      {({ height, width }) => (
        <List
          height={height}
          itemCount={pushes.length}
          itemSize={350}  // 每个卡片约350px
          width={width}
        >
          {Row}
        </List>
      )}
    </AutoSizer>
  );
}
```

---

## 3. 页面路由结构

### 路由架构

```typescript
// frontend/app/projects/[projectId]/radar/tech/page.tsx
export default function TechRadarPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* 面包屑导航 */}
      <Button onClick={() => router.back()}>
        ← 返回项目主页
      </Button>

      <Typography variant="h4" gutterBottom>
        📡 技术雷达推送
      </Typography>

      {/* Tabs切换三雷达 */}
      <RadarTabPanese currentType="tech" />
    </Container>
  );
}

// frontend/app/projects/[projectId]/radar/industry/page.tsx
export default function IndustryRadarPage() {
  // 同上，currentType="industry"
}

// frontend/app/projects/[projectId]/radar/compliance/page.tsx
export default function ComplianceRadarPage() {
  // 同上，currentType="compliance"
}
```

### 导航集成

**项目主页修改** (`frontend/app/projects/[projectId]/page.tsx`):

```typescript
// 在现有6个卡片后面添加3个雷达卡片
export default function ProjectWorkbenchPage() {
  const [project, setProject] = useState<Project | null>(null);

  // ... 现有代码 ...

  return (
    <Box>
      {/* 现有的6个Csaas卡片 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item>
          <ProjectStepCard step={steps[0]} />
        </Grid>
        {/* ... 其他卡片 */}
      </Grid>

      {/* 新增：Radar Service模块 */}
      <Divider sx={{ my: 4 }} />
      <Typography variant="h5" gutterBottom>
        【Radar Service - 智能推送】
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={4}>
          <ProjectHomeCard
            type="tech"
            title="技术雷达"
            icon="📡"
            unreadCount={3}
            highRelevanceCount={2}
            onClick={() => router.push(`/projects/${projectId}/radar/tech`)}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <ProjectHomeCard
            type="industry"
            title="行业雷达"
            icon="🏢"
            unreadCount={1}
            highRelevanceCount={0}
            onClick={() => router.push(`/projects/${projectId}/radar/industry`)}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <ProjectHomeCard
            type="compliance"
            title="合规雷达"
            icon="⚖️"
            unreadCount={0}
            highRelevanceCount={0}
            onClick={() => router.push(`/projects/${projectId}/radar/compliance`)}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
```

---

## 4. API设计要点

### API端点设计

```typescript
// backend/src/modules/radar/radar.controller.ts

@Controller('radar')
export class RadarController {
  constructor(private radarService: RadarService) {}

  // 获取推送列表
  @Get('pushes/:type')
  async getPushes(
    @Param('type') type: 'tech' | 'industry' | 'compliance',
    @Query('timeRange') timeRange: 'today' | 'week' | 'month' | 'all',
    @Query('relevance') relevance?: 'high' | 'medium' | 'low',
    @Param('projectId') projectId: string,
  ) {
    return this.radarService.getPushes(projectId, type, {
      timeRange,
      relevance,
    });
  }

  // 获取推送详情
  @Get('pushes/:pushId')
  async getPushDetail(@Param('pushId') pushId: string) {
    return this.radarService.getPushDetail(pushId);
  }

  // 提交反馈
  @Post('pushes/:pushId/feedback')
  async submitFeedback(
    @Param('pushId') pushId: string,
    @Body() feedback: { type: string; reason?: string }
  ) {
    return this.radarService.submitFeedback(pushId, feedback);
  }

  // 获取配置
  @Get('config')
  async getConfig(@Param('projectId') projectId: string) {
    return this.radarService.getConfig(projectId);
  }

  // 更新配置
  @Patch('config')
  async updateConfig(
    @Param('projectId') projectId: string,
    @Body() config: RadarConfigDto
  ) {
    return this.radarService.updateConfig(projectId, config);
  }

  // 搜索推送
  @Get('search')
  async searchPushes(
    @Param('projectId') projectId: string,
    @Query('q') query: string,
    @Query('type') type?: 'tech' | 'industry' | 'compliance'
  ) {
    return this.radarService.searchPushes(projectId, query, type);
  }
}
```

### 数据结构定义

```typescript
// backend/src/database/entities/radar-push.entity.ts
@Entity('radar_push')
export class RadarPush {
  @PrimaryColumn()
  id: string;

  @Column()
  projectId: string;

  @Column()
  type: 'tech' | 'industry' | 'compliance';

  @Column()
  title: string;

  @Column()
  relevanceScore: number; // 0-100

  @Column()
  roiLevel: 'high' | 'medium' | 'low';

  @Column('jsonb')
  roiData: {
    investment: number;
    expectedReturn: number;
    roi: string;
    time: string;
  };

  @Column('jsonb')
  reasons: string[];

  @Column({ nullable: true })
  feedbackStatus: 'useful' | 'notUseful' | null;

  @Column({ type: 'timestamp', default: () => () => new Date() })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date;

  @Column()
  status: 'pending' | 'sent' | 'read';

  @Column({ default: [] })
  tags: string[];
}
```

---

## 5. 主题配置

### MUI主题配置文件

**文件**: `frontend/config/themes/radar-theme.ts`

```typescript
import { createTheme, ThemeOptions } from '@mui/material';
import { deepmerge } from '@mui/utils';

// Csaas基础主题（继承）
const csaasBaseTheme: ThemeOptions = {
  palette: {
    primary: {
      main: '#1E3A8A',
    },
    typography: {
      fontFamily: 'Inter, -apple-system, "PingFang SC", sans-serif',
    },
  },
};

// Radar Service主题
export const radarTheme: ThemeOptions = deepmerge(csaasBaseTheme, {
  palette: {
    primary: {
      main: '#1E3A8A',
    },
    // 三雷达功能性色彩
    tech: {
      main: '#52C41A',
      light: '#6DDA84',
    },
    industry: {
      main: '#FA8C16',
      light: '#FFB84D',
    },
    compliance: {
      main: '#F5222D',
      light: '#FF6B6B',
    },
    // ROI等级色彩
    roiHigh: { main: '#10B981' },
    roiMedium: { main: '#FA8C16' },
    roiLow: { main: '#F5222D' },
    roiIgnore: { main: '#8C8C8C' },
  },

  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 4,
          },
        },
      },
    },
  },
});

// 深色模式主题
export const radarDarkTheme: ThemeOptions = deepmerge(radarTheme, {
  palette: {
    mode: 'dark',
    background: {
      default: '#121212',
      paper: '#1E1E1E',
    },
    primary: {
      main: '#3B82F6',
    },
    tech: { main: '#6DDA84' },
    industry: { main: '#FFB84D' },
    compliance: { main: '#FF6B6B' },
  },
});

// 租户主题（白标）
export function createTenantTheme(brandColor: string): ThemeOptions {
  return deepmerge(radarTheme, {
    palette: {
      primary: {
        main: brandColor,
      },
      // 三雷达颜色保持不变
    },
  });
}
```

### ThemeProvider使用

```typescript
// frontend/app/layout.tsx
import { ThemeProvider, CssBaseline } from '@mui/material';
import { radarTheme } from '@/config/themes/radar-theme';
import { TenantThemeProvider } from '@/components/providers/TenantThemeProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantThemeProvider>
      <ThemeProvider theme={createTheme(radarTheme)}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </TenantThemeProvider>
  );
}
```

---

## 6. 关键交互逻辑

### 交互1：评估驱动配置

**流程**: 评估完成 → 5分钟处理 → WebSocket通知 → 首次推送到达

**实现要点**:
```typescript
// backend/src/modules/ai-tasks/processors/evaluation-completion.processor.ts
export class EvaluationCompletionProcessor {
  async process(projectId: string) {
    // 1. 识别薄弱项
    const weaknesses = await this.identifyWeaknesses(projectId);

    // 2. 生成推荐配置
    const radarConfig = await this.generateRadarConfig(weaknesses);

    // 3. 启用Radar推送
    await this.radarService.enableForProject(projectId, radarConfig);

    // 4. WebSocket通知前端
    this.websocketService.notify(projectId, {
      type: 'radar-ready',
      unreadCount: 3,
    });
  }
}

// frontend/hooks/useRadarStatus.ts
export function useRadarStatus(projectId: string) {
  const [status, setStatus] = useState<'preparing' | 'ready'>('preparing');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const ws = new WebSocket(`wss://api/radar/status/${projectId}`);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'radar-ready') {
        setStatus('ready');
        setUnreadCount(message.unreadCount);

        toast.success('✅ Radar推送已准备就绪！', {
          action: {
            label: '立即查看',
            onClick: () => router.push(`/projects/${projectId}/radar/tech`)
          }
        });
      }
    };

    return () => ws.close();
  }, [projectId]);

  return { status, unreadCount };
}
```

---

### 交互2：反馈机制（乐观更新）

**流程**: 点击反馈 → 立即UI更新 → 后台异步提交 → 失败时回滚

**实现要点**:
```typescript
// frontend/components/radar/RadarCard.tsx
import { useMutation } from '@tanstack/react-query';

export function RadarCard({ ... }: RadarCardProps) {
  const queryClient = useQueryClient();

  const feedbackMutation = useMutation({
    mutationFn: async (feedback: { type: 'useful' | 'notUseful' }) => {
      return await api.submitFeedback(pushId, feedback);
    },

    onMutate: async ({ type }) => {
      // 1. 立即更新UI
      queryClient.setQueryData(['pushList'], (old: any[] | undefined) => {
        return old?.map((push: any) =>
          push.id === pushId
            ? { ...push, feedbackStatus: type, feedbackStatus: 'marked' }
            : push
        );
      });

      // 2. 显示Toast
      if (type === 'useful') {
        toast.success('✅ 感谢反馈！');
      }
    },

    onError: (error) => {
      // 3. 失败时回滚
      queryClient.invalidateQueries(['pushList']);
      toast.error('❌ 反馈提交失败，请重试');
    }
  });

  const handleFeedback = (type: 'useful' | 'notUseful') => {
    feedbackMutation.mutate({ type });
  };

  return (
    <IconButton onClick={() => handleFeedback('useful')}>
      👍 有用
    </IconButton>
  );
}
```

---

### 交互3：配置调整（前端优先 + 异步同步）

**流程**: 调整配置 → 前端立即生效 → debounce 1秒后同步服务端

**实现要点**:
```typescript
// frontend/stores/radarConfig.ts
import create from 'zustand';
import { persist } from 'zustand/middleware';

interface RadarConfig {
  topics: string[];
  peers: string[];
  frequency: 'daily' | 'weekly' | 'monthly';
}

export const useRadarConfig = create<RadarConfig>()(
  persist(
    (set, get) => ({
      topics: ['data-security', 'network-security'],
      peers: [],
      frequency: 'weekly',

      addTopic: (topic: string) => {
        set((state) => ({
          topics: [...state.topics, topic]
        }));

        // 立即同步
        syncConfig();
      },

      removeTopic: (topic: string) => {
        set((state) => ({
          topics: state.topics.filter(t => t !== topic)
        }));

        syncConfig();
      },

      // 异步同步函数（debounce）
      syncConfig: debounce(async () => {
        const config = get();
        await api.updateRadarConfig(config);
      }, 1000),
    }),
    {
      name: 'radar-config-storage',
    }
  )
);
```

---

## 7. 数据流架构

### 数据流向图

```
┌───────────────────────────────────────────────────────────┐
│                         Radar Service 数据流                         │
└───────────────────────────────────────────────────────────┘

评估数据流（路径A - 评估驱动）：
Csaas评估 → 识别薄弱项 → 生成推荐配置 → 启用Radar推送
   ↓              ↓              ↓              ↓
数据库 ←─────┘              ↓              ↓
薄弱项数据  →  配置数据      → 推送数据      → WebSocket通知

推送内容流：
外部数据源（Gartner/信通院/监管） → 内容采集 → AI分析 →
ROI分析 → 相关性评分 → 推送数据 → API响应

用户交互流：
用户操作 → 前端乐观更新 → API调用 → 数据库更新 →
WebSocket通知（配置更新） → 前端刷新

配置数据流：
配置面板 → 前端状态更新 → 异步同步服务端 →
数据库更新 → 算法重新计算 → 新推送生成
```

### 状态管理架构

```
┌─────────────────────────────────────────────────────────┐
│                      状态管理架构                            │
└─────────────────────────────────────────────────────────┘

全局状态：
├── useAuth() - Csaas认证状态
├── useProject() - 项目信息
├── useRadarConfig() - Radar配置（Zustand + localStorage）
└── useQueryClient() - 服务端状态（TanStack Query）

页面级状态：
├── useRadarPushes(type) - 推送列表数据
├── useRadarStatus() - Radar准备状态
└── useFeedback() - 反馈状态

组件级状态：
├── useProgressiveDisclosure() - 折叠/展开状态
├── useOptimisticUpdate() - 乐观更新逻辑
└── useFallbackData() - 错误恢复
```

---

## 8. MVP开发计划

### Week 1-2: 项目主页集成

**目标**: 在Csaas项目主页添加3个雷达卡片入口

**任务清单**:
- [ ] 创建ProjectHomeCard组件
- [ ] 修改项目主页页面，添加Radar Service区块
- [ ] 实现卡片点击跳转逻辑
- [ ] 添加未读数量徽章显示

**关键文件**:
```
frontend/components/projects/RadarServiceCards.tsx
frontend/app/projects/[projectId]/page.tsx (修改)
```

---

### Week 3-4: 推送列表页

**目标**: 实现三雷达推送列表页面

**任务清单**:
- [ ] 创建RadarCard核心组件
- [ ] 实现MUI Tabs切换
- [ ] 创建PushList组件（带虚拟滚动）
- [ ] 集成API获取推送数据
- [ ] 实现搜索和筛选功能
- [ ] 添加"加载骨架屏"

**关键文件**:
```
frontend/components/radar/RadarCard.tsx
frontend/components/radar/PushList.tsx
frontend/app/projects/[projectId]/radar/[type]/page.tsx
```

---

### Week 5-6: 核心功能

**目标**: 配置面板和反馈机制

**任务清单**:
- [ ] 创建ConfigPanel组件（4个Tab页）
- [ ] 实现关注领域管理（增删）
- [ ] 实现关注同业管理（搜索+添加）
- [ ] 实现推送频率设置
- [ ] 创建FeedbackButtons组件
- [ ] 实现乐观更新逻辑
- [ ] 添加Toast/Snackbar反馈

**关键文件**:
```
frontend/components/radar/ConfigPanel.tsx
frontend/components/radar/FeedbackButtons.tsx
frontend/stores/radarConfig.ts
```

---

### Week 7-8: 移动端优化

**目标**: 响应式布局和移动端优化

**任务清单**:
- [ ] 适配移动端布局（xs断点）
- [ ] 实现横向滚动Tab
- [ ] 优化触摸目标（≥44px）
- [ ] 添加汉堡菜单
- [ ] 性能测试（Lighthouse）
- [ ] 无障碍测试（WCAG AA）

**关键指标**:
- 移动端LCP ≤ 2.5s
- 触摸目标 ≥ 44px × 44px
- 颜色对比度 ≥ 4.5:1

---

## 🎯 开发检查清单

### 开始开发前

- [ ] 确认技术栈版本（Next.js 14, React 18, MUI 5）
- [ ] 确认数据库schema已创建
- [ ] 确认API路由已注册
- [ ] 设计assets准备完成（主题配置）

### 开发过程中

- [ ] 组件开发遵循设计规范
- [ ] API调用添加错误处理
- [ ] 所有用户操作提供反馈
- [ ] 关键交互添加loading状态

### 测试验证

- [ ] 单元测试（覆盖率 ≥ 70%）
- [ ] 组件Storybook文档
- [ ] E2E测试关键旅程
- [ ] 移动端真机测试
- [ ] Lighthouse性能测试

---

## 📦 交付物清单

### 设计交付物

1. ✅ MUI主题配置文件
2. ✅ UX设计规范文档
3. ✅ 组件交互规范
4. ⏳ Figma原型（可选，如需要可创建）

### 技术交付物

1. ✅ API端点定义
2. ✅ 数据库schema
3. ⏳ 组件Storybook（待创建）
4. ⏳ API文档

---

## 🚀 快速开始

### 立即开始

```bash
# 1. 安装依赖
cd frontend
npm install @mui/material @mui/icons-material @tanstack/react-query zustand zod

# 2. 创建主题文件
mkdir -p config/themes
# 复制上面的 radar-theme.ts 代码

# 3. 创建组件目录
mkdir -p components/radar
# 开始创建 RadarCard.tsx
```

### 开发优先级建议

**第一周**: 从RadarCard组件开始
**第二周**: 集成到项目主页
**第三周**: 完成推送列表页
**第四周**: 完成配置面板和反馈

---

**准备好开始了吗？需要我帮你做什么？** 😊

1. 创建RadarCard组件的完整代码？
2. 生成API接口文档？
3. 还是其他？

请告诉我！
