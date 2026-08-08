/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist', 'canvas'],
  },
  async rewrites() {
    return [
      // Contract Desk is a static single-page app in public/desk;
      // this gives it a clean URL. Access is gated in middleware.ts.
      { source: '/desk', destination: '/desk/index.html' },
    ];
  },
};
export default nextConfig;
