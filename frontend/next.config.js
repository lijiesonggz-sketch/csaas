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
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Docker 部署支持
  output: 'standalone',
  // Add webpack configuration to help resolve hoisted dependencies in monorepo
  webpack: (config, { isServer }) => {
    // Add root node_modules to webpack's resolve path
    config.resolve.modules.push(path.resolve(__dirname, '../../node_modules'))
    return config
  },
}

module.exports = nextConfig
