/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    // Enable if you want to try the newer CSS features
    // appDir: true,
  },
  webpack: (config) => {
    return config;
  },
}

module.exports = nextConfig 