import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force HTTP protocol for static assets to prevent mixed content errors
  assetPrefix: process.env.NODE_ENV === 'production' && !process.env.HTTPS_ENABLED ? 'http://31.97.76.172:3000' : undefined,
  
  // Performance optimizations
  experimental: {
    // Enable server components caching
    serverComponentsExternalPackages: ['bcrypt', 'ioredis'],
    // Optimize bundle size
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // Caching configuration
  cacheHandler: process.env.NODE_ENV === 'production' ? require.resolve('./cache-handler.js') : undefined,
  cacheMaxMemorySize: 50 * 1024 * 1024, // 50MB

  // Security headers configuration with caching optimizations
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'off'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: process.env.NODE_ENV === 'production' && !process.env.HTTPS_ENABLED 
              ? "default-src 'self' http:; script-src 'self' 'unsafe-inline' 'unsafe-eval' http:; style-src 'self' 'unsafe-inline' http:; font-src 'self' data: http:; img-src 'self' data: http:; connect-src 'self' http:;"
              : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self';"
          },
        ],
      },
      {
        // Static assets caching
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Image caching
        source: '/_next/image(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // API routes with selective caching
        source: '/api/indicator-tree',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=60',
          },
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow'
          },
        ],
      },
      {
        // API routes with selective caching
        source: '/api/academic-years',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=1800, stale-while-revalidate=60',
          },
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow'
          },
        ],
      },
      {
        // Default API routes (no cache)
        source: '/api/(.*)',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow'
          },
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate'
          },
        ],
      },
    ];
  },

  // External packages for server components
  serverExternalPackages: ['bcrypt'],
  
  // Enable standalone output for Docker
  output: 'standalone',
  
  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript checking during build
  typescript: {
    ignoreBuildErrors: true,
  },

  // Webpack configuration for security
  webpack: (config, { isServer }) => {
    // Add security-related webpack configurations
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    return config;
  },

  // Environment variables validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Image optimization security
  images: {
    domains: [], // Restrict external image domains
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Redirect configuration for security
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/admin/users',
        permanent: false,
      },
    ];
  },

  // Rewrites for API versioning and security
  async rewrites() {
    return [
      {
        source: '/health',
        destination: '/api/health',
      },
    ];
  },
};

export default nextConfig;
