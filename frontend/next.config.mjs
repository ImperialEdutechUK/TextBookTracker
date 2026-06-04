const nextConfig = {
  reactStrictMode: true,
  webpack(config) {
    // Treat .html imports as source assets to avoid loader errors
    config.module.rules.push({
      test: /\.html$/i,
      type: 'asset/source',
    });

    return config;
  },
};

export default nextConfig;
