import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    minimumCacheTTL: 60,
    formats: ['image/webp'],
    qualities: [75],
    // Storage URLs have no extension, so SVG must also work through the image endpoint.
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'none'; script-src 'none'; sandbox;",
    localPatterns: [
      { pathname: '/api/public/video-thumbnails/*/*', search: '' },
      { pathname: '/logo.svg', search: '' },
      { pathname: '/placeholder.svg', search: '' },
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gr5v0httrl.ufs.sh',
        pathname: '/f/*',
        search: '',
      },
      {
        protocol: 'https',
        hostname: 'utfs.io',
        pathname: '/f/*',
        search: '',
      },
    ],
  },
}

export default nextConfig
