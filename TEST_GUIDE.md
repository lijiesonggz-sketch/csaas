# 标准解读优化功能测试指南

## 🎯 测试目标

验证优化后的标准解读功能是否生成：
1. ✅ 全量条款覆盖（30-60个条款，而非10个）
2. ✅ 6维深度解读（What/Why/How/Risk/Evidence/Tip）
3. ✅ 详细的风险评估（不合规风险+实施风险）
4. ✅ 证据清单（文档/系统/记录）
5. ✅ 检查清单（文档/系统/流程/访谈）
6. ✅ 实施路径规划（4个阶段）

---

## 🚀 服务状态检查

### 后端服务
```bash
# 检查后端是否运行
curl http://localhost:3000/health

# 查看后端日志
tail -f backend-dev.log
```

### 前端服务
```bash
# 前端应该运行在 http://localhost:3001
# 如果没有运行，启动：
cd frontend && npm run dev
```

---

## 📋 测试步骤

### 步骤1：准备测试标准文档

确保你有以下标准文档之一：
- ✅ GB/T 33136-2024（数据中心服务能力成熟度）
- ✅ GB/T 22239-2019（信息安全技术 网络安全等级保护）
- ✅ 或其他已上传到系统的标准

### 步骤2：访问标准解读页面

1. 打开浏览器访问：`http://localhost:3001`
2. 登录系统
3. 进入项目列表，选择一个有标准文档的项目
4. 点击项目，进入详情页
5. 点击左侧菜单的"标准解读"或直接访问：
   ```
   http://localhost:3001/projects/{projectId}/standard-interpretation
   ```

### 步骤3：选择解读模式

在页面顶部，你会看到：
```
解读模式：[企业级解读（深度）▼]
```

**三种模式说明：**

| 模式 | 特点 | 适用场景 | 预计条款数 | Token限制 |
|-----|------|---------|----------|-----------|
| **基础解读（快速）** | 快速生成概要 | 快速了解标准 | 15-30条 | 15000字符 |
| **详细解读（全面）** | 完整字段 | 深入理解标准 | 30-60条 | 25000字符 |
| **企业级解读（深度）** ⭐ | 最全面 | 生产环境推荐 | 30-60条 | 25000字符 |

**推荐：选择"企业级解读（深度）"进行测试**

### 步骤4：生成标准解读

1. 确保选择了"企业级解读（深度）"模式
2. 点击"生成标准解读"按钮
3. 观察进度提示：
   ```
   任务已创建，准备解读标准（enterprise模式）...
   正在调用三个AI模型并行解读标准...  (10%)
   三模型生成完成，开始质量验证...  (60%)
   质量验证完成，开始结果聚合...  (80%)
   任务完成  (100%)
   ```

### 步骤5：查看生成结果

等待生成完成后，结果会自动显示。重点检查：

#### 5.1 概述部分
- ✅ **制定背景**：是否包含修订历史？
- ✅ **核心变化**：是否有"与前一版本的主要变化"字段？

#### 5.2 关键术语
- ✅ 是否有**应用示例**字段？
```json
{
  "term": "数智运营",
  "definition": "...",
  "explanation": "...",
  "examples": ["监控数据驱动运维", "AI预测故障"]  // 新增
}
```

#### 5.3 关键要求（重点检查）

**检查点1：条款数量**
```bash
# 旧版本：约9-10个条款
# 新版本：应该有30-60个条款
```

**检查点2：每个条款的完整度**
```json
{
  "clause_id": "4.1.1",
  "chapter": "第4章 术语和定义",  // 新增
  "clause_full_text": "完整原文...",  // 新增
  "clause_summary": "一句话总结",  // 新增

  "interpretation": {  // 新结构（或旧格式兼容）
    "what": "条款要求的具体内容",
    "why": "为什么需要这个条款",
    "how": "如何满足条款要求"
  },

  "compliance_criteria": {  // 新结构（或旧格式兼容）
    "must_have": ["必须有A", "必须有B"],
    "should_have": ["建议有C"],
    "evidence_required": ["证据1", "证据2", "证据3"],  // 新增
    "assessment_method": "如何评估符合性"  // 新增
  },

  "risk_assessment": {  // 新增
    "non_compliance_risks": [
      {
        "risk": "风险描述",
        "consequence": "不合规的后果",
        "probability": "高",
        "mitigation": "缓解措施"
      }
    ],
    "implementation_risks": [...]
  },

  "implementation_order": 1,  // 新增
  "estimated_effort": "2-4周",  // 新增
  "dependencies": ["4.1.2"],  // 新增
  "best_practices": [...],  // 新增
  "common_mistakes": [...]  // 新增
}
```

#### 5.4 实施指引

**检查点3：新增字段**
```json
{
  "implementation_steps": [
    {
      "phase": "阶段名称",
      "order": 1,  // 新增
      "duration": "预估时长",  // 新增
      "objectives": ["目标1", "目标2"],  // 新增
      "steps": ["步骤1", "步骤2"],
      "deliverables": ["交付物1", "交付物2"]  // 新增
    }
  ],

  "checklists": {  // 新增
    "document_checklist": ["□ 文档1", "□ 文档2"],
    "system_checklist": ["□ 系统1", "□ 系统2"],
    "process_checklist": ["□ 流程1", "□ 流程2"],
    "interview_preparation": ["□ 访谈准备1", "□ 访谈准备2"]
  },

  "evidence_templates": [  // 新增
    {
      "clause": "6.2",
      "evidence_type": "系统截图",
      "description": "监控仪表盘截图",
      "sample_reference": "见附件A-1"
    }
  ],

  "resource_requirements": {  // 新格式（或兼容旧格式）
    "team": "团队配置要求",
    "budget": "预算估算",
    "tools": "需要的工具平台"
  }
}
```

