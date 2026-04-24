/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@chromacommand/shared"],
  images: { remotePatterns: [] },
};

module.exports = nextConfig;
