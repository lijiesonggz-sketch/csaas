---
stepsCompleted: [1, 2, 3, 'all-stories-completed']
inputDocuments:
  - 'D:\csaas\_bmad-output\prd-radar-service.md'
  - 'D:\csaas\_bmad-output\architecture-radar-service.md'
  - 'D:\csaas\_bmad-output\ux-design-specification-radar-service.md'
completionDate: '2026-01-24'
totalEpics: 7
totalStories: 29
---

# Radar Service (Csaas Module) - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Radar Service, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**FR1**: 系统必须提供技术雷达功能，每周自动采集 GARTNER、信通院、IDC 等权威技术媒体的技术信息，进行 AI 分析、ROI 评估和优先级排序，并以周报形式推送给用户

**FR2**: 系统必须提供行业雷达功能，每日自动采集同业技术分享、行业报告精选、标杆案例，并根据相关性标注（高/中/低）推送给用户

**FR3**: 系统必须提供合规雷达功能，每日监控全国金融 IT 监管处罚通报和政策征求意见，提供 ROI 导向的应对剧本（包含自查清单、整改方案对比、向上级汇报模板）

**FR4**: 系统必须支持三重内容来源机制：基于评估薄弱项的被动触发推送、用户主动关注的技术领域推送、用户主动关注的特定同业机构动态推送

**FR5**: 系统必须与 Csaas 成熟度评估深度集成，自动识别用户的薄弱项（如"数据安全-2级"），并基于薄弱项计算推送内容的相关性和优先级

**FR6**: 系统必须提供 ROI 分析引擎，为每条推送内容计算预计投入、预期收益、ROI 估算、实施周期，并提供供应商推荐

**FR7**: 系统必须支持用户配置关注的技术领域（如云原生、AI 应用、移动金融安全、成本优化），并持续推送相关技术趋势

**FR8**: 系统必须支持用户配置关注的特定同业机构（如杭州银行、绍兴银行、招商银行），并持续监控这些机构的技术分享、案例报道、招聘信息、采购公告

**FR9**: 系统必须提供智能相关性过滤机制，每条推送信息经过 AI 相关性评分，标注为高相关（≥90%）、中相关（70-90%）、低相关（<70%），默认仅推送高相关内容

**FR10**: 系统必须支持咨询公司批量客户管理后台，允许咨询公司同时管理多个金融机构客户，为每个客户配置独立的雷达推送

**FR11**: 系统必须提供白标输出功能，推送内容以咨询公司品牌呈现（logo、公司名称），完全隐藏 Csaas 标识

**FR12**: 系统必须实现多租户数据隔离，咨询公司 A 的客户数据对咨询公司 B 完全不可见，采用 4 层防御机制（API 层权限校验 + 数据库行级安全 + 租户 ID 过滤 + 日志审计）

**FR13**: 系统必须提供推送历史查看功能，用户可查看所有历史推送内容，按雷达类型、时间、相关性筛选

**FR14**: 系统必须支持推送频率控制，用户可配置推送时段（如工作时间 9:00-18:00）和单日推送上限（默认 5 条）

**FR15**: 系统必须提供运营仪表板，展示系统健康状态（可用性、推送成功率、AI 共识一致性）、异常告警（爬虫失败、AI 成本超标、客户流失风险）

**FR16**: 系统必须支持内容质量管理，收集用户反馈（推送内容评分）、标记低分推送、提供优化建议

**FR17**: 系统必须提供客户管理系统，包含流失风险预警（月活率 < 60%）、批量配置优化、客户细分

**FR18**: 系统必须支持成本优化工具，实时追踪单客户 AI 调用成本，月均成本 > 500 元时触发告警

**FR19**: 系统必须提供统一的项目主页，显示"标准评估"和"Radar Service"两个模块入口，支持模块间无缝切换

**FR20**: 系统必须支持薄弱项聚合功能，将多个评估项目的薄弱项合并到组织级别（取最低成熟度等级），用户可筛选特定项目的推送

### Non-Functional Requirements

**NFR1**: 系统可用性必须 ≥99.5%（MVP 阶段），每月计划外停机 ≤ 3.6 小时；Growth 阶段提升至 ≥99.9%，每月停机 ≤ 43 分钟

**NFR2**: 推送成功率必须 ≥98%，推送消息成功送达用户

**NFR3**: 推送延迟必须满足：合规雷达 < 2 小时、行业雷达 < 4 小时、技术雷达 < 24 小时（从信息采集到用户收到）

**NFR4**: AI 相关性评分准确率必须 ≥80%（与黄金测试集对比），推送内容相关性用户评分 ≥4.0/5.0

**NFR5**: 单客户月均 AI 成本必须 < 500 元人民币，超过时触发告警

**NFR6**: 信息采集准确率必须 > 95%（三大雷达信息源准确抓取，无重复、无遗漏）

**NFR7**: 数据传输必须使用 TLS 1.2 或更高版本加密

**NFR8**: 敏感数据存储必须使用 256 位密钥长度加密（评估结果、薄弱项、IT 治理信息）

**NFR9**: 多租户数据隔离必须实现 100% 隔离率，季度渗透测试跨租户数据访问成功率为 0%

**NFR10**: 审计日志必须记录所有敏感操作（操作者、时间、操作类型、数据对象），日志保留 1 年，任何人无法篡改或删除

**NFR11**: 数据本地化：中国客户的所有数据必须存储在中国境内数据中心，不出境

**NFR12**: 符合《个人信息保护法》（PIPL）：咨询公司可随时导出所有自有数据（≤ 24 小时交付），注销后独占数据在 30 天内完全删除

**NFR13**: 系统必须支持水平扩展，MVP 阶段支持 5-10 个并发用户，Growth 阶段支持 50 个并发用户，响应时间退化 < 10%

**NFR14**: 单个 AI 模型处理响应时间 P95 ≤ 5 分钟

**NFR15**: 推送打开率必须 ≥70%，阅读完成率 ≥50%，基于推送采取行动率 ≥30%

**NFR16**: 客户续费率必须 > 70%（核心指标，证明持续价值）

**NFR17**: 试用转付费率必须 > 40%

**NFR18**: 客户月活用户比例：登录活跃 >90%，内容消费活跃 >85%，行动活跃 >60%

**NFR19**: Growth 阶段必须符合等保 2.0 三级认证要求

**NFR20**: 系统必须支持键盘导航完整性，核心操作支持键盘快捷键（无需鼠标）

### Additional Requirements

#### 架构附加需求

**AR1**: 系统必须采用组织级别数据模型，引入 Organization 实体，Project 关联到 Organization，Radar Service 是组织级别服务而非项目级别

**AR2**: 系统必须实现薄弱项快照（WeaknessSnapshot）机制，从多个项目聚合薄弱项到组织级别，默认取最低成熟度等级

**AR3**: 系统必须采用混合信息采集策略：开源爬虫自动采集 + 外部数据文件导入（支持 TXT/MD 格式）

**AR4**: 系统必须提供文件监控服务，使用 chokidar 监控 `backend/data-import/website-crawl/` 和 `backend/data-import/wechat-articles/` 文件夹，自动导入新文件

**AR5**: 系统必须使用通义千问（Qwen）单模型进行 AI 分析，而非三模型共识（简化架构，降低成本）

