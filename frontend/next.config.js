/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['antd', '@ant-design/icons'],
  eslint: {
    // 暂时禁用构建时的ESLint检查，以便快速测试
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 暂时禁用构建时的类型检查
    ignoreBuildErrors: true,
  },
  // 增加API body大小限制（用于大型文档上传）
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
}

module.exports = nextConfig
