import type { NextConfig } from 'next'

// middlewareClientMaxBodySize raises the Route Handler body limit (default 10MB).
// Not yet in @types/next, hence the cast.
const nextConfig = {
  middlewareClientMaxBodySize: '200mb',
  experimental: {
    serverActions: {
      bodySizeLimit: '200mb',
    },
  },
} satisfies NextConfig & { middlewareClientMaxBodySize?: string }

export default nextConfig
