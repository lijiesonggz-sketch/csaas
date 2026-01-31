# Story 3.1 快速验证指南（10分钟版）

**适用场景**: 快速验证核心功能是否正常工作

---

## 🚀 快速验证步骤

### 1️⃣ 数据库验证（2分钟）

```bash
# 连接数据库，执行以下 SQL
psql -U your_username -d your_database

# 验证新字段
\d raw_contents

# 验证信息源表
SELECT COUNT(*) FROM radar_sources WHERE category = 'industry';
```

**预期结果**:
- ✅ `contentType` 和 `peerName` 字段存在
- ✅ 至少有 2 个行业雷达信息源

---

### 2️⃣ 管理界面验证（3分钟）

1. 访问：`http://localhost:3001/admin/radar-sources`
2. 点击"添加信息源"
3. 填写表单：
   - 名称：`测试信息源`
   - 类型：`行业雷达`
   - URL：`https://test.com`
4. 保存并验证列表中出现

**预期结果**:
- ✅ 页面正常加载
- ✅ 可以创建信息源
- ✅ 列表显示新创建的记录

---

### 3️⃣ 文件导入验证（3分钟）

创建测试文件：`backend/data-import/wechat-articles/quick-test.md`

```markdown
---
source: "测试公众号"
category: "industry"
contentType: "article"
peerName: "测试银行"
---

# 测试文章

这是一个测试文章，用于验证文件导入功能。
投入50万，历时3个月，效果显著。
```

等待 10 秒，然后查询数据库：

```sql
SELECT title, "contentType", "peerName"
FROM raw_contents
WHERE source = '测试公众号';
```

**预期结果**:
- ✅ 文件被处理
- ✅ 数据库有新记录
- ✅ `contentType` 和 `peerName` 正确

---

### 4️⃣ 清理测试数据（2分钟）

```sql
-- 删除测试记录
DELETE FROM raw_contents WHERE source = '测试公众号';
DELETE FROM radar_sources WHERE source = '测试信息源';
```

---

## ✅ 验证通过标准

- [ ] 数据库字段存在
- [ ] 管理界面可用
- [ ] 文件导入正常
- [ ] 数据正确保存

**如果以上 4 项全部通过，Story 3.1 验证成功！** 🎉

---

## 🐛 快速问题排查

**问题**: 管理页面 404
**解决**: `cd frontend && npm run dev`

**问题**: 数据库字段不存在
**解决**: `cd backend && npm run migration:run`

**问题**: 文件导入不工作
**解决**: 检查后端日志，确认文件监控服务已启动

---

**验证时间**: 约 10 分钟
**难度**: ⭐⭐☆☆☆ 简单
