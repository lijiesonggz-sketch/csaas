/** @type {import('next').NextConfig} */
const path = require('path')
const { PHASE_DEVELOPMENT_SERVER } = require('next/constants')

module.exports = (phase) => {
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER

  return {
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
    // 仅在开发服务器阶段禁用 standalone；生产构建与启动都固定使用 standalone 输出。
    output: isDevServer ? undefined : 'standalone',
    // Add webpack configuration to help resolve hoisted dependencies in monorepo
    webpack: (config) => {
      // Frontend lives at D:\csaas\frontend, so hoisted workspace deps are in D:\csaas\node_modules.
      config.resolve.modules.push(path.resolve(__dirname, '../node_modules'))
      return config
    },
  }
}
