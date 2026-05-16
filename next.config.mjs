/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.BUILD_STATIC === 'true' ? 'export' : undefined,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
