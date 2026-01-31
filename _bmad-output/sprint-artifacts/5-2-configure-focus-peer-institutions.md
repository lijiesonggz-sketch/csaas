# Story 5.2: 关注同业机构配置

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 金融机构 IT 总监,
I want 配置我关注的特定同业机构(如杭州银行、绍兴银行、招商银行),
So that 系统可以持续监控这些机构的技术分享、案例报道、招聘信息。

## Acceptance Criteria

### AC 1: 配置页面基础布局

**Given** 用户访问 /radar/settings
**When** 页面加载
**Then** 显示"关注同业机构"配置区域
**And** 显示已关注的同业机构列表(如有)
**And** 显示"添加关注同业"按钮
**And** 页面使用与其他雷达页面一致的布局和样式

**Implementation Notes:**
- 参考: Story 5.1 (关注技术领域) 页面布局模式
- 复用 Story 5.1 的配置页面结构
- 使用 Ant Design Card 组件展示配置区域
- 使用 Material-UI Grid 布局系统
- 面包屑导航: 雷达首页 → 配置管理

### AC 2: 添加关注同业功能

**Given** 用户点击"添加关注同业"
**When** 弹窗打开
**Then** 显示同业机构选择器,包含预设选项:
  - 杭州银行
  - 绍兴银行
  - 招商银行
  - 平安银行
  - 微众银行
  - 网商银行
  - 江苏银行
  - 宁波银行
**And** 支持自定义输入同业机构名称
**And** 支持按机构类型筛选(城商行、股份制银行、互联网银行)
**And** 显示每个机构的简短描述(帮助用户理解)

**Given** 用户选择同业机构
**When** 点击"确认"
**Then** 调用 API: `POST /api/radar/watched-peers`
**And** 创建 WatchedPeer 记录: organizationId, peerName, peerType, createdAt
**And** 更新前端显示,新增的同业出现在列表中
**And** 显示成功提示: message.success("已添加关注同业!系统将监控其技术动态")

**API Error Handling:**
- 400: "同业机构名称不能为空"
- 409: "该同业机构已在关注列表中"
- 500: "添加失败,请稍后重试"

### AC 3: 删除关注同业功能

**Given** 用户删除关注同业
**When** 点击同业卡片的"删除"按钮
**Then** 显示确认对话框: "确定取消关注该同业机构吗?"
**And** 用户确认后,调用 API: `DELETE /api/radar/watched-peers/:id`
**And** 删除对应的 WatchedPeer 记录
**And** 更新前端显示,移除该同业
**And** 显示成功提示: message.success("已取消关注")

**API Error Handling:**
- 404: "关注同业不存在"
- 500: "删除失败,请稍后重试"

### AC 4: 关注同业列表显示

**Given** 用户已配置关注同业
**When** 页面加载
**Then** 显示关注同业列表,每个同业卡片包含:
  - 同业机构名称(peerName)
  - 机构类型标签(peerType: 城商行/股份制/互联网)
  - 添加时间(createdAt,格式化为"YYYY-MM-DD")
  - 删除按钮(红色,带确认)
  - 相关推送数量统计(可选,如"已推送12条相关内容")
**And** 列表按添加时间倒序排列(最新添加的在前)
**And** 空状态显示: "暂无关注同业,点击上方按钮添加"

### AC 5: 关注同业影响推送相关性

**Given** 用户关注的同业机构已配置
**When** 行业雷达推送计算相关性
**Then** 相关性评分算法包含关注同业匹配权重 0.5
**And** 匹配的同业机构推送优先级提升
**And** 推送内容标注"与您关注的[同业名称]相关"

**Implementation Notes:**
- 后端相关性计算在 `backend/src/modules/radar/services/relevance.service.ts`
- 复用 Story 3.2 的行业雷达相关性计算框架
- 权重分配: 关注同业匹配 0.5 + 薄弱项匹配 0.3 + 关注领域匹配 0.2

## Tasks / Subtasks

### Phase 1: 后端API实现 - WatchedPeer CRUD (1天)

