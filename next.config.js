/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.module.rules.push({
      test: /node_modules\/undici/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: [
            ['@babel/preset-env', { targets: { node: 'current' } }]
          ],
          plugins: [
            '@babel/plugin-transform-private-methods',
            '@babel/plugin-transform-class-properties',
            '@babel/plugin-transform-private-property-in-object'
          ]
        },
      },
    });
    return config;
  },
};

module.exports = nextConfig; 