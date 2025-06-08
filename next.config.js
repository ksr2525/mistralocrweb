/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  // 减小构建大小的配置
  webpack: (config, { dev, isServer }) => {
    // 只在生产构建中应用这些优化
    if (!dev && !isServer) {
      // 启用压缩
      config.optimization.minimize = true

      // 分割代码块
      config.optimization.splitChunks = {
        chunks: "all",
        maxSize: 20000000, // 20MB 限制
        cacheGroups: {
          default: false,
          vendors: false,
          // 将第三方库分成更小的块
          vendor: {
            name: "vendor",
            chunks: "all",
            test: /node_modules/,
            priority: 20,
            enforce: true,
            maxSize: 20000000, // 20MB 限制
          },
          commons: {
            name: "commons",
            chunks: "all",
            minChunks: 2,
            priority: 10,
            reuseExistingChunk: true,
            maxSize: 20000000, // 20MB 限制
          },
        },
      }
    }
    return config
  },
  // 移除 CSS 优化，因为它需要 critters 包
  experimental: {
    // 移除 optimizeCss: true
  },
}

export default nextConfig