**AR6**: 系统必须实现 AI 结果缓存机制（Redis，24 小时 TTL），批量处理非实时任务以降低成本

**AR7**: 系统必须使用 BullMQ 队列进行信息采集调度，支持定时任务（cron job）、失败重试（指数退避，3 次）、多级降级

**AR8**: 系统必须复用 Csaas 的技术栈：NestJS 10.4 + TypeORM + PostgreSQL + Redis + BullMQ（后端），Next.js 14.2 + React 18 + Ant Design + Material-UI（前端）

**AR9**: 系统必须复用 Csaas 的认证系统（JWT + NestJS Guards）和 WebSocket Gateway（Socket.io）

**AR10**: 系统必须实现组织级别路由结构：`/radar/*`（雷达服务）独立于 `/projects/:projectId/*`（项目评估）

**AR11**: 系统必须使用 Zustand 进行前端状态管理，添加 radarStore 管理雷达相关状态

**AR12**: 系统必须实现 4 层多租户防御机制：API 层（NestJS Guards）+ 服务层（TypeORM Repository 过滤）+ 数据库层（PostgreSQL RLS）+ 审计层（操作日志）

**AR13**: 系统必须支持白标输出实现（Growth 阶段），前端动态加载租户品牌配置（logo、主题色），推送内容显示咨询公司品牌

**AR14**: 系统必须遵循命名规范：数据库表名 snake_case 复数、API 端点复数形式、代码文件 kebab-case、类名 PascalCase、函数名 camelCase

**AR15**: 系统必须实现 Redis 缓存键命名规范：`radar:ai:analysis:${contentHash}`（AI 结果）、`radar:weaknesses:${organizationId}`（薄弱项）、`radar:pushes:${organizationId}:${radarType}`（推送内容）

#### UX 附加需求

**UX1**: 系统必须提供首次登录引导流程，分三步设置：评估薄弱项识别 → 关注技术领域配置 → 关注同业机构配置

**UX2**: 系统必须在项目主页显示统一入口，每个项目卡片包含：标准评估进度、Radar Service 状态、快速操作按钮

**UX3**: 系统必须提供统一顶部导航：Dashboard（仪表板）、标准评估、Radar Service、报告中心

**UX4**: 系统必须提供面包屑导航，清晰标识当前位置（如："项目 A / Radar Service / 技术雷达"）

**UX5**: 系统必须实现推送内容卡片设计，包含：优先级标识（🥇🥈🥉）、相关性标注（🔴高相关/🟡中相关）、ROI 评分、关联薄弱项标签

**UX6**: 系统必须提供薄弱项聚合 UI，默认显示所有项目合并薄弱项，支持筛选器选择特定项目

**UX7**: 系统必须实现推送历史查看界面，支持按雷达类型、时间范围、相关性筛选

**UX8**: 系统必须提供配置管理界面，支持关注领域管理（添加/删除）、关注同业管理（添加/删除）、推送偏好设置

**UX9**: 系统必须实现咨询公司批量管理后台，支持多客户列表视图、批量配置操作、客户分组管理

**UX10**: 系统必须提供运营仪表板可视化，展示系统健康指标、异常告警、成本监控图表、客户活跃度趋势

**UX11**: 系统必须保持与 Csaas 平台一致的视觉设计语言（颜色、字体、图标、卡片样式）

**UX12**: 系统必须支持响应式设计，适配桌面端（1920x1080）和平板端（1024x768）

### FR Coverage Map

**FR1** → Epic 2 - 技术雷达功能（每周自动采集、AI 分析、ROI 评估、周报推送）
**FR2** → Epic 3 - 行业雷达功能（每日采集同业案例、相关性标注推送）
**FR3** → Epic 4 - 合规雷达功能（每日监控处罚通报、政策预警、应对剧本）
**FR4** → Epic 2, 3, 4 - 三重内容来源机制（薄弱项触发、关注领域、关注同业）
**FR5** → Epic 1 - 与 Csaas 评估深度集成（自动识别薄弱项、计算相关性）
**FR6** → Epic 2, 4 - ROI 分析引擎（投入、收益、ROI 估算、供应商推荐）
**FR7** → Epic 2, 5 - 用户配置关注技术领域（持续推送技术趋势）
**FR8** → Epic 3, 5 - 用户配置关注特定同业（持续监控同业动态）
**FR9** → Epic 2, 3, 4 - 智能相关性过滤机制（AI 评分、高/中/低标注）
**FR10** → Epic 6 - 咨询公司批量客户管理后台（多客户管理、独立配置）
**FR11** → Epic 6 - 白标输出功能（咨询公司品牌、隐藏 Csaas 标识）
**FR12** → Epic 6 - 多租户数据隔离（4 层防御机制）
**FR13** → Epic 5 - 推送历史查看功能（按雷达类型、时间、相关性筛选）
**FR14** → Epic 5 - 推送频率控制（配置时段、单日上限）
**FR15** → Epic 7 - 运营仪表板（系统健康状态、异常告警）
**FR16** → Epic 7 - 内容质量管理（用户反馈、低分推送标记、优化建议）
**FR17** → Epic 7 - 客户管理系统（流失风险预警、批量配置优化、客户细分）
**FR18** → Epic 7 - 成本优化工具（AI 成本追踪、超标告警）
**FR19** → Epic 1 - 统一项目主页（标准评估和 Radar Service 入口、模块切换）
**FR20** → Epic 1 - 薄弱项聚合功能（组织级别合并、取最低成熟度、项目筛选）

## Epic List

### Epic 1: 基础设施与 Csaas 集成
用户可以从 Csaas 平台无缝访问 Radar Service，系统自动识别评估薄弱项并准备推送基础设施。

**FRs covered:** FR5, FR19, FR20
**ARs covered:** AR1, AR2, AR8, AR9, AR10, AR11, AR12
**UXs covered:** UX1, UX2, UX3, UX4, UX6, UX11

### Epic 2: 技术雷达 - ROI 导向的技术决策支持
用户每周接收基于薄弱项的技术趋势推送，包含 ROI 分析、优先级排序和供应商推荐，帮助做出技术投资决策。

**FRs covered:** FR1, FR4, FR6, FR7, FR9
**ARs covered:** AR3, AR4, AR5, AR6, AR7, AR15
**UXs covered:** UX5

### Epic 3: 行业雷达 - 同业标杆学习
用户每日接收同业技术实践案例，可以关注特定金融机构（如杭州银行），持续监控其技术动态，获得可借鉴的实施方案。

**FRs covered:** FR2, FR4, FR8, FR9
**ARs covered:** AR3, AR4, AR5, AR6, AR7, AR15
**UXs covered:** UX5

### Epic 4: 合规雷达 - 风险预警与应对剧本
用户每日接收合规风险预警（监管处罚案例、政策征求意见），获得 ROI 导向的应对剧本（自查清单、整改方案对比、汇报模板），避免合规处罚。

**FRs covered:** FR3, FR4, FR6, FR9
**ARs covered:** AR3, AR4, AR5, AR6, AR7, AR15
**UXs covered:** UX5

### Epic 5: 用户配置与推送管理
用户可以配置关注领域、关注同业、推送偏好，查看推送历史，控制推送频率，获得个性化的雷达服务体验。

**FRs covered:** FR7, FR8, FR13, FR14
**UXs covered:** UX7, UX8

