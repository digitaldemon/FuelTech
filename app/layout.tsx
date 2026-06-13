import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorkerRegistrar from './components/ServiceWorkerRegistrar';

export const metadata: Metadata = {
  title: 'FuelTech AI Pro | AI for Fueling Technicians',
  description: 'AI-powered field assistant for gas station technicians, ATG testers, startup specialists, and petroleum maintenance teams.',
  // manifest is added manually in <head> below to avoid Next.js injecting crossorigin="use-credentials"
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FuelTech AI',
  },
  icons: {
    apple: '/apple-touch-icon.png',
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#020617',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body>
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
