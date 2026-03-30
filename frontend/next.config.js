/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  eslint: {
    // 暂时禁用构建时的ESLint检查，以便快速测试
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 暂时禁用构建时的类型检查
    ignoreBuildErrors: true,
  },
  experimental: {
    missingSuspenseWithCSRBailout: false,
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // 仅在生产构建中输出 standalone；本地 dev 环境保持默认输出，避免 .next/server vendor chunk 缺失。
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  // Add webpack configuration to help resolve hoisted dependencies in monorepo
  webpack: (config, { isServer }) => {
    // Add root node_modules to webpack's resolve path
    config.resolve.modules.push(path.resolve(__dirname, '../../node_modules'))
    return config
  },
}

module.exports = nextConfig
