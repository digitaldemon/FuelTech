import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FuelTechAI Pro | AI for Fueling Technicians',
  description: 'AI-powered field assistant for gas station technicians, ATG testers, startup specialists, and petroleum maintenance teams.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