- [ ] **Task 1.1: 验证WatchedPeer实体** (AC: #2, #3)
  - [ ] 文件: `backend/src/database/entities/watched-peer.entity.ts`
  - [ ] **实体定义**:
    ```typescript
    @Entity('watched_peers')
    export class WatchedPeer {
      @PrimaryGeneratedColumn('uuid')
      id: string;

      @Column({ name: 'organization_id' })
      organizationId: string;

      @Column({ name: 'peer_name', length: 100 })
      peerName: string;

      @Column({
        name: 'peer_type',
        type: 'enum',
        enum: ['city_bank', 'joint_stock', 'internet_bank'],
        default: 'city_bank'
      })
      peerType: 'city_bank' | 'joint_stock' | 'internet_bank';

      @Column({ name: 'description', type: 'text', nullable: true })
      description: string;

      @CreateDateColumn({ name: 'created_at' })
      createdAt: Date;

      @ManyToOne(() => Organization)
      @JoinColumn({ name: 'organization_id' })
      organization: Organization;
    }
    ```
  - [ ] **如需添加字段**:
    - region: 地域(可选,如"浙江"、"江苏")
    - assetScale: 资产规模(可选,用于相似度匹配)
  - [ ] **完成标准**: 实体字段完整,符合架构规范

- [ ] **Task 1.2: 创建WatchedPeer DTO** (AC: #2, #3)
  - [ ] 文件: `backend/src/modules/radar/dto/watched-peer.dto.ts`
  - [ ] **CreateWatchedPeerDto**:
    ```typescript
    export class CreateWatchedPeerDto {
      @IsString()
      @IsNotEmpty()
      @MaxLength(100)
      peerName: string;

      @IsEnum(['city_bank', 'joint_stock', 'internet_bank'])
      @IsOptional()
      peerType?: 'city_bank' | 'joint_stock' | 'internet_bank' = 'city_bank';

      @IsString()
      @IsOptional()
      @MaxLength(500)
      description?: string;
    }
    ```
  - [ ] **WatchedPeerResponseDto**:
    ```typescript
    export class WatchedPeerResponseDto {
      id: string;
      organizationId: string;
      peerName: string;
      peerType: 'city_bank' | 'joint_stock' | 'internet_bank';
      description?: string;
      createdAt: string;
      relatedPushCount?: number;  // 可选统计字段
    }
    ```
  - [ ] 使用 class-validator 装饰器验证
  - [ ] **完成标准**: DTO 定义完整,验证规则正确

- [ ] **Task 1.3: 创建WatchedPeer Service** (AC: #2, #3, #4)
  - [ ] 文件: `backend/src/modules/radar/services/watched-peer.service.ts`
  - [ ] **实现方法**:
    ```typescript
    @Injectable()
    export class WatchedPeerService {
      async create(
        organizationId: string,
        dto: CreateWatchedPeerDto
      ): Promise<WatchedPeer> {
        // 1. 检查是否已存在
        const existing = await this.repository.findOne({
          where: {
            organizationId,
            peerName: dto.peerName
          }
        });
        if (existing) {
          throw new ConflictException('该同业机构已在关注列表中');
        }

        // 2. 创建记录
        const peer = this.repository.create({
          ...dto,
          organizationId
        });
        return await this.repository.save(peer);
      }

      async findAll(organizationId: string): Promise<WatchedPeer[]> {
        return await this.repository.find({
          where: { organizationId },
          order: { createdAt: 'DESC' }
        });
      }

      async delete(
        id: string,
        organizationId: string
      ): Promise<void> {
        const result = await this.repository.delete({
          id,
          organizationId
        });
        if (result.affected === 0) {
          throw new NotFoundException('关注同业不存在');
        }
      }

      async getRelatedPushCount(
        peerId: string
      ): Promise<number> {
        // 统计与该同业相关的推送数量(可选功能)
        // 查询 RadarPush 表,匹配 peerName 字段
        return 0; // MVP 阶段可返回0
      }
    }
    ```
  - [ ] 包含多租户隔离(organizationId过滤)
  - [ ] **完成标准**: Service 方法完整,包含错误处理

- [ ] **Task 1.4: 创建WatchedPeer Controller** (AC: #2, #3, #4)
  - [ ] 文件: `backend/src/modules/radar/controllers/watched-peer.controller.ts`
  - [ ] **实现端点**:
    ```typescript
    @Controller('radar/watched-peers')
    @UseGuards(OrganizationGuard)
    export class WatchedPeerController {
      @Post()
      async create(
        @CurrentOrg() orgId: string,
        @Body() dto: CreateWatchedPeerDto
      ): Promise<WatchedPeerResponseDto> {
        const peer = await this.service.create(orgId, dto);
        return this.toResponseDto(peer);
      }

      @Get()
      async findAll(
        @CurrentOrg() orgId: string
      ): Promise<WatchedPeerResponseDto[]> {
        const peers = await this.service.findAll(orgId);
        return peers.map(p => this.toResponseDto(p));
      }

      @Delete(':id')
      async delete(
        @Param('id') id: string,
        @CurrentOrg() orgId: string
      ): Promise<{ message: string }> {
        await this.service.delete(id, orgId);
        return { message: '已取消关注' };
      }
    }
    ```
  - [ ] 使用 OrganizationGuard 确保多租户隔离
  - [ ] 使用 @CurrentOrg() 装饰器自动注入 organizationId
  - [ ] **完成标准**: API 端点可正常调用,返回正确响应

- [ ] **Task 1.5: 注册到Radar Module** (AC: #2, #3, #4)
  - [ ] 文件: `backend/src/modules/radar/radar.module.ts`
  - [ ] 添加 WatchedPeerService 到 providers
  - [ ] 添加 WatchedPeerController 到 controllers
  - [ ] 添加 WatchedPeer 实体到 TypeORM imports
  - [ ] **完成标准**: Module 配置正确,依赖注入正常

### Phase 2: 扩展相关性计算支持关注同业 (0.5天)

- [ ] **Task 2.1: 扩展相关性计算Service** (AC: #5)
  - [ ] 文件: `backend/src/modules/radar/services/relevance.service.ts`
  - [ ] **扩展calculateIndustryRelevance方法**:
    ```typescript
    async calculateIndustryRelevance(
      content: AnalyzedContent,
      organizationId: string
    ): Promise<{ relevanceScore: number; priorityLevel: string }> {
      // 1. 关注同业匹配 (权重0.5) - 新增逻辑
      const peerMatch = await this.calculatePeerMatch(
        content,
        organizationId
      );

      // 2. 薄弱项匹配 (权重0.3) - 已有逻辑
      const weaknessMatch = await this.calculateWeaknessMatch(
        content,
        organizationId
      );

      // 3. 关注领域匹配 (权重0.2) - 已有逻辑
      const topicMatch = await this.calculateTopicMatch(
        content,
        organizationId
      );

      // 4. 计算最终评分
      const relevanceScore = (peerMatch * 0.5) + (weaknessMatch * 0.3) + (topicMatch * 0.2);

      // 5. 确定优先级
      const priorityLevel =
        relevanceScore >= 0.9 ? 'high' :
        relevanceScore >= 0.7 ? 'medium' : 'low';

      return { relevanceScore, priorityLevel };
    }

    private async calculatePeerMatch(
      content: AnalyzedContent,
      organizationId: string
    ): Promise<number> {
      // 1. 获取组织关注的同业机构
      const watchedPeers = await this.watchedPeerRepo.find({
        where: { organizationId }
      });

      if (watchedPeers.length === 0) {
        return 0; // 没有关注同业,返回0
      }

      // 2. 检查内容是否提及关注的同业
      const contentText = `${content.title} ${content.summary} ${content.fullContent}`;
      const matchedPeers = watchedPeers.filter(peer =>
        contentText.includes(peer.peerName)
      );

      // 3. 计算匹配度
      return matchedPeers.length > 0 ? 1.0 : 0.0;
    }
    ```
  - [ ] 参考: Story 3.2 行业雷达相关性计算模式
  - [ ] **完成标准**: 相关性计算包含关注同业权重,单元测试通过

- [ ] **Task 2.2: 扩展RadarPush关联信息** (AC: #5)
  - [ ] 文件: `backend/src/modules/radar/services/push.service.ts`
  - [ ] **推送时标注匹配的关注同业**:
    ```typescript
    async sendPush(pushId: string): Promise<void> {
      const push = await this.radarPushRepo.findOne({
        where: { id: pushId },
        relations: ['analyzedContent', 'organization']
      });

      // 查找匹配的关注同业
      const matchedPeers = await this.findMatchedPeers(
        push.analyzedContent,
        push.organizationId
      );

      // WebSocket 推送事件
      this.gateway.emit('radar:push:new', {
        ...push,
        matchedPeers: matchedPeers.map(p => p.peerName)
      });
    }

    private async findMatchedPeers(
      content: AnalyzedContent,
      organizationId: string
    ): Promise<WatchedPeer[]> {
      const watchedPeers = await this.watchedPeerRepo.find({
        where: { organizationId }
      });

      const contentText = `${content.title} ${content.summary} ${content.fullContent}`;
      return watchedPeers.filter(peer =>
        contentText.includes(peer.peerName)
      );
    }
    ```
  - [ ] **完成标准**: 推送事件包含 matchedPeers 字段

### Phase 3: 前端实现 - 配置页面 (1天)

- [ ] **Task 3.1: 扩展API客户端** (AC: #2, #3, #4)
  - [ ] 文件: `frontend/lib/api/radar.ts`
  - [ ] **添加类型定义**:
    ```typescript
    export interface WatchedPeer {
      id: string;
      organizationId: string;
      peerName: string;
      peerType: 'city_bank' | 'joint_stock' | 'internet_bank';
      description?: string;
      createdAt: string;
      relatedPushCount?: number;
    }

    export interface CreateWatchedPeerDto {
      peerName: string;
      peerType?: 'city_bank' | 'joint_stock' | 'internet_bank';
      description?: string;
    }
    ```
  - [ ] **实现API方法**:
    ```typescript
    export async function getWatchedPeers(
      organizationId: string
    ): Promise<WatchedPeer[]> {
      const response = await fetch(
        `/api/radar/watched-peers?organizationId=${organizationId}`
      );
      return response.json();
    }

    export async function createWatchedPeer(
      organizationId: string,
      dto: CreateWatchedPeerDto
    ): Promise<WatchedPeer> {
      const response = await fetch('/api/radar/watched-peers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...dto, organizationId })
      });
      return response.json();
    }

    export async function deleteWatchedPeer(
      id: string
    ): Promise<{ message: string }> {
      const response = await fetch(`/api/radar/watched-peers/${id}`, {
        method: 'DELETE'
      });
      return response.json();
    }
    ```
  - [ ] **完成标准**: API 方法可正确调用后端端点

- [ ] **Task 3.2: 扩展配置页面基础结构** (AC: #1)
  - [ ] 文件: `frontend/app/radar/settings/page.tsx`
  - [ ] **在现有页面添加关注同业区域**:
    ```typescript
    // 在现有的关注技术领域Card之后添加
    <Card sx={{ mt: 3 }}>
      <CardHeader
        title="关注同业机构"
        action={
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setAddPeerModalVisible(true)}
          >
            添加关注同业
          </Button>
        }
      />
      <CardContent>
        {/* 同业列表 */}
      </CardContent>
    </Card>
    ```
  - [ ] 复用 Story 5.1 的页面布局和样式
  - [ ] **完成标准**: 页面基础布局完成

- [ ] **Task 3.3: 实现关注同业列表** (AC: #4)
  - [ ] 文件: `frontend/app/radar/settings/page.tsx`
  - [ ] **列表渲染** (复用Story 5.1的列表组件结构):
    ```typescript
    {loading ? (
      <Skeleton variant="rectangular" height={200} />
    ) : peers.length === 0 ? (
      <Empty description="暂无关注同业,点击上方按钮添加" />
    ) : (
      <Grid container spacing={2}>
        {peers.map(peer => (
          <Grid item xs={12} sm={6} md={4} key={peer.id}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6">
                      {peer.peerName}
                    </Typography>
                    <Chip
                      label={getPeerTypeLabel(peer.peerType)}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(peer.id)}
                  >
                    <Delete />
                  </IconButton>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  添加时间: {formatDate(peer.createdAt)}
                </Typography>
                {peer.relatedPushCount !== undefined && (
                  <Typography variant="caption" color="primary">
                    已推送 {peer.relatedPushCount} 条相关内容
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    )}
    ```
  - [ ] 使用 Grid 布局,响应式设计
  - [ ] 空状态使用 Ant Design Empty 组件
  - [ ] **完成标准**: 列表正确显示,空状态友好

- [ ] **Task 3.4: 实现添加同业弹窗** (AC: #2)
  - [ ] 文件: `frontend/app/radar/settings/page.tsx`
  - [ ] **弹窗组件** (参考Story 5.1的弹窗结构):
    ```typescript
    const PRESET_PEERS = [
      { name: '杭州银行', type: 'city_bank', desc: '浙江省城商行标杆' },
      { name: '绍兴银行', type: 'city_bank', desc: '浙江省城商行' },
      { name: '招商银行', type: 'joint_stock', desc: '全国性股份制银行' },
      { name: '平安银行', type: 'joint_stock', desc: '全国性股份制银行' },
      { name: '微众银行', type: 'internet_bank', desc: '互联网银行' },
      { name: '网商银行', type: 'internet_bank', desc: '互联网银行' },
      { name: '江苏银行', type: 'city_bank', desc: '江苏省城商行' },
      { name: '宁波银行', type: 'city_bank', desc: '浙江省城商行' }
    ];

    const handleAdd = async () => {
      const peerName = selectedPeer || customPeer;
      if (!peerName) {
        message.warning('请选择或输入同业机构名称');
        return;
      }

      try {
        await createWatchedPeer(organizationId, {
          peerName,
          peerType: selectedPeerType || 'city_bank'
        });
        message.success('已添加关注同业!系统将监控其技术动态');
        setAddPeerModalVisible(false);
        loadPeers();
      } catch (error) {
        message.error(error.message || '添加失败');
      }
    };
    ```
  - [ ] 预设选项使用 Radio 组件
  - [ ] 支持自定义输入
  - [ ] 支持按机构类型筛选
  - [ ] **完成标准**: 弹窗交互流畅,添加成功

- [ ] **Task 3.5: 实现删除同业功能** (AC: #3)
  - [ ] 文件: `frontend/app/radar/settings/page.tsx`
  - [ ] **删除确认对话框** (复用Story 5.1的删除逻辑):
    ```typescript
    const handleDelete = (peerId: string) => {
      Modal.confirm({
        title: '确定取消关注该同业机构吗?',
        content: '取消后,系统将不再推送该同业的相关内容',
        okText: '确定',
        cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await deleteWatchedPeer(peerId);
            message.success('已取消关注');
            loadPeers();
          } catch (error) {
            message.error(error.message || '删除失败');
          }
        }
      });
    };
    ```
  - [ ] 使用 Ant Design Modal.confirm 组件
  - [ ] 删除按钮使用红色危险样式
  - [ ] **完成标准**: 删除功能正常,有确认提示

### Phase 4: 测试与文档 (0.5天)

- [ ] **Task 4.1: 后端单元测试** (AC: #2, #3, #4, #5)
  - [ ] 测试文件: `backend/src/modules/radar/services/watched-peer.service.spec.ts`
  - [ ] **测试用例** (参考Story 5.1的测试结构):
    - 应该成功创建关注同业
    - 应该拒绝重复的关注同业
    - 应该验证同业名称不为空
    - 应该返回组织的所有关注同业
    - 应该按创建时间倒序排列
    - 应该隔离不同组织的数据
    - 应该成功删除关注同业
    - 应该拒绝删除不存在的同业
    - 应该拒绝删除其他组织的同业
  - [ ] **完成标准**: 单元测试覆盖率≥80%,所有测试通过

- [ ] **Task 4.2: 相关性计算测试** (AC: #5)
  - [ ] 测试文件: `backend/src/modules/radar/services/relevance.service.peer.spec.ts`
  - [ ] **测试用例**:
    - 应该匹配关注同业
    - 应该正确计算权重(关注同业0.5 + 薄弱项0.3 + 关注领域0.2)
    - 应该组合三种匹配权重
  - [ ] **完成标准**: 相关性计算测试通过,权重正确

- [ ] **Task 4.3: 前端单元测试** (AC: #2, #3, #4)
  - [ ] 测试文件: `frontend/app/radar/settings/page.test.tsx`
  - [ ] **测试用例** (复用Story 5.1的测试模式):
    - 应该加载并显示关注同业列表
    - 应该显示空状态
    - 应该打开添加弹窗
    - 应该成功添加关注同业
    - 应该显示删除确认对话框
  - [ ] **完成标准**: 前端测试覆盖率≥70%,关键交互测试通过

## Dev Notes

### 架构模式与约束

**数据模型:**
- WatchedPeer实体与WatchedTopic实体结构相似
- 使用organizationId实现多租户隔离
- peerType枚举支持'city_bank'、'joint_stock'、'internet_bank'三种类型
- 本Story实现关注同业功能,与Story 5.1(关注技术领域)形成完整的用户配置体系

**相关性计算权重分配:**
```
行业雷达相关性 = 关注同业匹配(0.5) + 薄弱项匹配(0.3) + 关注领域匹配(0.2)
技术雷达相关性 = 薄弱项匹配(0.6) + 关注领域匹配(0.4)
```

**API端点规范:**
- 基础路径: `/api/radar/watched-peers`
- 使用OrganizationGuard确保多租户隔离
- 使用@CurrentOrg()装饰器自动注入organizationId
- 遵循RESTful规范: GET(列表), POST(创建), DELETE(删除)

**前端组件复用:**
- 复用Story 5.1的配置页面布局模式
- 在同一页面(/radar/settings)添加关注同业区域
- 使用Material-UI Card + Ant Design组件混合
- 保持与关注技术领域一致的视觉风格

### 项目结构对齐

**后端文件位置:**
```
backend/src/
├── database/entities/
│   └── watched-peer.entity.ts (新建)
├── modules/radar/
│   ├── dto/
│   │   └── watched-peer.dto.ts (新建)
│   ├── services/
│   │   ├── watched-peer.service.ts (新建)
│   │   └── relevance.service.ts (扩展)
│   ├── controllers/
│   │   └── watched-peer.controller.ts (新建)
│   └── radar.module.ts (更新)
```

**前端文件位置:**
```
frontend/
├── app/radar/settings/
│   └── page.tsx (扩展,添加关注同业区域)
├── lib/api/
│   └── radar.ts (扩展,添加WatchedPeer API)
└── components/radar/
    └── (复用现有组件)
```

### 技术栈与依赖

**后端依赖:**
- NestJS 10.4 (已有)
- TypeORM (已有)
- class-validator (已有)
- PostgreSQL (已有)

**前端依赖:**
- Next.js 14.2 (已有)
- React 18 (已有)
- Material-UI (已有)
- Ant Design (已有)
- 无需新增依赖

### 测试策略

**单元测试覆盖:**
- Service层: CRUD操作 + 多租户隔离
- 相关性计算: 权重计算 + 匹配逻辑
- 前端组件: 交互流程 + 状态管理

**E2E测试覆盖:**
- 完整用户流程: 添加 → 查询 → 删除
- 相关性影响验证: 关注同业 → 推送评分提升

### 关键技术决策

**1. 为什么不在RadarPush中冗余存储matchedPeers?**
- 遵循架构规范: 通过关联查询获取
- 避免数据冗余和同步问题
- 推送时动态计算,保证实时性

**2. 为什么权重是0.5+0.3+0.2而不是其他分配?**
- 关注同业是行业雷达的核心驱动(0.5),优先级最高
- 薄弱项是补充(0.3),确保与评估联动
- 关注领域是次要(0.2),扩展推送范围
- 参考PRD和架构文档的设计意图

**3. 为什么MVP阶段relatedPushCount返回0?**
- 统计功能非核心,可后续优化
- 避免复杂查询影响性能
- 前端UI已预留字段,后续扩展无需改动

**4. 为什么复用Story 5.1的配置页面?**
- 关注技术领域和关注同业是同一配置场景
- 统一的配置页面提供更好的用户体验
- 减少代码重复,提高开发效率

### 已知问题与限制

**MVP阶段限制:**
- 不支持批量添加关注同业
- 不支持同业描述编辑
- 不支持同业优先级排序
- 推送统计功能未实现(relatedPushCount=0)

**后续优化方向:**
- 添加同业推荐功能(基于机构规模、地域自动推荐)
- 支持同业分组管理(如"标杆机构"、"竞争对手")
- 添加同业热度统计
- 支持同业订阅通知设置

### 参考资料

**相关Story:**
- Story 5.1: 关注技术领域配置(配置页面布局参考)
- Story 3.1: 配置行业雷达信息源(行业雷达基础)
- Story 3.2: 同业案例匹配与推送(相关性计算参考)
- Story 2.2: AI分析引擎(相关性计算基础)
- Story 2.3: 推送系统(推送调度机制)

**架构文档:**
- `_bmad-output/architecture-radar-service.md` (核心架构)
- `_bmad-output/integration-architecture.md` (集成模式)
- `_bmad-output/prd-radar-service.md` (产品需求)
- `_bmad-output/epics.md` (Epic 5详细需求)

**代码规范:**
- 数据库命名: snake_case
- API命名: camelCase
- 文件命名: kebab-case
- 类命名: PascalCase

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

(待开发过程中填写)

### Completion Notes List

(待开发完成后填写)

### File List

**新增文件:**
- backend/src/database/entities/watched-peer.entity.ts
- backend/src/modules/radar/dto/watched-peer.dto.ts
- backend/src/modules/radar/services/watched-peer.service.ts
- backend/src/modules/radar/services/watched-peer.service.spec.ts
- backend/src/modules/radar/controllers/watched-peer.controller.ts
- backend/src/modules/radar/controllers/watched-peer.controller.spec.ts
- backend/src/modules/radar/services/relevance.service.peer.spec.ts

**修改文件:**
- backend/src/modules/radar/radar.module.ts (注册Service和Controller)
- backend/src/modules/radar/services/relevance.service.ts (扩展行业雷达相关性计算)
- frontend/app/radar/settings/page.tsx (添加关注同业区域)
- frontend/lib/api/radar.ts (添加WatchedPeer API方法)

