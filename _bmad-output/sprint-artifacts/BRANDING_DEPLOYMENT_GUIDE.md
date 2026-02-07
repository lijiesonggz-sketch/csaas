# 白标输出功能 - 部署指南

## Story 6.3: 白标输出功能

本文档描述如何部署和配置白标输出功能。

---

## 目录

- [环境要求](#环境要求)
- [后端配置](#后端配置)
- [前端配置](#前端配置)
- [文件存储配置](#文件存储配置)
- [数据库迁移](#数据库迁移)
- [验证部署](#验证部署)
- [故障排查](#故障排查)

---

## 环境要求

### 后端
- Node.js >= 18.x
- NestJS >= 10.x
- TypeORM
- PostgreSQL >= 14.x
- Sharp (图片处理库)

### 前端
- Next.js >= 14.x
- React >= 18.x
- Material-UI >= 5.x

---

## 后端配置

### 1. 安装依赖

```bash
cd backend
npm install sharp multer @types/multer
```

### 2. 环境变量配置

在 `backend/.env` 中添加以下配置:

```env
# 文件上传配置
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=2097152  # 2MB in bytes

# 静态资源服务
STATIC_ASSETS_PATH=/uploads
```

### 3. 创建上传目录

```bash
mkdir -p backend/uploads/tenants
chmod 755 backend/uploads
```

### 4. 配置静态资源服务

在 `backend/src/main.ts` 中已配置:

```typescript
import { NestExpressApplication } from '@nestjs/platform-express'
import { join } from 'path'

const app = await NestFactory.create<NestExpressApplication>(AppModule)

// 配置静态资源服务
app.useStaticAssets(join(__dirname, '..', 'uploads'), {
  prefix: '/uploads/',
})
```

---

## 前端配置

### 1. 环境变量配置

在 `frontend/.env.local` 中添加:

```env
# API 地址
NEXT_PUBLIC_API_URL=http://localhost:3001

# 文件上传配置
NEXT_PUBLIC_MAX_LOGO_SIZE=2097152  # 2MB
```

### 2. 集成 BrandProvider

BrandProvider 已集成到 `frontend/lib/providers.tsx`:

```typescript
import { BrandProvider } from '@/components/layout/BrandProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BrandProvider>
        <ConfigProvider>
          {children}
        </ConfigProvider>
      </BrandProvider>
    </SessionProvider>
  )
}
```

---

## 文件存储配置

### 本地文件系统 (默认)

默认使用本地文件系统存储 Logo 文件。

**存储路径**: `backend/uploads/tenants/{tenantId}/logo.{ext}`

**优点**:
- 简单易用
- 无需额外配置

**缺点**:
- 不适合多实例部署
- 需要定期备份

### 云存储 (推荐生产环境)

#### 阿里云 OSS

1. 安装依赖:
```bash
npm install ali-oss
```

2. 配置环境变量:
```env
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=your_access_key
OSS_ACCESS_KEY_SECRET=your_secret_key
OSS_BUCKET=your_bucket_name
```

3. 修改 `FileUploadService`:
```typescript
// 使用 OSS 上传
const result = await this.ossClient.put(
  `tenants/${tenantId}/logo.${ext}`,
  file.buffer
)
return result.url
```

#### AWS S3

1. 安装依赖:
```bash
npm install @aws-sdk/client-s3
```

2. 配置环境变量:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=your_bucket_name
```

---

## 数据库迁移

### 1. 检查 Tenant 表结构

确保 `tenant` 表包含 `brandConfig` 字段:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tenants'
  AND column_name = 'brand_config';
```

### 2. 如果字段不存在，运行迁移

```bash
cd backend
npm run migration:run
```

### 3. 验证数据结构

```sql
-- 查看 brandConfig 默认值
SELECT id, name, brand_config
FROM tenants
LIMIT 5;
```

预期结果:
```json
{
  "brandLogoUrl": null,
  "brandPrimaryColor": "#1890ff",
  "brandSecondaryColor": null,
  "companyName": null,
  "emailSignature": null,
  "contactPhone": null,
  "contactEmail": null
}
```

---

## 验证部署

### 1. 后端 API 验证

#### 获取品牌配置
```bash
curl -X GET http://localhost:3001/api/v1/admin/branding \
  -H "Authorization: Bearer <admin_token>"
```

预期响应:
```json
{
  "success": true,
  "data": {
    "brandPrimaryColor": "#1890ff",
    ...
  }
}
```

#### 上传 Logo
```bash
curl -X POST http://localhost:3001/api/v1/admin/branding/logo \
  -H "Authorization: Bearer <admin_token>" \
  -F "file=@/path/to/logo.png"
```

预期响应:
```json
{
  "success": true,
  "data": {
    "logoUrl": "http://localhost:3001/uploads/tenants/xxx/logo.png"
  }
}
```

### 2. 前端页面验证

1. 访问品牌配置页面:
   ```
   http://localhost:3000/admin/branding
   ```

2. 验证功能:
   - ✅ 页面正常加载
   - ✅ 显示配置表单
   - ✅ 显示实时预览
   - ✅ 可以上传 Logo
   - ✅ 可以设置主题色
   - ✅ 可以保存配置

3. 验证品牌应用:
   - ✅ 访问其他页面，品牌配置生效
   - ✅ 推送卡片显示品牌信息
   - ✅ 页面标题显示公司名称

### 3. 运行测试

#### 后端单元测试
```bash
cd backend
npm test -- --testPathPattern="branding"
```

预期结果: 24 个测试通过

#### 前端 E2E 测试
```bash
cd frontend
npx playwright test branding.spec.ts
```

---

## 故障排查

### 问题 1: Logo 上传失败

**症状**: 上传 Logo 时返回 500 错误

**可能原因**:
1. Sharp 库未正确安装
2. 上传目录权限不足
3. 文件大小超过限制

**解决方案**:
```bash
# 重新安装 Sharp
cd backend
npm uninstall sharp
npm install sharp

# 检查目录权限
ls -la uploads/
chmod 755 uploads/

# 检查文件大小限制
# 在 .env 中设置 MAX_FILE_SIZE=2097152
```

### 问题 2: 静态资源无法访问

**症状**: Logo URL 返回 404

**可能原因**:
1. 静态资源服务未配置
2. 文件路径不正确

**解决方案**:
```typescript
// 检查 main.ts 配置
app.useStaticAssets(join(__dirname, '..', 'uploads'), {
  prefix: '/uploads/',
})

// 验证文件存在
ls -la backend/uploads/tenants/
```

### 问题 3: 品牌配置不生效

**症状**: 前端页面未应用品牌配置

**可能原因**:
1. BrandProvider 未正确集成
2. API 返回错误
3. localStorage 缓存问题

**解决方案**:
```javascript
// 清除 localStorage 缓存
localStorage.removeItem('tenant_branding_config')

// 检查 BrandProvider 是否加载
console.log('BrandProvider loaded:', !!window.localStorage)

// 检查 API 响应
fetch('/api/v1/tenant/branding')
  .then(r => r.json())
  .then(console.log)
```

### 问题 4: 推送事件不包含 brandName

**症状**: 推送卡片不显示品牌信息

**可能原因**:
1. 推送处理器未更新
2. Organization 未关联 Tenant

**解决方案**:
```sql
-- 检查 Organization 是否有 tenantId
SELECT id, name, tenant_id
FROM organizations
WHERE tenant_id IS NULL;

-- 如果有 NULL 值，需要修复数据
UPDATE organizations
SET tenant_id = (SELECT id FROM tenants LIMIT 1)
WHERE tenant_id IS NULL;
```

### 问题 5: 图片压缩失败

**症状**: 上传大图片时失败

**可能原因**:
1. Sharp 内存不足
2. 图片格式不支持

**解决方案**:
```typescript
// 增加 Sharp 内存限制
sharp.cache(false)
sharp.concurrency(1)

// 检查支持的格式
const supportedFormats = ['image/png', 'image/jpeg', 'image/svg+xml']
```

---

## 性能优化

### 1. 图片 CDN

将上传的 Logo 文件放到 CDN:

```typescript
// 配置 CDN 前缀
const CDN_PREFIX = process.env.CDN_PREFIX || ''
const logoUrl = `${CDN_PREFIX}/uploads/tenants/${tenantId}/logo.png`
```

### 2. 缓存策略

前端缓存品牌配置:

```typescript
// BrandProvider 已实现 1 小时缓存
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour
```

### 3. 图片优化

- 自动压缩到最大宽度 400px
- 保持宽高比
- 使用 WebP 格式 (可选)

---

## 安全注意事项

### 1. 文件上传安全

- ✅ 验证文件类型 (仅允许 PNG/JPG/SVG)
- ✅ 限制文件大小 (最大 2MB)
- ✅ 文件名随机化，防止路径遍历
- ✅ 使用 Sharp 重新处理图片，防止恶意文件

### 2. 权限控制

- ✅ 品牌配置仅 admin 角色可修改
- ✅ 公开接口不返回敏感信息
- ✅ 使用 Guards 保护管理员端点

### 3. 数据验证

- ✅ 验证颜色格式 (HEX)
- ✅ 验证邮箱格式
- ✅ 验证电话格式
- ✅ 防止 XSS 攻击

---

## 监控和日志

### 1. 关键指标

- Logo 上传成功率
- 品牌配置更新频率
- 静态资源访问量
- API 响应时间

### 2. 日志记录

```typescript
// 推送处理器日志
this.logger.log(`Brand name loaded: ${brandName}`)

// 文件上传日志
this.logger.log(`Logo uploaded: ${logoUrl}`)
```

### 3. 错误监控

- 文件上传失败
- 图片压缩失败
- API 调用失败
- 品牌配置加载失败

---

## 相关文档

- [品牌配置 API 文档](./BRANDING_API_DOCUMENTATION.md)
- [Story 6.3: 白标输出功能](./6-3-white-label-output-functionality.md)
- [Swagger API 文档](http://localhost:3001/api-docs)
