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
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Avatar,
  Stack,
  Divider,
} from '@mui/material'
import {
  Notifications as NotificationIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material'
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
    <Box>
      <Typography variant="h6" gutterBottom>
        实时预览
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        查看品牌配置应用后的效果
      </Typography>

      <Stack spacing={3}>
        {/* 导航栏预览 */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom color="text.secondary">
              导航栏
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                backgroundColor: primaryColor,
                borderRadius: 1,
                color: 'white',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {logoUrl ? (
                  <Avatar
                    src={logoUrl}
                    alt={companyName}
                    variant="rounded"
                    sx={{ width: 40, height: 40 }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="h6">{companyName.charAt(0)}</Typography>
                  </Box>
                )}
                <Typography variant="h6">{companyName}</Typography>
              </Box>
              <NotificationIcon />
            </Box>
          </CardContent>
        </Card>

        {/* 按钮预览 */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom color="text.secondary">
              按钮样式
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
              <Button
                variant="contained"
                sx={{
                  backgroundColor: primaryColor,
                  '&:hover': {
                    backgroundColor: primaryColor,
                    opacity: 0.9,
                  },
                }}
              >
                主要按钮
              </Button>
              <Button
                variant="outlined"
                sx={{
                  borderColor: primaryColor,
                  color: primaryColor,
                  '&:hover': {
                    borderColor: primaryColor,
                    backgroundColor: `${primaryColor}10`,
                  },
                }}
              >
                次要按钮
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {/* 推送卡片预览 */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom color="text.secondary">
              推送内容
            </Typography>
            <Card
              sx={{
                mt: 2,
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                  borderColor: primaryColor,
                  boxShadow: `0 0 0 1px ${primaryColor}`,
                },
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Chip
                    label="技术雷达"
                    size="small"
                    sx={{
                      backgroundColor: primaryColor,
                      color: 'white',
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    来自 {companyName} 的推送
                  </Typography>
                </Box>
                <Typography variant="h6" gutterBottom>
                  微服务架构最佳实践
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  本文介绍了微服务架构的核心概念和实施要点...
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip
                    icon={<TrendingUpIcon />}
                    label="高相关度"
                    size="small"
                    sx={{
                      backgroundColor: secondaryColor,
                      color: 'white',
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    2 小时前
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* 邮件预览 */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom color="text.secondary">
              邮件模板
            </Typography>
            <Box
              sx={{
                mt: 2,
                p: 3,
                backgroundColor: 'background.default',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {/* 邮件头部 */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  mb: 3,
                  pb: 2,
                  borderBottom: '2px solid',
                  borderColor: primaryColor,
                }}
              >
                {logoUrl ? (
                  <Avatar
                    src={logoUrl}
                    alt={companyName}
                    variant="rounded"
                    sx={{ width: 48, height: 48 }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      backgroundColor: primaryColor,
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                    }}
                  >
                    <Typography variant="h5">{companyName.charAt(0)}</Typography>
                  </Box>
                )}
                <Typography variant="h6">{companyName}</Typography>
              </Box>

              {/* 邮件内容 */}
              <Typography variant="body2" paragraph>
                您好，
              </Typography>
              <Typography variant="body2" paragraph>
                这是一封来自 {companyName} 的推送摘要邮件。
              </Typography>
              <Typography variant="body2" paragraph>
                今日为您推送了 3 条相关内容...
              </Typography>

              {/* 邮件签名 */}
              {config.emailSignature && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ whiteSpace: 'pre-line' }}
                  >
                    {config.emailSignature}
                  </Typography>
                </>
              )}

              {/* 联系信息 */}
              {(config.contactEmail || config.contactPhone) && (
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary">
                    {config.contactEmail && <div>邮箱: {config.contactEmail}</div>}
                    {config.contactPhone && <div>电话: {config.contactPhone}</div>}
                  </Typography>
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  )
}