### Epic 6: 咨询公司多租户与白标输出
咨询公司可以批量管理多个金融机构客户，为每个客户配置独立雷达推送，推送内容以咨询公司品牌呈现，实现规模化服务。

**FRs covered:** FR10, FR11, FR12
**ARs covered:** AR12, AR13, AR14
**UXs covered:** UX9

### Epic 7: 运营管理与成本优化
平台管理员可以监控系统健康状态、内容质量、客户活跃度，优化 AI 成本，预警客户流失风险，持续改进雷达服务质量。

**FRs covered:** FR15, FR16, FR17, FR18
**UXs covered:** UX10

---

## Epic 1: 基础设施与 Csaas 集成

用户可以从 Csaas 平台无缝访问 Radar Service，系统自动识别评估薄弱项并准备推送基础设施。

### Story 1.1: 系统自动创建组织并将项目关联

As a 系统管理员,
I want 系统自动为每个用户创建组织（Organization），并将项目关联到组织,
So that Radar Service 可以在组织级别提供服务，而不是项目级别。

**Acceptance Criteria:**

**Given** 用户首次创建项目
**When** 项目创建成功
**Then** 系统自动创建一个 Organization 实体，Organization.name 默认为"用户的组织"
**And** Project.organizationId 关联到新创建的 Organization
**And** 创建 OrganizationMember 记录，将用户设为该组织的 admin

**Given** 用户已有组织
**When** 用户创建新项目
**Then** 新项目自动关联到用户的现有组织
**And** 不创建新的 Organization

**Given** 评估完成
**When** 系统识别到薄弱项
**Then** 创建 WeaknessSnapshot 实体，关联到 organizationId 和 projectId
**And** WeaknessSnapshot 包含 category（如"数据安全"）、level（如 2）、description

**Given** 组织有多个项目的薄弱项
**When** 系统聚合薄弱项
**Then** 按 category 分组，取最低 level（最薄弱）
**And** 记录薄弱项来源的 projectIds

### Story 1.2: Csaas 认证与权限集成

As a Csaas 用户,
I want 使用相同的登录凭证访问 Radar Service,
So that 我不需要重新登录或管理多个账号。

**Acceptance Criteria:**

**Given** 用户已登录 Csaas
**When** 用户访问 /radar 路由
**Then** 系统复用 Csaas 的 JWT token 验证用户身份
**And** 不需要重新登录

**Given** 用户访问 Radar Service API
**When** API 请求包含有效的 JWT token
**Then** OrganizationGuard 自动从 token 中提取 userId
**And** 查询用户所属的 organizationId
**And** 将 organizationId 注入到请求上下文中

**Given** 用户访问其他组织的数据
**When** API 请求的 organizationId 与用户所属组织不匹配
**Then** 返回 403 Forbidden 错误
**And** 记录审计日志

**Given** Csaas WebSocket Gateway 已存在
**When** Radar Service 需要推送通知
**Then** 复用现有的 Socket.io Gateway
**And** 使用 'radar:push:new' 事件名称

### Story 1.3: 评估完成后自动识别薄弱项

As a 金融机构 IT 总监,
I want 系统在评估完成后自动识别我的薄弱项,
So that Radar Service 可以基于薄弱项推送相关内容。

**Acceptance Criteria:**

**Given** 用户完成 Csaas 成熟度评估
**When** 评估结果保存成功
**Then** 系统通过 WebSocket 发送 'assessment:completed' 事件
**And** 事件包含 projectId 和评估结果

**Given** Radar Service 接收到 'assessment:completed' 事件
**When** 事件处理开始
**Then** 解析评估结果，提取所有成熟度等级 < 3 的领域作为薄弱项
**And** 为每个薄弱项创建 WeaknessSnapshot 记录
**And** 整个过程在 5 分钟内完成

**Given** 组织有多个项目
**When** 用户访问 Radar Service
**Then** 系统聚合所有项目的薄弱项
**And** 按 category 分组，显示最低 level
**And** 标注薄弱项来源的项目名称

**Given** 用户选择筛选特定项目
**When** 用户在 UI 中选择项目筛选器
**Then** 仅显示选中项目的薄弱项
**And** 推送内容基于筛选后的薄弱项

### Story 1.4: 统一导航与首次登录引导

As a Csaas 用户,
I want 从项目主页轻松访问 Radar Service，并在首次使用时获得引导,
So that 我可以快速了解和配置雷达服务。

**Acceptance Criteria:**

**Given** 用户登录 Csaas
**When** 用户访问项目主页（Dashboard）
**Then** 显示"Radar Service"入口卡片
**And** 卡片显示雷达服务状态（未激活/已激活）
**And** 点击卡片跳转到 /radar/dashboard

**Given** 用户首次访问 /radar
**When** 页面加载
**Then** 显示欢迎引导弹窗："欢迎使用 Radar Service！让我们设置您的雷达偏好"
**And** 引导包含三步：1) 薄弱项识别 2) 关注技术领域 3) 关注同业机构

**Given** 用户在引导步骤 1
**When** 页面显示
**Then** 自动显示系统识别的薄弱项（来自评估）
**And** 说明："系统已自动识别您的薄弱项，雷达将优先推送相关内容"
**And** 用户点击"下一步"进入步骤 2

**Given** 用户完成三步引导
**When** 用户点击"完成"
**Then** 标记 Radar Servicd** 跳转到 /radar/dashboard
**And** 显示三大雷达入口（技术、行业、合规）

**Given** 用户访问 /radar 的任何子路由
**When** 页面加载
**Then** 顶部导航显示：Dashboard | 标准评估 | Radar Service | 报告中心
**And** 面包屑导航显示当前位置（如："Dashboard / Radar Service / 技术雷达"）

---

## Epic 2: 技术雷达 - ROI 导向的技术决策支持

用户每周接收基于薄弱项的技术趋势推送，包含 ROI 分析、优先级排序和供应商推荐，帮助做出技术投资决策。

### Story 2.1: 自动采集技术信息并支持外部导入

As a 系统管理员,
I want 建立混合信息采集架构（开源爬虫 + 文件导入）,
So that 系统可以自动采集技术信息，并支持外部数据导入。

**Acceptance Criteria:**

**Given** 系统需要采集 GARTNER、信通院、IDC 等技术媒体信息
**When** 配置爬虫任务
**Then** 使用 BullMQ 创建定时任务（cron job），每日凌晨 2:00 触发
**And** 爬虫任务包含：source（信息源）、category（tech/industry/compliance）、url（目标网址）

**Given** 爬虫任务执行
**When** 采集开始
**Then** 使用开源爬虫库（Crawlee 或 Puppeteer-extra）抓取内容
**And** 解析文章标题、摘要、正文、发布日期、作者
**And** 保存到 RawContent 表（organizationId 为 null，表示公共内容）

**Given** 爬虫任务失败
**When** 失败次数 < 3
**Then** 使用指数退避重试（2s, 4s, 8s）
**And** 记录失败日志到 CrawlerLog 表

**Given** 外部数据文件放入 `backend/data-import/website-crawl/` 或 `backend/data-import/wechat-articles/`
**When** 文件监控服务（chokidar）检测到新文件
**Then** 解析文件 frontmatter（source, category, url, publishDate）
**And** 提取文章内容
**And** 保存到 RawContent 表
**And** 移动文件到 `processed/` 子文件夹

