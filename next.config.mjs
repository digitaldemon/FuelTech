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
  async headers() {
    // Never let the desk app or its script sit in a stale cache — it ships
    // updates constantly and is loaded as a home-screen web app, where a
    // cached copy otherwise sticks around across launches.
    return [
      {
        source: '/desk',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
      {
        source: '/desk/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ];
  },
};
export default nextConfig;
