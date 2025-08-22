import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gr5v0httrl.ufs.sh',
      },
    ],
  },
}

export default nextConfig
