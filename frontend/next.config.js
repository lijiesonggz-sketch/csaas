/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['antd', '@ant-design/icons', '@ant-design/cssinjs', '@ant-design/cssinjs-utils'],
  eslint: {
    // 暂时禁用构建时的ESLint检查，以便快速测试
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 暂时禁用构建时的类型检查
    ignoreBuildErrors: true,
  },
  // Note: optimizePackageImports for antd causes issues in monorepo setup
  // antd is hoisted to root node_modules, Next.js can't find it during optimization
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Add webpack configuration to help resolve hoisted dependencies in monorepo
  webpack: (config, { isServer }) => {
    // Add root node_modules to webpack's resolve path
    config.resolve.modules.push(path.resolve(__dirname, '../../node_modules'))
    return config
  },
}

module.exports = nextConfig
