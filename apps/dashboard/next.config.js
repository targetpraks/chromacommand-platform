/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@chromacommand/shared"],
  images: { remotePatterns: [] },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [
      {
        source: "/api/trpc/:path*",
        destination: "http://api:4000/api/trpc/:path*",
      },
    ];
  },
};
module.exports = nextConfig;
