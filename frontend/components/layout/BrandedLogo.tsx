/**
 * BrandedLogo Component
 *
 * Story 6.3: 白标输出功能
 *
 * 品牌化 Logo 组件
 * - 显示租户自定义 Logo
 * - 如果未配置，显示默认 Logo
 * - 支持加载失败回退
 */

'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Box, Typography } from '@mui/material'
import { useBrandLogo, useCompanyName } from './BrandProvider'

interface BrandedLogoProps {
  size?: number
  showText?: boolean
}

export function BrandedLogo({ size = 40, showText = true }: BrandedLogoProps) {
  const logoUrl = useBrandLogo()
  const companyName = useCompanyName()
  const [imageError, setImageError] = useState(false)

  // 如果有自定义 Logo 且未加载失败
  if (logoUrl && !imageError) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Image
          src={logoUrl}
          alt={companyName}
          width={size}
          height={size}
          style={{ objectFit: 'contain' }}
          onError={() => setImageError(true)}
        />
        {showText && (
          <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
            {companyName}
          </Typography>
        )}
      </Box>
    )
  }

  // 默认 Logo (首字母)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box
        sx={{
          width: size,
          height: size,
          backgroundColor: 'primary.main',
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 700,
          fontSize: size * 0.5,
        }}
      >
        {companyName.charAt(0).toUpperCase()}
      </Box>
      {showText && (
        <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
          {companyName}
        </Typography>
      )}
    </Box>
  )
}