#### 5.5 风险矩阵（新增）
```json
{
  "risk_matrix": {  // 整个字段是新增的
    "high_risk_clauses": ["4.1.1", "7.2", "7.3"],
    "common_failures": [
      {
        "clause": "6.2",
        "failure_point": "能力项评价缺乏数据支撑",
        "consequence": "成熟度评分虚高",
        "mitigation": "建立数字化监控体系"
      }
    ],
    "audit_focus_areas": ["数智引领", "技术运营", "保障驱动"]
  }
}
```

#### 5.6 实施路径规划（新增）
```json
{
  "implementation_roadmap": {  // 整个字段是新增的
    "phase_1_foundation": {
      "name": "基础建设阶段",
      "duration": "1-3个月",
      "clauses": ["4.1.1", "4.1.2"],
      "focus": "建立基础管理体系",
      "deliverables": ["战略文档", "组织架构"]
    },
    "phase_2_digitalization": {...},
    "phase_3_automation": {...},
    "phase_4_optimization": {...}
  }
}
```

---

## 🔍 后端日志验证

### 查看Prompt是否正确生成
```bash
# 查看后端日志，确认解读模式
tail -f backend-dev.log | grep "Interpretation mode"

# 应该看到类似输出：
# [Log] Interpretation mode: enterprise, maxTokens: 16000, content length: 45678
```

### 查看AI模型调用
```bash
# 查看是否调用了三个AI模型
tail -f backend-dev.log | grep -E "GPT4|Claude|Domestic|Tongyi"

# 应该看到三个模型的并行调用日志
```

### 查看质量验证和聚合
```bash
# 查看质量验证日志
tail -f backend-dev.log | grep "quality validation"

# 查看结果聚合日志
tail -f backend-dev.log | grep "aggregation"
```

---

## 📊 对比测试（可选）

如果你想对比新旧版本的差异：

### 方法1：导出对比
1. 先用"基础解读"模式生成一次，导出结果
2. 再用"企业级解读"模式生成一次，导出结果
3. 对比两个导出文件

### 方法2：数据库查询
```sql
-- 查看最近的解读任务
SELECT
  id,
  type,
  status,
  created_at,
  input->>'interpretationMode' as mode
FROM ai_tasks
WHERE type = 'standard_interpretation'
ORDER BY created_at DESC
LIMIT 5;

-- 查看详细的生成结果
SELECT
  task_id,
  selected_model,
  confidence_level,
  jsonb_array_length((selected_result->'key_requirements')::jsonb) as clause_count
FROM ai_generation_results
ORDER BY created_at DESC
LIMIT 5;
```

---

## ✅ 验收标准

**通过标准：**
1. ✅ 条款数量 ≥ 30个（企业级模式）
2. ✅ 每个条款包含 `risk_assessment` 字段
3. ✅ 每个条款包含 `implementation_order` 字段
4. ✅ 包含 `risk_matrix` 字段
5. ✅ 包含 `implementation_roadmap` 字段
6. ✅ 包含 `checklists` 字段
7. ✅ `compliance_criteria` 包含 `evidence_required` 子字段

**失败标准：**
- ❌ 条款数量 < 15个
- ❌ 没有 `risk_assessment` 字段
- ❌ 没有 `risk_matrix` 或 `implementation_roadmap` 字段
- ❌ JSON解析错误

---

## 🐛 常见问题排查

### 问题1：生成失败，查看错误日志
```bash
# 查看完整错误
tail -100 backend-dev.log | grep -A 10 "ERROR"

# 常见原因：
# - AI模型调用失败（API key错误、余额不足）
# - JSON解析失败（AI模型返回格式错误）
# - 内容长度超限（标准文档太长）
```

### 问题2：条款数量不够
```bash
# 检查prompt中的约束条件
# 确认prompt中明确要求"30-60个条款"
```

### 问题3：缺少新字段
```bash
# 检查AI模型输出
# 可能是AI模型没有遵循新的JSON格式
# 可以通过调整temperature参数来控制（降低到0.5）
```

### 问题4：前端显示不正常
```bash
# 清除浏览器缓存
# 或使用隐私模式重新访问
```

---

## 📝 测试记录模板

测试时请记录以下信息：

```markdown
## 测试记录

**测试日期：** 2025-01-15
**测试人员：** [你的名字]
**标准文档：** GB/T 33136-2024
**解读模式：** enterprise

**测试结果：**
- [ ] 前端界面正常（有模式选择器）
- [ ] 任务创建成功（显示模式名称）
- [ ] 生成进度正常（4个阶段进度显示）
- [ ] 条款数量：____ 个（预期 ≥30）
- [ ] 有 risk_assessment 字段：是/否
- [ ] 有 risk_matrix 字段：是/否
- [ ] 有 implementation_roadmap 字段：是/否
- [ ] 有 checklists 字段：是/否
- [ ] 生成时长：____ 秒

**问题记录：**
[记录发现的问题]

**截图/导出文件：**
[保存截图或导出文件]
```

---

## 🎬 下一步

测试完成后：
1. **如果测试通过** ✅
   - 提交代码到Git
   - 创建正式文档
   - 部署到生产环境

2. **如果发现问题** ❌
   - 记录问题详情
   - 查看后端日志定位原因
   - 调整Prompt参数
   - 重新测试

---

**准备好了吗？打开浏览器开始测试吧！** 🚀

访问：`http://localhost:3001/projects/{你的projectId}/standard-interpretation`
