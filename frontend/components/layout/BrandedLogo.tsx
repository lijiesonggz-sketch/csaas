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
import { useBrandLogo, useCompanyName } from './BrandProvider'
import { cn } from '@/lib/utils'

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
      <div className="flex items-center gap-1.5">
        <Image
          src={logoUrl}
          alt={companyName}
          width={size}
          height={size}
          style={{ objectFit: 'contain' }}
          onError={() => setImageError(true)}
        />
        {showText && (
          <span className="text-lg font-semibold text-[#1E3A5F]">
            {companyName}
          </span>
        )}
      </div>
    )
  }

  // 默认 Logo (首字母)
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          'flex items-center justify-center rounded-sm text-white font-bold',
          'bg-[#1E3A5F]',
        )}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          fontSize: `${size * 0.5}px`,
        }}
      >
        {companyName.charAt(0).toUpperCase()}
      </div>
      {showText && (
        <span className="text-lg font-semibold text-[#1E3A5F]">
          {companyName}
        </span>
      )}
    </div>
  )
}
