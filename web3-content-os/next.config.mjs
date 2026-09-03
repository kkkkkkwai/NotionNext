/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['@electric-sql/pglite', '@electric-sql/pglite-pgvector', 'pdf-parse', 'mammoth', 'postgres', '@anthropic-ai/sdk']
  },
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false }
    return config
  }
}
export default nextConfig