**Given** RawContent 保存成功
**When** 保存完成
**Then** 创建 BullMQ 任务 'ai:analyze-content'，传递 contentId
**And** 任务进入 AI 分析队列

**Given** 爬虫和文件导入机制建立完成
**When** Epic 3（行业雷达）和Epic 4（合规雷达）需要采集信息
**Then** Epic 3和Epic 4复用本Story建立的爬虫和文件导入机制
**And** 通过配置不同的source和category参数来支持行业雷达和合规雷达的信息采集
**And** 避免重复开发，确保代码复用率

### Story 2.2: 使用AI智能分析推送内容的相关性

As a 系统管理员,
I want 使用通义千问 AI 分析采集的内容，进行分类、相关性评分,
So that 系统可以智能匹配用户的薄弱项和关注领域。

**Acceptance Criteria:**

**Given** 'ai:analyze-content' 任务从队列中取出
**When** Worker 开始处理
**Then** 从 RawContent 表加载内容（title, summary, fullContent）
**And** 调用通义千问 API，传递 prompt：分析技术文章，提取技术分类、适用场景、关键词

**Given** 通义千问 API 返回结果
**When** 解析 AI 响应
**Then** 创建 AnalyzedContent 记录，包含：contentId、categories、keywords、targetAudience、analyzedAt

**Given** AI 分析结果需要缓存
**When** 分析完成
**Then** 将结果缓存到 Redis，key 为 `radar:ai:analysis:${contentHash}`
**And** TTL 设为 24 小时
**And** 相同内容再次分析时，直接从缓存读取

**Given** AI API 调用失败
**When** 失败次数 < 2
**Then** 重试一次（5 分钟后）
**And** 如果仍失败，标记为 'analysis_failed'，记录错误日志

**Given** AI 分析成功
**When** AnalyzedContent 保存完成
**Then** 创建 BullMQ 任务 'push:calculate-relevance'，传递 contentId
**And** 任务进入推送调度队列

**Given** AI 分析服务建立完成
**When** Epic 2（技术雷达）、Epic 3（行业雷达）和Epic 4（合规雷达）需要分析内容相关性
**Then** 三大雷达共享本Story建立的AI分析服务
**And** 通过配置不同的prompt参数来适配技术雷达、行业雷达和合规雷达的分析需求
**And** 统一使用通义千问模型进行内容分析、分类和相关性评分
**And** 避免重复开发，确保AI分析逻辑的一致性

### Story 2.3: 推送系统与调度s a 金融机构 IT 总监,
I want 系统根据我的薄弱项和关注领域，智能推送相关技术内容,
So that 我可以及时了解对我最有价值的技术趋势。

**Acceptance Criteria:**

**Given** 'push:calculate-relevance' 任务执行
**When** Worker 开始处理
**Then** 加载 AnalyzedContent 和所有活跃组织的 WeaknessSnapshot、WatchedTopic
**And** 对每个组织计算相关性评分（0-1）：薄弱项匹配权重 0.6，关注领域匹配权重 0.4
**And** 相关性评分 ≥ 0.9 标记为高相关，0.7-0.9 为中相关，< 0.7 为低相关

**Given** 相关性计算完成
**When** 找到高相关的组织
**Then** 创建 RadarPush 记录：organizationId、radarType: 'tech'、contentId、relevanceScore、priorityLevel、scheduledAt（下周五下午 5:00）、status: 'scheduled'

**Given** 技术雷达推送调度时间到达（每周五下午 5:00）
**When** 调度任务执行
**Then** 查询所有 status='scheduled' 且 radarType='tech' 且 scheduledAt <= now 的 RadarPush
**And** 按 organizationId 分组，每个组织最多推送 5 条（按 priorityLevel 和 relevanceScore 排序）

**Given** 推送内容准备完成
**When** 开始推送
**Then** 通过 WebSocket 发送 'radar:push:new' 事件到对应组织的用户
**And** 事件包含：pushId, radarType, title, summary, relevanceScore, priorityLevel
**And** 更新 RadarPush.status 为 'sent'，记录 sentAt 时间

**Given** 推送失败
**When** WebSocket 发送失败
**Then** 标记 RadarPush.status 为 'failed'
**And** 记录失败原因到 PushLog 表
**And** 推送成功率 = 成功数 / 总数，必须 ≥ 98%

### Story 2.4: 查看技术方案的ROI分析

As a 金融机构 IT 总监,
I want 每条技术推送包含 ROI 分析（预计投入、预期收益、ROI 估算）,
So that 我可以评估技术投资的性价比，做出明智决策。

**Acceptance Criteria:**

**Given** 技术雷达推送内容准备中
**When** 需要计算 ROI
**Then** 调用通义千问 API，分析：预计投入成本、预期收益、ROI 估算、实施周期、推荐供应商

**Given** 通义千问返回 ROI 分析结果
**When** 解析 AI 响应
**Then** 创建 ROIAnalysis 记录：pushId、estimatedCost、expectedBenefit、roiScore（0-10）、implementationTime、recommendedVendors

**Given** ROI 分析完成
**When** 推送内容发送
**Then** 推送事件包含 ROI 信息：estimatedCost、expectedBenefit、roiScore、implementationTime、vendors

**Given** ROI 分析需要缓存
**When** 分析完成
**Then** 缓存到 Redis，key 为 `radar:roi:${contentId}:${weaknessCategory}`
**And** TTL 设为 7 天（技术雷达周报周期）

### Story 2.5: 技术雷达前端展示

As a 金融机构 IT 总监,
I want 在技术雷达页面查看推送内容，包含 ROI 分析和优先级标识,
So that 我可以快速了解哪些技术对我最有价值。

**Acceptance Criteria:**

**Given** 用户访问 /radar/tech
**When** 页面加载
**Then** 显示技术雷达页面标题："技术雷达 - ROI 导向的技术决策支持"
**And** 显示推送内容列表（按 priorityLevel 和 sentAt 排序）

**Given** 推送内容卡片显示
**When** 渲染卡片
**Then** 卡片包含：优先级标识（🥇🥈🥉）、相关性标注（🔴🟡）、标题和摘要、ROI 评分、关联薄弱项标签、查看详情按钮

**Given** 用户点击"查看详情"
**When** 详情弹窗打开
**Then** 显示完整内容：文章全文、ROI 分析详情、信息来源和发布日期、操作按钮（收藏、分享、标记为已读）

**Given** 用户标记推送为已读
**When** 点击"标记为已读"
**Then** 更新 RadarPush.readAt 为当前时间
**And** 卡片显示"已读"标识
**And** 推送打开率 = 已读数 / 总推送数，目标 ≥ 70%

**Given** 用户收藏推送
**When** 点击"收藏"
**Then** 创建 PushBookmark 记录（userId, pushId）
**And** 用户可在"我的收藏"中查看

---

## Epic 3: 行业雷达 - 同业标杆学习

用户每日接收同业技术实践案例，可以关注特定金融机构（如杭州银行），持续监控其技术动态，获得可借鉴的实施方案。

### Story 3.1: 配置行业雷达的信息来源

As a 系统管理员,
I want 配置行业雷达的信息源（同业公众号、技术大会、招聘信息），并复用文件导入机制,
So that 系统可以自动采集同业技术实践案例，也支持外部数据导入。

