import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/components/providers/AuthProvider';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'RunFestival',
  description: 'You run alone. You never run alone. AI-powered social running.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RunFestival',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0D1117',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-festival-darker">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
