# 品牌配置 API 文档

## Story 6.3: 白标输出功能

本文档描述品牌配置相关的 API 端点。

---

## 目录

- [管理员端点](#管理员端点)
  - [获取品牌配置](#获取品牌配置)
  - [更新品牌配置](#更新品牌配置)
  - [上传品牌 Logo](#上传品牌-logo)
- [公开端点](#公开端点)
  - [获取租户品牌配置](#获取租户品牌配置)
- [数据模型](#数据模型)

---

## 管理员端点

### 获取品牌配置

获取当前租户的品牌配置。

**端点**: `GET /api/v1/admin/branding`

**权限**: 需要 `admin` 角色

**请求头**:
```
Authorization: Bearer <token>
```

**响应**: `200 OK`

```json
{
  "success": true,
  "data": {
    "brandLogoUrl": "https://example.com/uploads/tenants/xxx/logo.png",
    "brandPrimaryColor": "#1890ff",
    "brandSecondaryColor": "#52c41a",
    "companyName": "示例咨询公司",
    "emailSignature": "此致\n敬礼\n\n示例咨询公司",
    "contactPhone": "+86 138-0000-0000",
    "contactEmail": "contact@example.com"
  }
}
```

**错误响应**:

- `401 Unauthorized`: 未登录或 token 无效
- `403 Forbidden`: 没有 admin 权限

---

### 更新品牌配置

更新当前租户的品牌配置。

**端点**: `PUT /api/v1/admin/branding`

**权限**: 需要 `admin` 角色

**请求头**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体**:

```json
{
  "brandPrimaryColor": "#1890ff",
  "brandSecondaryColor": "#52c41a",
  "companyName": "示例咨询公司",
  "emailSignature": "此致\n敬礼\n\n示例咨询公司",
  "contactPhone": "+86 138-0000-0000",
  "contactEmail": "contact@example.com"
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `brandPrimaryColor` | string | 否 | 主题色 (HEX 格式，如 `#1890ff`) |
| `brandSecondaryColor` | string | 否 | 辅助色 (HEX 格式) |
| `companyName` | string | 否 | 公司名称 |
| `emailSignature` | string | 否 | 邮件签名 |
| `contactPhone` | string | 否 | 联系电话 |
| `contactEmail` | string | 否 | 联系邮箱 |

**响应**: `200 OK`

```json
{
  "success": true,
  "data": {
    "brandLogoUrl": "https://example.com/uploads/tenants/xxx/logo.png",
    "brandPrimaryColor": "#1890ff",
    "brandSecondaryColor": "#52c41a",
    "companyName": "示例咨询公司",
    "emailSignature": "此致\n敬礼\n\n示例咨询公司",
    "contactPhone": "+86 138-0000-0000",
    "contactEmail": "contact@example.com"
  },
  "message": "品牌配置已更新"
}
```

**错误响应**:

- `400 Bad Request`: 请求参数无效
- `401 Unauthorized`: 未登录或 token 无效
- `403 Forbidden`: 没有 admin 权限

---

### 上传品牌 Logo

上传品牌 Logo 图片。

**端点**: `POST /api/v1/admin/branding/logo`

**权限**: 需要 `admin` 角色

**请求头**:
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**请求体** (multipart/form-data):

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | File | 是 | Logo 图片文件 (PNG/JPG/SVG) |

**文件限制**:
- 支持格式: PNG, JPG, SVG
- 最大文件大小: 2MB
- 图片会自动压缩到最大宽度 400px (保持宽高比)

**响应**: `200 OK`

```json
{
  "success": true,
  "data": {
    "logoUrl": "https://example.com/uploads/tenants/xxx/logo.png"
  },
  "message": "Logo 上传成功"
}
```

**错误响应**:

- `400 Bad Request`: 文件格式不支持或文件过大
- `401 Unauthorized`: 未登录或 token 无效
- `403 Forbidden`: 没有 admin 权限
- `500 Internal Server Error`: 文件上传或处理失败

**示例 (使用 curl)**:

```bash
curl -X POST \
  https://api.example.com/api/v1/admin/branding/logo \
  -H 'Authorization: Bearer <token>' \
  -F 'file=@/path/to/logo.png'
```

---

## 公开端点

### 获取租户品牌配置

获取当前租户的品牌配置（公开接口，用于前端初始化）。

**端点**: `GET /api/v1/tenant/branding`

**权限**: 无需认证（公开接口）

**响应**: `200 OK`

```json
{
  "success": true,
  "data": {
    "brandLogoUrl": "https://example.com/uploads/tenants/xxx/logo.png",
    "brandPrimaryColor": "#1890ff",
    "brandSecondaryColor": "#52c41a",
    "companyName": "示例咨询公司",
    "emailSignature": null,
    "contactPhone": null,
    "contactEmail": null
  }
}
```

**注意**:
- 此接口不返回敏感信息（如邮件签名、联系方式）
- 用于前端应用初始化时加载品牌配置

---

## 数据模型

### BrandingConfig

品牌配置数据模型。

```typescript
interface BrandingConfig {
  brandLogoUrl?: string          // Logo URL
  brandPrimaryColor: string      // 主题色 (默认: #1890ff)
  brandSecondaryColor?: string   // 辅助色
  companyName?: string           // 公司名称
  emailSignature?: string        // 邮件签名
  contactPhone?: string          // 联系电话
  contactEmail?: string          // 联系邮箱
}
```

---

## 使用示例

### 前端集成

#### 1. 获取品牌配置

```typescript
import { getTenantBranding } from '@/lib/api/branding'

const response = await getTenantBranding()
const config = response.data

// 应用品牌配置
document.documentElement.style.setProperty('--brand-primary', config.brandPrimaryColor)
document.title = `${config.companyName || 'Csaas'} - 雷达服务`
```

#### 2. 更新品牌配置 (管理员)

```typescript
import { updateBranding } from '@/lib/api/branding'

await updateBranding({
  brandPrimaryColor: '#1890ff',
  companyName: '我的咨询公司',
  contactEmail: 'contact@example.com'
})
```

#### 3. 上传 Logo (管理员)

```typescript
import { uploadLogo } from '@/lib/api/branding'

const file = event.target.files[0]
const response = await uploadLogo(file)
console.log('Logo URL:', response.data.logoUrl)
```

---

## WebSocket 推送事件

推送事件现在包含品牌信息。

### 事件: `radar:push:new`

```json
{
  "pushId": "xxx",
  "radarType": "tech",
  "title": "微服务架构最佳实践",
  "summary": "...",
  "brandName": "示例咨询公司",
  "timestamp": "2026-02-03T10:00:00Z",
  ...
}
```

**新增字段**:
- `brandName`: 租户品牌名称（如果未配置，默认为 "Csaas"）

---

## 注意事项

1. **文件存储**: Logo 文件存储在 `/uploads/tenants/{tenantId}/` 目录
2. **图片优化**: 上传的图片会自动压缩到最大宽度 400px
3. **缓存**: 前端会将品牌配置缓存到 localStorage (1小时有效期)
4. **默认值**: 如果未配置品牌，使用默认 Csaas 品牌
5. **多租户隔离**: 品牌配置按 tenantId 隔离，每个租户独立配置

---

## 相关文档

- [Story 6.3: 白标输出功能](../_bmad-output/sprint-artifacts/6-3-white-label-output-functionality.md)
- [Swagger API 文档](http://localhost:3001/api-docs)
