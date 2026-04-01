/**
 * BrandingPreview Component
 *
 * Story 6.3: 白标输出功能
 *
 * 品牌配置实时预览组件
 * - 显示应用品牌后的效果
 * - Logo 预览
 * - 主题色应用预览
 * - 推送卡片预览
 */

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bell, TrendingUp } from 'lucide-react'
import { BrandingConfig } from '@/lib/api/branding'

interface BrandingPreviewProps {
  config: BrandingConfig
}

export function BrandingPreview({ config }: BrandingPreviewProps) {
  const primaryColor = config.brandPrimaryColor || '#1890ff'
  const secondaryColor = config.brandSecondaryColor || '#52c41a'
  const companyName = config.companyName || 'Csaas'
  const logoUrl = config.brandLogoUrl

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">实时预览</h3>
      <p className="text-sm text-muted-foreground mb-6">
        查看品牌配置应用后的效果
      </p>

      <div className="space-y-6">
        {/* 导航栏预览 */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-3">导航栏</p>
            <div
              className="flex items-center justify-between p-3 rounded text-white"
              style={{ backgroundColor: primaryColor }}
            >
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <div
                    className="w-10 h-10 rounded bg-white/20 flex items-center justify-center overflow-hidden"
                  >
                    <img
                      src={logoUrl}
                      alt={companyName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded bg-white/20 flex items-center justify-center">
                    <span className="text-lg font-semibold">{companyName.charAt(0)}</span>
                  </div>
                )}
                <span className="text-lg font-semibold">{companyName}</span>
              </div>
              <Bell className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 按钮预览 */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-3">按钮样式</p>
            <div className="flex gap-2 mt-2">
              <Button
                style={{ backgroundColor: primaryColor }}
                className="hover:opacity-90"
              >
                主要按钮
              </Button>
              <Button
                variant="outline"
                style={{
                  borderColor: primaryColor,
                  color: primaryColor,
                }}
                className="hover:bg-opacity-10"
              >
                次要按钮
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 推送卡片预览 */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-3">推送内容</p>
            <Card
              className="border hover:border-opacity-100 transition-all"
              style={{ borderColor: primaryColor }}
            >
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Badge
                    className="text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    技术雷达
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    来自 {companyName} 的推送
                  </span>
                </div>
                <h4 className="text-lg font-semibold mb-2">
                  微服务架构最佳实践
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  本文介绍了微服务架构的核心概念和实施要点...
                </p>
                <div className="flex items-center gap-2">
                  <Badge
                    className="text-white gap-1"
                    style={{ backgroundColor: secondaryColor }}
                  >
                    <TrendingUp className="h-3 w-3" />
                    高相关度
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    2 小时前
                  </span>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* 邮件预览 */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-3">邮件模板</p>
            <div className="p-4 bg-muted rounded border">
              {/* 邮件头部 */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b-2" style={{ borderColor: primaryColor }}>
                {logoUrl ? (
                  <div className="w-12 h-12 rounded overflow-hidden">
                    <img
                      src={logoUrl}
                      alt={companyName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="w-12 h-12 rounded flex items-center justify-center text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <span className="text-xl font-semibold">{companyName.charAt(0)}</span>
                  </div>
                )}
                <span className="text-lg font-semibold">{companyName}</span>
              </div>

              {/* 邮件内容 */}
              <p className="text-sm mb-2">您好，</p>
              <p className="text-sm mb-2">
                这是一封来自 {companyName} 的推送摘要邮件。
              </p>
              <p className="text-sm mb-4">今日为您推送了 3 条相关内容...</p>

              {/* 邮件签名 */}
              {config.emailSignature && (
                <>
                  <div className="border-t my-3" />
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {config.emailSignature}
                  </p>
                </>
              )}

              {/* 联系信息 */}
              {(config.contactEmail || config.contactPhone) && (
                <div className="pt-2 mt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    {config.contactEmail && <div>邮箱: {config.contactEmail}</div>}
                    {config.contactPhone && <div>电话: {config.contactPhone}</div>}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
