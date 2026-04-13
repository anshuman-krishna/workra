/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@workra/shared'],
  output: 'standalone',
};

export default nextConfig;
