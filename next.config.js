/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        'undici': false,
      };
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        'undici': false,
      };
    }
    return config;
  },
};

module.exports = nextConfig; 