**Acceptance Criteria:**

**Given** 复用 Epic 2 的信息采集架构（Story 2.1）
**When** 配置行业雷达爬虫任务
**Then** 创建 BullMQ 定时任务，category 设为 'industry'
**And** 配置信息源：同业公众号列表、技术大会网站、招聘网站（拉勾、Boss直聘）

**Given** 爬虫采集同业公众号文章
**When** 解析文章内容
**Then** 提取：发布机构名称、技术实践描述、投入成本（如有）、实施周期（如有）
**And** 保存到 RawContent 表，category='industry'

**Given** 爬虫采集招聘信息
**When** 解析职位描述
**Then** 提取：招聘机构、技术栈要求（如"熟悉 Kubernetes"）
**And** 推断：该机构正在使用或计划使用该技术
**And** 保存到 RawContent 表，标注 contentType='recruitment'

**Given** 复用 Epic 2 的文件导入机制（Story 2.1）
**When** 外部数据文件放入 `backend/data-import/website-crawl/` 或 `backend/data-import/wechat-articles/`
**Then** 文件监控服务（chokidar）检测到新文件
**And** 解析文件 frontmatter，如果 category='industry'，则作为行业雷达内容处理
**And** 保存到 RawContent 表，category='industry'
**And** 移动文件到 `processed/` 子文件夹

**Given** 行业雷达内容（爬虫或文件导入）保存成功
**When** RawContent 保存完成
**Then** 创建 BullMQ 任务 'ai:analyze-content'，传递 contentId
**And** 复用 Epic 2 的 AI 分析引擎（Story 2.2）进行分析

### Story 3.2: 同业案例匹配与推送

As a 金融机构 IT 总监,
I want 系统根据我关注的同业机构（如杭州银行），推送其技术实践案例,
So that 我可以学习标杆机构的经验，获得可借鉴的实施方案。

**Acceptance Criteria:**

**Given** 复用 Epic 2 的 AI 分析引擎（Story 2.2）
**When** 分析行业雷达内容
**Then** 额外提取：同业机构名称、技术实践场景、投入成本、实施周期、效果描述

**Given** 复用 Epic 2 的推送系统（Story 2.3）
**When** 计算行业雷达相关性
**Then** 相关性评分算法调整为：关注同业匹配（WatchedPeer）权重 0.5、薄弱项匹配权重 0.3、关注领域匹配权重 0.2
**And** 相关性评分 ≥ 0.9 标记为高相关，0.7-0.9 为中相关，< 0.7 为低相关

**Given** 行业雷达推送调度时间到达（每日早上 9:00）
**When** 调度任务执行
**Then** 查询所有 status='scheduled' 且 radarType='industry' 且 scheduledAt <= now 的 RadarPush
**And** 按 organizationId 分组，每个组织最多推送 2 条（避免信息过载）

**Given** 推送内容包含同业案例
**When** 推送事件发送
**Then** 事件包含：peerName（同业机构名称）、practiceDescription（实践描述）、cost（投入成本）、duration（实施周期）、outcome（效果）

### Story 3.3: 行业雷达前端展示

As a 金融机构 IT 总监,
I want 在行业雷达页面查看同业案例，按关注同业筛选,
So that 我可以快速找到标杆机构的实践经验。

**Acceptance Criteria:**

**Given** 用户访问 /radar/industry
**When** 页面加载
**Then** 显示行业雷达页面标题："行业雷达 - 同业标杆学习"
**And** 显示推送内容列表（按 sentAt 排序）
**And** 顶部显示筛选器：全部 | 我关注的同业 | 同规模机构 | 同地区机构

**Given** 推送内容卡片显示
**When** 渲染卡片
**Then** 卡片包含：同业机构名称、相关性标注（🔴🟡）、实践描述摘要、投入成本和实施周期（如有）、查看详情按钮

**Given** 用户点击"查看详情"
**When** 详情弹窗打开
**Then** 显示完整内容：同业机构背景、技术实践详细描述、投入成本/实施周期/效果、可借鉴点总结、信息来源和发布日期

**Given** 用户筛选"我关注的同业"
**When** 点击筛选器
**Then** 仅显示 peerName 匹配 WatchedPeer 的推送
**And** 高亮显示关注的同业机构名称

---

## Epic 4: 合规雷达 - 风险预警与应对剧本

用户每日接收合规风险预警（监管处罚案例、政策征求意见），获得 ROI 导向的应对剧本，避免合规处罚。

### Story 4.1: 配置合规雷达的信息来源

As a 系统管理员,
I want 配置合规雷达的信息源（监管网站、政策文件、处罚通报），并复用文件导入机制,
So that 系统可以自动监控合规风险，也支持外部数据导入。

**Acceptance Criteria:**

**Given** 复用 Epic 2 的信息采集架构（Story 2.1）
**When** 配置合规雷达爬虫任务
**Then** 创建 BullMQ 定时任务，category 设为 'compliance'
**And** 配置信息源：银保监会网站、人民银行网站、地方金融监管局网站

**Given** 爬虫采集监管处罚通报
**When** 解析通报内容
**Then** 提取：被处罚机构、处罚原因、处罚金额、处罚日期、政策依据
**And** 保存到 RawContent 表，category='compliance'，contentType='penalty'

**Given** 爬虫采集政策征求意见
**When** 解析政策文件
**Then** 提取：政策标题、征求意见截止日期、主要要求、实施时间（预计）
**And** 保存到 RawContent 表，contentType='policy_draft'
**And** 标注为高优先级（前瞻性预警）

**Given** 复用 Epic 2 的文件导入机制（Story 2.1）
**When** 外部数据文件放入 `backend/data-import/website-crawl/` 或 `backend/data-import/wechat-articles/`
**Then** 文件监控服务（chokidar）检测到新文件
**And** 解析文件 frontmatter，如果 category='compliance'，则作为合规雷达内容处理
**And** 保存到 RawContent 表，category='compliance'
**And** 移动文件到 `processed/` 子文件夹

**Given** 合规雷达内容（爬虫或文件导入）保存成功
**When** RawContent 保存完成
**Then** 创建 BullMQ 任务 'ai:analyze-content'，传递 contentId
**And** 复用 Epic 2 的 AI 分析引擎（Story 2.2）进行分析

### Story 4.2: 合规风险分析与应对剧本生成

As a 金融机构 IT 总监,
I want 系统分析合规风险，生成应对剧本（自查清单、整改方案、汇报模板）,
So that 我可以快速响应合规要求，避免处罚。

**Acceptance Criteria:**

**Given** 复用 Epic 2 的 AI 分析引擎（Story 2.2）
**When** 分析合规雷达内容
**Then** 额外提取：合规风险类别、处罚案例、政策要求、整改建议

**Given** 合规风险需要生成应对剧本
**When** 调用通义千问 API
**Then** 生成应对剧本：自查清单（5-10 项）、整改方案对比（2-3 个方案）、向上级汇报模板、政策依据链接

**Given** 通义千问返回应对剧本
**When** 解析 AI 响应
**Then** 创建 CompliancePlaybook 记录：pushId、checklistItems、solutions、reportTemplate、policyReference

**Given** 复用 Epic 2 的 ROI 分析引擎（Story 2.4）
**When** 计算整改方案 ROI
**Then** ROI 计算公式：(避免的罚款金额 - 整改投入) / 整改投入
**And** 示例：(50万罚款 - 10万整改) / 10万 = 4:1 ROI

