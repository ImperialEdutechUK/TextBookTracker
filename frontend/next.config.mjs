const nextConfig = {
  reactStrictMode: true,
  webpack(config) {
    // Treat .html imports as source assets to avoid loader errors
    config.module.rules.push({
      test: /\.html$/i,
      type: 'asset/source',
    });

    // pdf.js (used in the browser to render cover thumbnails) has an optional
    // dependency on the Node `canvas` package. We never use it, so stub it out
    // to keep the build from trying to resolve a native module.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };

    return config;
  },
};

export default nextConfig;
