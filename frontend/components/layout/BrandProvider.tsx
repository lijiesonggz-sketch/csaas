/**
 * BrandProvider Component
 *
 * Story 6.3: 白标输出功能
 *
 * 品牌配置全局提供者
 * - 从 API 获取品牌配置
 * - 动态注入 CSS 变量
 * - 动态替换 Logo
 * - 动态更新页面标题
 * - 缓存到 localStorage
 */

'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { BrandingConfig, getTenantBranding } from '@/lib/api/branding'

interface BrandContextValue {
  config: BrandingConfig | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const BrandContext = createContext<BrandContextValue | undefined>(undefined)

const CACHE_KEY = 'tenant_branding_config'
const CACHE_DURATION = 1000 * 60 * 5 // 5 minutes

interface CachedBranding {
  config: BrandingConfig
  timestamp: number
}

interface BrandProviderProps {
  children: ReactNode
}

export function BrandProvider({ children }: BrandProviderProps) {
  const [config, setConfig] = useState<BrandingConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 从 localStorage 加载缓存
  const loadFromCache = (): BrandingConfig | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (!cached) return null

      const { config, timestamp }: CachedBranding = JSON.parse(cached)
      const now = Date.now()

      // 检查缓存是否过期
      if (now - timestamp > CACHE_DURATION) {
        localStorage.removeItem(CACHE_KEY)
        return null
      }

      return config
    } catch (err) {
      console.error('Failed to load branding from cache:', err)
      return null
    }
  }

  // 保存到 localStorage
  const saveToCache = (config: BrandingConfig) => {
    try {
      const cached: CachedBranding = {
        config,
        timestamp: Date.now(),
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cached))
    } catch (err) {
      console.error('Failed to save branding to cache:', err)
    }
  }

  // 应用品牌配置到 DOM
  const applyBranding = (config: BrandingConfig) => {
    // 注入 CSS 变量
    const root = document.documentElement
    root.style.setProperty('--brand-primary', config.brandPrimaryColor || '#1890ff')
    if (config.brandSecondaryColor) {
      root.style.setProperty('--brand-secondary', config.brandSecondaryColor)
    }

    // 更新页面标题
    if (config.companyName) {
      document.title = `${config.companyName} - 雷达服务`
    }

    // 更新 favicon (如果有 logo)
    if (config.brandLogoUrl) {
      const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (favicon) {
        favicon.href = config.brandLogoUrl
      }
    }
  }

  // 加载品牌配置
  const loadBranding = async () => {
    try {
      setLoading(true)
      setError(null)

      // 先尝试从缓存加载
      const cached = loadFromCache()
      if (cached) {
        setConfig(cached)
        applyBranding(cached)
        setLoading(false)
        // 后台刷新
        refreshBranding()
        return
      }

      // 从 API 加载 - apiFetch 已经自动提取了 data
      const config = await getTenantBranding()
      setConfig(config)
      applyBranding(config)
      saveToCache(config)
    } catch (err: any) {
      console.error('Failed to load branding:', err)
      setError(err.message || '加载品牌配置失败')

      // 使用默认配置
      const defaultConfig: BrandingConfig = {
        brandPrimaryColor: '#1890ff',
      }
      setConfig(defaultConfig)
      applyBranding(defaultConfig)
    } finally {
      setLoading(false)
    }
  }

  // 后台刷新品牌配置
  const refreshBranding = async () => {
    try {
      const config = await getTenantBranding()
      setConfig(config)
      applyBranding(config)
      saveToCache(config)
    } catch (err) {
      console.error('Failed to refresh branding:', err)
    }
  }

  // 初始加载
  useEffect(() => {
    loadBranding()
  }, [])

  const value: BrandContextValue = {
    config,
    loading,
    error,
    refresh: loadBranding,
  }

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
}

/**
 * 使用品牌配置的 Hook
 */
export function useBranding(): BrandContextValue {
  const context = useContext(BrandContext)
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandProvider')
  }
  return context
}

/**
 * 获取品牌颜色的 Hook
 */
export function useBrandColors() {
  const { config } = useBranding()
  return {
    primary: config?.brandPrimaryColor || '#1890ff',
    secondary: config?.brandSecondaryColor || '#52c41a',
  }
}

/**
 * 获取公司名称的 Hook
 */
export function useCompanyName() {
  const { config } = useBranding()
  return config?.companyName || 'Csaas'
}

/**
 * 获取品牌 Logo 的 Hook
 */
export function useBrandLogo() {
  const { config } = useBranding()
  return config?.brandLogoUrl
}