**Given** 合规雷达推送调度（24/7 实时）
**When** 检测到高相关合规风险
**Then** 立即创建 RadarPush，status='scheduled'，scheduledAt=now
**And** 推送延迟 < 2 小时（从信息采集到用户收到）

### Story 4.3: 合规雷达前端展示与应对剧本

As a 金融机构 IT 总监,
I want 在合规雷达页面查看风险预警和应对剧本,
So that 我可以快速自查并启动整改流程。

**Acceptance Criteria:**

**Given** 用户访问 /radar/compliance
**When** 页面加载
**Then** 显示合规雷达页面标题："合规雷达 - 风险预警与应对剧本"
**And** 显示推送内容列表（按 priorityLevel 和 sentAt 排序）
**And** 高优先级推送置顶显示，标注 🚨

**Given** 推送内容卡片显示
**When** 渲染卡片
**Then** 卡片包含：风险类别标签、处罚案例摘要、相关性标注（🔴高相关）、ROI 分析摘要、查看应对剧本按钮

**Given** 用户点击"查看应对剧本"
**When** 详情弹窗打开
**Then** 显示完整应对剧本：自查清单（可勾选）、整改方案对比表格、向上级汇报模板（可复制）、政策依据链接

**Given** 用户完成自查清单
**When** 勾选所有项目
**Then** 系统记录自查完成时间
**And** 提示："自查完成！建议选择整改方案并向上级汇报"

**Given** 用户复制汇报模板
**When** 点击"复制汇报模板"
**Then** 模板文本复制到剪贴板
**And** 提示："已复制！可直接粘贴到邮件或报告中"

---

## Epic 5: 用户配置与推送管理

用户可以配置关注领域、关注同业、推送偏好，查看推送历史，控制推送频率，获得个性化的雷达服务体验。

### Story 5.1: 关注技术领域配置

As a 金融机构 IT 总监,
I want 配置我关注的技术领域（如云原生、AI 应用、移动金融安全）,
So that 系统可以持续推送相关技术趋势，而不仅仅是基于薄弱项。

**Acceptance Criteria:**

**Given** 用户访问 /radar/settings
**When** 页面加载
**Then** 显示"关注技术领域"配置区域
**And** 显示已关注的技术领域列表（如有）
**And** 显示"添加关注领域"按钮

**Given** 用户点击"添加关注领域"
**When** 弹窗打开
**Then** 显示技术领域选择器，包含预设选项：云原生、AI 应用、移动金融安全、成本优化、DevOps、数据安全、区块链、开放银行
**And** 支持自定义输入技术领域名称

**Given** 用户选择技术领域
**When** 点击"确认"
**Then** 创建 WatchedTopic 记录：organizationId、topicName、topicType: 'tech'、createdAt
**And** 更新前端显示，新增的领域出现在列表中
**And** 提示："已添加关注领域！系统将推送相关技术趋势"

**Given** 用户删除关注领域
**When** 点击领域卡片的"删除"按钮
**Then** 删除对应的 WatchedTopic 记录
**And** 更新前端显示，移除该领域
**And** 提示："已取消关注"

**Given** 用户关注的技术领域已配置
**When** 技术雷达推送计算相关性
**Then** 相关性评分算法包含关注领域匹配权重 0.4
**And** 匹配的技术领域推送优先级提升

### Story 5.2: 关注同业机构配置

As a 金融机构 IT 总监,
I want 配置我关注的特定同业机构（如杭州银行、绍兴银行、招商银行）,
So that 系统可以持续监控这些机构的技术分享、案例报道、招聘信息。

**Acceptance Criteria:**

**Given** 用户访问 /radar/settings
**When** 页面加载
**Then** 显示"关注同业机构"配置区域
**And** 显示已关注的同业机构列表（如有）
**And** 显示"添加关注同业"按钮

**Given** 用户点击"添加关注同业"
**When** 弹窗打开
**Then** 显示同业机构选择器，包含预设选项：杭州银行、绍兴银行、招商银行、平安银行、微众银行、网商银行、江苏银行、宁波银行
**And** 支持自定义输入同业机构名称
**And** 支持按机构类型筛选（城商行、股份制银行、互联网银行）

**Given** 用户选择同业机构
**When** 点击"确认"
**Then** 创建 WatchedPeer 记录：organizationId、peerName、peerType（城商行/股份制/互联网）、createdAt
**And** 更新前端显示，新增的同业出现在列表中
**And** 提示："已添加关注同业！系统将监控其技术动态"

**Given** 用户删除关注同业
**When** 点击同业卡片的"删除"按钮
**Then** 删除对应的 WatchedPeer 记录
**And** 更新前端显示，移除该同业
**And** 提示："已取消关注"

**Given** 用户关注的同业机构已配置
**When** 行业雷达推送计算相关性
**Then** 相关性评分算法包含关注同业匹配权重 0.5
**And** 匹配的同业机构推送优先级提升

### Story 5.3: 推送偏好设置

As a 金融机构 IT 总监,
I want 配置推送时段和单日推送上限,
So that 我可以控制推送频率，避免信息过载。

**Acceptance Criteria:**

**Given** 用户访问 /radar/settings
**When** 页面加载
**Then** 显示"推送偏好"配置区域
**And** 显示当前推送时段设置（默认：工作时间 9:00-18:00）
**And** 显示当前单日推送上限（默认：5 条）

**Given** 用户修改推送时段
**When** 选择开始时间和结束时间
**Then** 更新 PushPreference 记录：organizationId、pushStartTime、pushEndTime
**And** 提示："推送时段已更新"

**Given** 用户修改单日推送上限
**When** 输入数字（1-20）
**Then** 更新 PushPreference.dailyPushLimit
**And** 提示："单日推送上限已更新"

**Given** 推送调度任务执行
**When** 准备发送推送
**Then** 检查当前时间是否在用户配置的推送时段内
**And** 如果不在时段内，延迟推送到下一个时段开始时间
**And** 检查当日已推送数量是否达到上限
**And** 如果达到上限，推送延迟到次日

**Given** 用户配置推送相关性过滤
**When** 选择"仅推送高相关内容"（默认）或"推送高+中相关内容"
**Then** 更新 PushPreference.relevanceFilter
**And** 推送调度时仅推送符合过滤条件的内容

### Story 5.4: 推送历史查看

As a 金融机构 IT 总监,
I want 查看所有历史推送内容，按雷达类型、时间、相关性筛选,
So that 我可以回顾之前的推送，查找有价值的信息。

**Acceptance Criteria:**

**Given** 用户访问 /radar/history
**When** 页面加载
**Then** 显示推送历史页面标题："推送历史"
**And** 显示筛选器：雷达类型（全部/技术/行业/合规）、时间范围（最近7天/最近30天/自定义）、相关性（全部/高相关/中相关）
**And** 显示推送内容列表（按 sentAt 倒序排序）

**Given** 用户选择雷达类型筛选
**When** 选择"技术雷达"
**Then** 仅显示 radarType='tech' 的推送
**And** 更新列表显示

**Given** 用户选择时间范围筛选
**When** 选择"最近30天"
**Then** 仅显示 sentAt >= (now - 30天) 的推送
**And** 更新列表显示

