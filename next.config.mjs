/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist', 'canvas'],
  },
};
export default nextConfig;