**Given** 用户选择相关性筛选
**When** 选择"高相关"
**Then** 仅显示 relevanceScore >= 0.9 的推送
**And** 更新列表显示

**Given** 推送历史列表显示
**When** 渲染推送卡片
**Then** 卡片包含：雷达类型标签、标题和摘要、相关性标注、推送时间、查看详情按钮
**And** 已读推送显示"已读"标识

**Given** 用户点击"查看详情"
**When** 详情弹窗打开
**Then** 显示完整推送内容（复用各雷达的详情展示）
**And** 支持收藏、分享、标记为已读操作

**Given** 推送历史数据量大
**When** 列表滚动到底部
**Then** 自动加载下一页（分页加载，每页 20 条）
**And** 显示加载指示器

---

## Epic 6: 咨询公司多租户与白标输出

咨询公司可以批量管理多个金融机构客户，为每个客户配置独立雷达推送，推送内容以咨询公司品牌呈现，实现规模化服务。

### Story 6.1: 多租户数据模型与隔离机制

As a 系统架构师,
I want 实现 4 层多租户防御机制（API 层 + 服务层 + 数据库层 + 审计层）,
So that 咨询公司 A 的客户数据对咨询公司 B 完全不可见，确保数据安全。

**Acceptance Criteria:**

**Given** 系统需要支持多租户
**When** 设计数据模型
**Then** 所有核心表（Organization, Project, RadarPush, WatchedTopic, WatchedPeer）包含 tenantId 字段
**And** tenantId 关联到 Tenant 表（咨询公司）

**Given** API 层权限校验
**When** 用户请求 API
**Then** TenantGuard 从 JWT token 中提取 tenantId
**And** 验证用户是否属于该 tenant
**And** 如果不属于，返回 403 Forbidden
**And** 将 tenantId 注入到请求上下文中

**Given** 服务层数据过滤
**When** TypeORM Repository 查询数据
**Then** 自动添加 WHERE tenantId = :tenantId 条件
**And** 使用 BaseRepository 封装通用过滤逻辑
**And** 所有查询方法继承 BaseRepository

**Given** 数据库层行级安全（PostgreSQL RLS）
**When** 配置 RLS 策略
**Then** 为所有核心表启用 RLS
**And** 创建策略：USING (tenantId = current_setting('app.current_tenant')::uuid)
**And** 应用连接时设置 SET app.current_tenant = '<tenantId>'

**Given** 审计层操作日志
**When** 任何敏感操作执行（创建/更新/删除）
**Then** 记录审计日志：userId、tenantId、操作类型、数据对象、时间戳
**And** 日志保留 1 年，任何人无法篡改或删除
**And** 季度渗透测试跨租户数据访问成功率为 0%

### Story 6.2: 咨询公司批量客户管理后台

As a 咨询公司管理员,
I want 批量管理多个金融机构客户，为每个客户配置独立雷达推送,
So that 我可以规模化服务多个客户，提高运营效率。

**Acceptance Criteria:**

**Given** 咨询公司管理员登录
**When** 访问 /admin/clients
**Then** 显示客户管理后台页面标题："客户管理"
**And** 显示客户列表（按创建时间倒序）
**And** 每个客户卡片包含：客户名称、激活状态、月活率、推送统计、快速操作按钮

**Given** 管理员点击"添加客户"
**When** 弹窗打开
**Then** 显示客户信息表单：客户名称、联系人、联系邮箱、行业类型、机构规模
**And** 支持批量导入（CSV 文件）

**Given** 管理员提交客户信息
**When** 点击"确认"
**Then** 创建 Organization 记录：name、contactPerson、contactEmail、tenantId（咨询公司）
**And** 自动创建默认 PushPreference 配置
**And** 发送欢迎邮件到客户联系邮箱
**And** 提示："客户已添加！欢迎邮件已发送"

**Given** 管理员查看客户详情
**When** 点击客户卡片
**Then** 显示客户详情页面：基本信息、薄弱项列表、关注领域、关注同业、推送历史、活跃度趋势图

**Given** 管理员批量配置客户
**When** 选择多个客户，点击"批量配置"
**Then** 显示批量配置弹窗：统一设置推送时段、推送上限、相关性过滤
**And** 应用配置到所有选中客户
**And** 提示："批量配置已应用到 X 个客户"

**Given** 管理员客户分组管理
**When** 创建客户分组（如"城商行客户"、"试用客户"）
**Then** 创建 ClientGroup 记录：groupName、tenantId
**And** 支持将客户添加到分组
**And** 支持按分组筛选客户列表

### Story 6.3: 白标输出功能（Growth 阶段）

As a 咨询公司管理员,
I want 推送内容以我的品牌呈现（logo、公司名称），完全隐藏 Csaas 标识,
So that 客户认为这是我的专属服务，提升品牌价值。

**Acceptance Criteria:**

**Given** 咨询公司配置白标品牌
**When** 访问 /admin/branding
**Then** 显示品牌配置页面：上传 logo、设置公司名称、选择主题色、设置邮件签名
**And** 支持预览白标效果

**Given** 咨询公司上传 logo
**When** 上传图片文件（PNG/SVG）
**Then** 保存到 Tenant.brandLogoUrl
**And** 自动压缩和优化图片
**And** 提示："Logo 已更新"

**Given** 咨询公司设置主题色
**When** 选择颜色（色板或 HEX 输入）
**Then** 保存到 Tenant.brandPrimaryColor
**And** 前端动态加载主题色，应用到按钮、链接、标题
**And** 提示："主题色已更新"

**Given** 客户访问雷达服务
**When** 页面加载
**Then** 前端从 API 获取 Tenant 品牌配置
**And** 动态替换 logo（显示咨询公司 logo，隐藏 Csaas logo）
**And** 应用主题色到 UI 组件
**And** 页面标题显示咨询公司名称

**Given** 推送内容发送
**When** WebSocket 推送事件
**Then** 事件包含 brandName（咨询公司名称）
**And** 前端显示："来自 [咨询公司名称] 的推送"
**And** 完全隐藏 Csaas 标识

**Given** 邮件通知发送
**When** 发送推送摘要邮件
**Then** 邮件模板使用咨询公司 logo 和品牌色
**And** 邮件签名显示咨询公司联系方式
**And** 邮件发件人显示咨询公司名称

---

## Epic 7: 运营管理与成本优化

平台管理员可以监控系统健康状态、内容质量、客户活跃度，优化 AI 成本，预警客户流失风险，持续改进雷达服务质量。

### Story 7.1: 运营仪表板 - 系统健康监控

As a 平台管理员,
I want 监控系统健康状态（可用性、推送成功率、AI 共识一致性）,
So that 我可以及时发现异常，确保服务稳定运行。

**Acceptance Criteria:**

**Given** 管理员访问 /admin/dashboard
**When** 页面加载
**Then** 显示运营仪表板页面标题："运营仪表板"
**And** 显示系统健康指标卡片：可用性、推送成功率、AI 成本、客户活跃度

**Given** 系统健康指标计算
**When** 实时计算可用性
**Then** 可用性 = (总运行时间 - 停机时间) / 总运行时间 × 100%
**And** 目标：MVP 阶段 ≥99.5%，Growth 阶段 ≥99.9%
**And** 显示当前可用性和目标对比

**Given** 推送成功率计算
**When** 实时计算推送成功率
**Then** 推送成功率 = 成功推送数 / 总推送数 × 100%
**And** 目标：≥98%
**And** 显示当前推送成功率和目标对比
**And** 如果 < 98%，显示红色告警

**Given** AI 成本监控
**When** 实时计算 AI 成本
**Then** 显示今日 AI 成本、本月累计成本、单客户平均成本
**And** 目标：单客户月均成本 < 500 元
**And** 如果超标，显示红色告警

**Given** 异常告警显示
**When** 检测到异常
**Then** 显示告警列表：爬虫失败、AI 成本超标、客户流失风险
**And** 每条告警包含：告警类型、严重程度、发生时间、快速操作按钮
**And** 支持标记告警为"已处理"

**Given** 系统健康趋势图
**When** 渲染趋势图
**Then** 显示最近 30 天的可用性趋势、推送成功率趋势、AI 成本趋势
**And** 使用折线图可视化
**And** 支持切换时间范围（7天/30天/90天）

### Story 7.2: 内容质量管理

As a 平台管理员,
I want 收集用户反馈（推送内容评分），标记低分推送，提供优化建议,
So that 我可以持续改进推送内容质量，提升用户满意度。

**Acceptance Criteria:**

**Given** 用户查看推送详情
**When** 详情弹窗显示
**Then** 底部显示"内容评分"区域：5 星评分 + 可选文字反馈
**And** 提示："您的反馈帮助我们改进服务"

**Given** 用户提交评分
**When** 点击星级并提交
**Then** 创建 PushFeedback 记录：pushId、userId、rating（1-5）、comment、createdAt
**And** 提示："感谢您的反馈！"

**Given** 管理员访问 /admin/content-quality
**When** 页面加载
**Then** 显示内容质量管理页面标题："内容质量管理"
**And** 显示平均评分、评分分布图、低分推送列表

**Given** 低分推送识别
**When** 计算推送评分
**Then** 标记 rating < 3.0 的推送为"低分推送"
**And** 显示低分推送列表（按评分升序）
**And** 每条推送包含：标题、平均评分、反馈数量、查看详情按钮

**Given** 管理员查看低分推送详情
**When** 点击"查看详情"
**Then** 显示推送完整内容、所有用户反馈、AI 分析结果
**And** 显示优化建议：相关性评分过高/内容质量不佳/信息源不可靠
**And** 支持标记为"已优化"或"忽略"

**Given** 内容质量趋势分析
**When** 渲染趋势图
**Then** 显示最近 30 天的平均评分趋势、低分推送数量趋势
**And** 按雷达类型分组显示（技术/行业/合规）
**And** 目标：平均评分 ≥ 4.0/5.0

### Story 7.3: 客户管理与流失风险预警

As a 平台管理员,
I want 监控客户活跃度，预警流失风险（月活率 < 60%）,
So that 我可以及时干预，提升客户留存率。

**Acceptance Criteria:**

**Given** 管理员访问 /admin/clients
**When** 页面加载
**Then** 显示客户管理页面（复用 Story 6.2）
**And** 每个客户卡片显示月活率指标

**Given** 月活率计算
**When** 实时计算客户月活率
**Then** 月活率 = (最近 30 天活跃天数 / 30) × 100%
**And** 活跃定义：登录系统 OR 查看推送 OR 提交反馈
**And** 目标：登录活跃 >90%，内容消费活跃 >85%，行动活跃 >60%

**Given** 流失风险预警
**When** 检测到月活率 < 60%
**Then** 标记客户为"流失风险"
**And** 客户卡片显示红色告警标识
**And** 发送告警通知到管理员邮箱
**And** 提示："客户 [名称] 月活率 < 60%，建议联系客户"

**Given** 管理员查看流失风险客户
**When** 筛选"流失风险"客户
**Then** 显示所有月活率 < 60% 的客户
**And** 按月活率升序排序（最低的在前）
**And** 显示流失原因分析：推送内容不相关/推送频率过高/功能不满足需求

**Given** 管理员干预流失客户
**When** 点击"联系客户"
**Then** 显示联系信息（邮箱、电话）
**And** 提供干预建议：调整推送偏好/增加关注领域/提供培训
**And** 支持记录干预结果（已联系/已解决/已流失）

**Given** 客户细分分析
**When** 渲染客户细分图表
**Then** 按活跃度分组：高活跃（>85%）、中活跃（60-85%）、低活跃（<60%）
**And** 显示每组客户数量和占比
**And** 目标：高活跃客户占比 > 70%

### Story 7.4: AI 成本优化工具

As a 平台管理员,
I want 实时追踪单客户 AI 调用成本，月均成本 > 500 元时触发告警,
So that 我可以优化 AI 使用策略，控制运营成本。

**Acceptance Criteria:**

**Given** 管理员访问 /admin/cost-optimization
**When** 页面加载
**Then** 显示成本优化页面标题："AI 成本优化"
**And** 显示总成本、单客户平均成本、成本趋势图

**Given** AI 成本追踪
**When** 每次调用通义千问 API
**Then** 记录 AIUsageLog：organizationId、taskType（分析/ROI/剧本）、inputTokens、outputTokens、cost、timestamp
**And** cost 根据通义千问定价计算（输入 token 单价 × inputTokens + 输出 token 单价 × outputTokens）

**Given** 单客户成本计算
**When** 实时计算单客户月均成本
**Then** 单客户月均成本 = SUM(cost WHERE organizationId = X AND timestamp >= 本月1日)
**And** 目标：< 500 元人民币
**And** 如果 > 500 元，触发告警

**Given** 成本告警触发
**When** 检测到单客户成本超标
**Then** 创建告警记录：organizationId、currentCost、threshold（500元）、alertTime
**And** 发送告警通知到管理员邮箱
**And** 客户卡片显示"成本超标"标识

**Given** 成本优化建议
**When** 分析成本超标原因
**Then** 显示优化建议：减少 AI 分析频率/启用缓存/降低推送数量/优化 prompt 长度
**And** 显示成本分解：分析任务占比、ROI 任务占比、剧本任务占比
**And** 识别高成本客户（top 10）

**Given** 成本趋势分析
**When** 渲染成本趋势图
**Then** 显示最近 90 天的总成本趋势、单客户平均成本趋势
**And** 按客户分组显示成本排名
**And** 支持导出成本报告（CSV/Excel）

**Given** 批量成本优化
**When** 管理员选择多个高成本客户
**Then** 支持批量调整推送偏好：降低推送上限、启用更严格的相关性过滤
**And** 应用优化策略到所有选中客户
**And** 提示："成本优化策略已应用到 X 个客户"

---

## Document Completion

所有 7 个 Epic 的详细 Story 编写已完成！

**Epic 总结：**
- Epic 1: 基础设施与 Csaas 集成 (4 stories)
- Epic 2: 技术雷达 - ROI 导向的技术决策支持 (5 stories)
- Epic 3: 行业雷达 - 同业标杆学习 (3 stories)
- Epic 4: 合规雷达 - 风险预警与应对剧本 (3 stories)
- Epic 5: 用户配置与推送管理 (4 stories)
- Epic 6: 咨询公司多租户与白标输出 (3 stories)
- Epic 7: 运营管理与成本优化 (4 stories)

**总计：29 个详细的用户故事，覆盖所有功能需求和非功能需求。**
